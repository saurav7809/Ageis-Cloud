import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

const STRATEGIES = ["CPU", "LATENCY", "TREND", "NONE"] as const;
const CLUSTERS_DEFAULT = ["aegiscloud-local"];

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ message: r.statusText }));
    throw new Error(body.message ?? r.statusText);
  }
  return r.json();
}

type Step = "configure" | "deploy" | "live";

interface PodSummary {
  succeeded: boolean;
  workload: string;
  namespace: string;
  cluster: string;
  desiredReplicas: number;
  readyReplicas: number;
  detail: string;
}

export function DeployPage({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("configure");

  // Form fields
  const [svcName, setSvcName] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [ownerTeam, setOwnerTeam] = useState("");
  const [image, setImage] = useState("");
  const [cluster, setCluster] = useState("aegiscloud-local");
  const [namespace, setNamespace] = useState("default");
  const [replicas, setReplicas] = useState(2);
  const [containerPort, setContainerPort] = useState(8080);
  const [strategy, setStrategy] = useState<string>("CPU");
  const [envLines, setEnvLines] = useState("# KEY=VALUE");

  // Available clusters from API
  const [availClusters, setAvailClusters] = useState<string[]>(CLUSTERS_DEFAULT);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PodSummary | null>(null);

  // Live status polling
  const [liveStatus, setLiveStatus] = useState<PodSummary | null>(null);
  const [polling, setPolling] = useState(false);

  // Load clusters
  useEffect(() => {
    apiFetch("/api/v1/cluster-status", token)
      .then((rows: any[]) => {
        const names = rows.filter((r) => r.isLive).map((r) => r.name as string);
        if (names.length) setAvailClusters(names);
      })
      .catch(() => {});
  }, [token]);

  // Poll live status after deploy
  useEffect(() => {
    if (step !== "live" || !outcome?.succeeded) return;
    setPolling(true);
    const id = setInterval(async () => {
      try {
        const s = await apiFetch(
          `/api/v1/deployments/${encodeURIComponent(cluster)}/${encodeURIComponent(namespace)}/${encodeURIComponent(svcName)}`,
          token
        );
        setLiveStatus(s);
      } catch {}
    }, 4000);
    return () => {
      clearInterval(id);
      setPolling(false);
    };
  }, [step, outcome]);

  const parseEnv = (): Record<string, string> => {
    const env: Record<string, string> = {};
    envLines.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx > 0) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    });
    return env;
  };

  const handleDeploy = async () => {
    if (!svcName.trim() || !image.trim()) {
      setError("Service name and Docker image are required.");
      return;
    }
    setDeploying(true);
    setError(null);
    setStep("deploy");
    try {
      // 1. Create service
      const svc = await apiFetch("/api/v1/services", token, {
        method: "POST",
        body: JSON.stringify({ name: svcName.trim(), description: svcDesc.trim(), ownerTeam: ownerTeam.trim() }),
      });

      // 2. Deploy workload
      const result: PodSummary = await apiFetch("/api/v1/deployments", token, {
        method: "POST",
        body: JSON.stringify({
          cluster,
          namespace,
          workload: svcName.trim(),
          image: image.trim(),
          replicas,
          containerPort,
          adopt: false,
          env: parseEnv(),
        }),
      });

      setOutcome(result);

      if (result.succeeded) {
        // 3. Register as managed target
        await apiFetch("/api/v1/targets", token, {
          method: "POST",
          body: JSON.stringify({
            serviceId: svc.id,
            clusterName: cluster,
            namespace,
            label: `${cluster}-${namespace}`,
            scalingStrategy: strategy,
          }),
        }).catch(() => {}); // non-fatal — target can be registered later
      }

      setStep("live");
    } catch (e: any) {
      setError(e.message ?? "Deploy failed");
      setStep("configure");
    } finally {
      setDeploying(false);
    }
  };

  const currentStatus = liveStatus ?? outcome;
  const isHealthy =
    currentStatus && currentStatus.readyReplicas >= currentStatus.desiredReplicas;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div className="page-head">
        <h1>Deploy Service</h1>
        <p>Register a service and roll it out to a live cluster in one step.</p>
      </div>

      {/* Pipeline stepper */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 28,
        background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 10, overflow: "hidden"
      }}>
        {([
          ["configure", "⚙️", "Configure"],
          ["deploy", "🚀", "Deploying"],
          ["live", "📡", "Live Status"],
        ] as const).map(([s, icon, label], i) => {
          const active = step === s;
          const done =
            (s === "configure" && (step === "deploy" || step === "live")) ||
            (s === "deploy" && step === "live");
          return (
            <div key={s} style={{
              flex: 1, padding: "14px 8px", textAlign: "center",
              borderRight: i < 2 ? "1px solid #1e2a3a" : undefined,
              background: active ? "#0f2a4a" : "transparent",
              transition: "background 0.2s",
            }}>
              <div style={{ fontSize: 18 }}>{done ? "✅" : icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: active ? "#60a5fa" : done ? "#4ade80" : "#475569", marginTop: 4 }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step: Configure */}
      {step === "configure" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Service Info */}
          <div className="card">
            <div className="card-title">Service Identity</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label="Service Name *">
                <input className="input" value={svcName}
                  onChange={(e) => setSvcName(e.target.value.replace(/\s/g, "-").toLowerCase())}
                  placeholder="my-service" />
              </Field>
              <Field label="Owner Team">
                <input className="input" value={ownerTeam}
                  onChange={(e) => setOwnerTeam(e.target.value)} placeholder="platform" />
              </Field>
              <Field label="Description" style={{ gridColumn: "1/-1" }}>
                <input className="input" value={svcDesc}
                  onChange={(e) => setSvcDesc(e.target.value)}
                  placeholder="Short description of what this service does" />
              </Field>
            </div>
          </div>

          {/* Container */}
          <div className="card">
            <div className="card-title">Container Image</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label="Docker Image *" style={{ gridColumn: "1/-1" }}>
                <input className="input" value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="nginx:latest or gcr.io/my-project/my-app:v1.2.3" />
              </Field>
              <Field label="Container Port">
                <input className="input" type="number" value={containerPort}
                  onChange={(e) => setContainerPort(Number(e.target.value))} />
              </Field>
              <Field label="Initial Replicas">
                <input className="input" type="number" min={1} max={20} value={replicas}
                  onChange={(e) => setReplicas(Number(e.target.value))} />
              </Field>
            </div>
          </div>

          {/* Deployment target */}
          <div className="card">
            <div className="card-title">Deployment Target</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
              <Field label="Cluster">
                <select className="input" value={cluster} onChange={(e) => setCluster(e.target.value)}>
                  {availClusters.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Namespace">
                <input className="input" value={namespace}
                  onChange={(e) => setNamespace(e.target.value)} />
              </Field>
              <Field label="Scaling Strategy">
                <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                  {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Env vars */}
          <div className="card">
            <div className="card-title">Environment Variables</div>
            <div style={{ marginTop: 14 }}>
              <textarea
                className="input"
                rows={5}
                style={{ fontFamily: "monospace", fontSize: 12, width: "100%", resize: "vertical" }}
                value={envLines}
                onChange={(e) => setEnvLines(e.target.value)}
                placeholder={"# One KEY=VALUE per line\nDB_URL=postgres://...\nPORT=8080"}
              />
            </div>
          </div>

          {error && (
            <div style={{
              padding: "10px 16px", background: "#2d0a0a", border: "1px solid #7f1d1d",
              borderRadius: 8, color: "#fca5a5", fontSize: 13,
            }}>⚠ {error}</div>
          )}

          <button
            onClick={handleDeploy}
            disabled={deploying || !svcName || !image}
            style={{
              padding: "14px 32px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              color: "#fff", fontWeight: 700, fontSize: 15,
              opacity: !svcName || !image ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}>
            🚀 Deploy to {cluster}
          </button>
        </div>
      )}

      {/* Step: Deploying */}
      {step === "deploy" && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#60a5fa", marginBottom: 8 }}>
            Deploying {svcName}…
          </div>
          <div style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
            Applying Kubernetes manifests to <strong style={{ color: "#94a3b8" }}>{cluster}</strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "0 auto", textAlign: "left" }}>
            {[
              "Creating service record",
              "Generating Kubernetes Deployment manifest",
              "Applying via server-side apply",
              "Ensuring ClusterIP Service",
              "Registering as managed target",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                  animation: "spin 1s linear infinite",
                }} />
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{step}</span>
              </div>
            ))}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step: Live */}
      {step === "live" && (
        <div style={{ display: "grid", gap: 18 }}>
          {/* Outcome banner */}
          {outcome && (
            <div style={{
              padding: "16px 20px",
              background: outcome.succeeded ? "#0a1f12" : "#1a0808",
              border: `1px solid ${outcome.succeeded ? "#166534" : "#7f1d1d"}`,
              borderRadius: 10,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <span style={{ fontSize: 32 }}>{outcome.succeeded ? "✅" : "❌"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: outcome.succeeded ? "#86efac" : "#fca5a5" }}>
                  {outcome.succeeded
                    ? `${svcName} deployed successfully`
                    : `Deployment failed: ${outcome.detail}`}
                </div>
                {outcome.succeeded && (
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {cluster} / {namespace} · {outcome.readyReplicas}/{outcome.desiredReplicas} pods ready
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live status */}
          {currentStatus?.succeeded && (
            <div className="card">
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span>📡 Live Pod Status</span>
                {polling && (
                  <span style={{
                    fontSize: 11, color: "#22c55e", animation: "pulse 1.5s infinite",
                    background: "#0a1f12", padding: "2px 8px", borderRadius: 99, border: "1px solid #166534"
                  }}>● refreshing every 4s</span>
                )}
              </div>

              {/* Replica bar */}
              <div style={{ marginTop: 20, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: "#94a3b8" }}>Pods ready</span>
                  <span style={{ fontWeight: 700, color: isHealthy ? "#4ade80" : "#f59e0b", fontFamily: "monospace" }}>
                    {currentStatus.readyReplicas} / {currentStatus.desiredReplicas}
                  </span>
                </div>
                <div style={{ height: 8, background: "#1e2a3a", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4, transition: "width 0.5s",
                    width: `${currentStatus.desiredReplicas > 0
                      ? (currentStatus.readyReplicas / currentStatus.desiredReplicas) * 100 : 0}%`,
                    background: isHealthy
                      ? "linear-gradient(90deg,#22c55e,#4ade80)"
                      : "linear-gradient(90deg,#f59e0b,#fbbf24)",
                  }} />
                </div>
              </div>

              {/* Pod cards */}
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {Array.from({ length: currentStatus.desiredReplicas }).map((_, i) => {
                  const ready = i < currentStatus.readyReplicas;
                  return (
                    <div key={i} style={{
                      padding: "8px 14px", borderRadius: 8, fontSize: 12, fontFamily: "monospace",
                      background: ready ? "#0a1f12" : "#1a1205",
                      border: `1px solid ${ready ? "#166534" : "#713f12"}`,
                      color: ready ? "#86efac" : "#fbbf24",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: 8, color: ready ? "#22c55e" : "#f59e0b" }}>●</span>
                      {svcName}-{i + 1}
                    </div>
                  );
                })}
              </div>

              {/* Info grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 20
              }}>
                {[
                  ["Cluster", cluster],
                  ["Namespace", namespace],
                  ["Image", image.split(":")[0].split("/").pop() ?? image],
                  ["Strategy", strategy],
                ].map(([label, val]) => (
                  <div key={label} style={{
                    background: "#0d1117", border: "1px solid #1e2a3a",
                    borderRadius: 8, padding: "10px 14px"
                  }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", fontFamily: "monospace" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setStep("configure"); setOutcome(null); setLiveStatus(null); }}
            style={{
              padding: "12px 24px", borderRadius: 10, border: "1px solid #1e2a3a",
              background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14,
            }}>
            ← Deploy another service
          </button>
        </div>
      )}

      <style>{`
        .card { background: #0d1117; border: 1px solid #1e2a3a; border-radius: 12px; padding: 20px; }
        .card-title { font-weight: 700; font-size: 13px; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em; }
        .input { width: 100%; padding: 9px 12px; background: #0a0e17; border: 1px solid #1e2a3a; border-radius: 8px;
                 color: #e2e8f0; font-size: 13px; outline: none; box-sizing: border-box; }
        .input:focus { border-color: #2563eb; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

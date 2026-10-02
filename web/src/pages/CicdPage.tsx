import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "../components/LiveEvents";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface Microservice {
  name: string;
  namespace: string;
  cluster: string;
}

interface PipelineHistory {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  at: string;
}

export function CicdPage({ token }: { token: string }) {
  const [services, setServices] = useState<Microservice[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<PipelineHistory[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<"github" | "gitlab" | "curl">("github");

  // Manual trigger state
  const [triggerWorkload, setTriggerWorkload] = useState("");
  const [triggerImage, setTriggerImage] = useState("");
  const [triggerToken, setTriggerToken] = useState("dev-webhook-token");
  const [triggerReplicas, setTriggerReplicas] = useState(2);
  const [triggerResult, setTriggerResult] = useState<Record<string, unknown> | null>(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/microservices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setServices(Array.isArray(data) ? data : []);
        if (data.length > 0) {
          setSelectedService(data[0].name);
          setTriggerWorkload(data[0].name);
          setTriggerImage(data[0].image ?? "");
        }
      })
      .catch(() => {});
  }, [token]);

  const loadHistory = useCallback(() => {
    fetch(`${API_URL}/api/v1/webhooks/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token, triggerResult]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useLiveRefresh(["cicd", "microservice-registered", "live-sync"], loadHistory);

  const loadConfig = (workload: string) => {
    if (!workload) return;
    setLoadingConfig(true);
    fetch(`${API_URL}/api/v1/webhooks/config/${encodeURIComponent(workload)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { setConfig(data); setLoadingConfig(false); })
      .catch(() => setLoadingConfig(false));
  };

  useEffect(() => {
    if (selectedService) loadConfig(selectedService);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService]);

  const triggerDeploy = () => {
    if (!triggerWorkload || !triggerImage) return;
    setTriggering(true);
    fetch(`${API_URL}/api/v1/webhooks/deploy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AegisCloud-Token": triggerToken,
      },
      body: JSON.stringify({
        workload: triggerWorkload,
        image: triggerImage,
        replicas: triggerReplicas,
        pipeline: "manual-trigger",
        commitSha: Math.random().toString(16).slice(2, 9),
        branch: "main",
        trigger: "manual",
      }),
    })
      .then((r) => r.json())
      .then((data) => { setTriggerResult(data); setTriggering(false); })
      .catch(() => setTriggering(false));
  };

  const tabStyle = (active: boolean) => ({
    padding: "6px 14px",
    background: active ? "#1e3a5f" : "transparent",
    border: `1px solid ${active ? "#3b82f6" : "#1e293b"}`,
    borderRadius: 6,
    color: active ? "#93c5fd" : "#64748b",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>
          🔗 CI/CD Pipeline Integration
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          Connect your GitHub Actions, GitLab CI, or any webhook-capable pipeline to auto-deploy on every push.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Config panel */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", marginBottom: 16 }}>
            📋 Webhook Setup
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Workload</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 6, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            >
              {services.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {config && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>WEBHOOK URL</div>
                <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, padding: "8px 12px", fontFamily: "monospace", fontSize: 12, color: "#93c5fd", wordBreak: "break-all" }}>
                  {config.webhookUrl as string}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>REQUIRED HEADER</div>
                <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, padding: "8px 12px", fontFamily: "monospace", fontSize: 12, color: "#c4b5fd" }}>
                  X-AegisCloud-Token: {"<your-secret-token>"}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <button style={tabStyle(activeTab === "github")} onClick={() => setActiveTab("github")}>GitHub Actions</button>
                  <button style={tabStyle(activeTab === "gitlab")} onClick={() => setActiveTab("gitlab")}>GitLab CI</button>
                  <button style={tabStyle(activeTab === "curl")} onClick={() => setActiveTab("curl")}>cURL</button>
                </div>

                <div style={{ background: "#050d1a", border: "1px solid #1e293b", borderRadius: 8, padding: 12, maxHeight: 260, overflow: "auto" }}>
                  {activeTab === "github" && (
                    <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 11, color: "#a3cfff", whiteSpace: "pre-wrap" }}>
                      {config.githubActionsExample as string}
                    </pre>
                  )}
                  {activeTab === "gitlab" && (
                    <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 11, color: "#a3cfff", whiteSpace: "pre-wrap" }}>
                      {config.gitlabCiExample as string}
                    </pre>
                  )}
                  {activeTab === "curl" && (
                    <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 11, color: "#a3cfff", whiteSpace: "pre-wrap" }}>
{`curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-AegisCloud-Token: <your-token>" \\
  ${config.webhookUrl} \\
  -d '{
    "workload": "${selectedService}",
    "image": "your-registry/image:tag",
    "pipeline": "curl",
    "commitSha": "abc1234",
    "branch": "main",
    "trigger": "manual"
  }'`}
                    </pre>
                  )}
                </div>
              </div>

              <div style={{ background: "#0c1a0c", border: "1px solid #166534", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#86efac" }}>
                💡 {config.note as string}
              </div>
            </>
          )}
          {loadingConfig && <div style={{ color: "#64748b", fontSize: 13 }}>Loading…</div>}
        </div>

        {/* Manual trigger panel */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", marginBottom: 16 }}>
            ⚡ Manual Trigger
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
            Test the webhook endpoint directly without a CI/CD pipeline.
          </p>

          {[
            { label: "Workload", value: triggerWorkload, onChange: setTriggerWorkload, placeholder: "orders" },
            { label: "Image", value: triggerImage, onChange: setTriggerImage, placeholder: "kind-registry:5000/aegiscloud/sample-service:v2" },
            { label: "Token", value: triggerToken, onChange: setTriggerToken, placeholder: "dev-webhook-token" },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>{f.label}</label>
              <input
                type="text"
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                style={{ display: "block", width: "100%", marginTop: 4, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 12, boxSizing: "border-box" }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Replicas</label>
            <input
              type="number"
              min={1} max={10}
              value={triggerReplicas}
              onChange={(e) => setTriggerReplicas(Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 4, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 12, boxSizing: "border-box" }}
            />
          </div>

          <button
            onClick={triggerDeploy}
            disabled={triggering || !triggerWorkload || !triggerImage}
            style={{ width: "100%", padding: "9px", background: triggering ? "#334155" : "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            {triggering ? "Deploying…" : "🚀 Trigger Deploy"}
          </button>

          {triggerResult && (
            <div style={{ marginTop: 14, background: "#0a1628", border: `1px solid ${(triggerResult.succeeded as boolean) ? "#166534" : "#7f1d1d"}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, color: (triggerResult.succeeded as boolean) ? "#86efac" : "#fca5a5", marginBottom: 8 }}>
                {(triggerResult.succeeded as boolean) ? "✓ Deployed" : "✗ Failed"} — {triggerResult.status as string}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Steps taken:</div>
              {(triggerResult.steps as string[]).map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0" }}>→ {s}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline history */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", marginBottom: 14 }}>
          📜 Pipeline Deploy History
        </div>
        {history.length === 0 ? (
          <div style={{ color: "#334155", fontSize: 13, textAlign: "center", padding: 20 }}>
            No CI/CD deployments recorded yet. Trigger one above or connect your pipeline.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                {["Workload", "Image", "Pipeline", "Commit", "Result", "When"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: "#475569", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => {
                const m = h.metadata as Record<string, unknown>;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #0f172a" }}>
                    <td style={{ padding: "8px 10px", color: "#e2e8f0" }}>{m.workload as string ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>{String(m.image ?? "—").split("/").pop()}</td>
                    <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{m.pipeline as string ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b", fontFamily: "monospace" }}>{String(m.commitSha ?? "—").slice(0, 7)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ color: m.succeeded ? "#86efac" : "#fca5a5" }}>
                        {m.succeeded ? "✓ ok" : "✗ failed"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#475569", fontSize: 11 }}>
                      {new Date(h.at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

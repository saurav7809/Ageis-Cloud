import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "../components/LiveEvents";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function apiFetch(path: string, token: string) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

interface Target {
  id: string;
  label: string;
  serviceName: string;
  clusterName: string;
  namespace: string;
  replicas: number;
}

interface ManifestDoc {
  kind: string;
  name: string;
  namespace?: string;
  yaml: string;
}

const KIND_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Deployment: { color: "#4ade80",  bg: "#0a1f12", border: "#166534" },
  Service:    { color: "#fbbf24",  bg: "#1a1600", border: "#713f12" },
  ConfigMap:  { color: "#94a3b8",  bg: "#0d1117", border: "#1e2a3a" },
  Namespace:  { color: "#60a5fa",  bg: "#0a1628", border: "#1e3a5f" },
  HPA:        { color: "#c084fc",  bg: "#130b1f", border: "#6b21a8" },
  Secret:     { color: "#ff8a8d",  bg: "#1a0808", border: "#7f1d1d" },
  Ingress:    { color: "#818cf8",  bg: "#0f0e1f", border: "#3730a3" },
};

/** Build a Kubernetes Deployment YAML from what we know about the target */
function buildDeploymentYaml(t: Target): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${t.serviceName}
  namespace: ${t.namespace}
  labels:
    app: ${t.serviceName}
    app.kubernetes.io/managed-by: aegiscloud
    app.kubernetes.io/instance: ${t.label}
spec:
  replicas: ${t.replicas}
  selector:
    matchLabels:
      app: ${t.serviceName}
  template:
    metadata:
      labels:
        app: ${t.serviceName}
    spec:
      containers:
        - name: ${t.serviceName}
          image: <registered-image>
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
          env:
            - name: SERVICE_NAME
              value: "${t.serviceName}"`;
}

function buildServiceYaml(t: Target): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${t.serviceName}
  namespace: ${t.namespace}
  labels:
    app: ${t.serviceName}
    app.kubernetes.io/managed-by: aegiscloud
spec:
  type: ClusterIP
  selector:
    app: ${t.serviceName}
  ports:
    - name: http
      port: 80
      targetPort: 8080
      protocol: TCP`;
}

function buildHpaYaml(t: Target): string {
  return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${t.serviceName}-hpa
  namespace: ${t.namespace}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${t.serviceName}
  minReplicas: ${Math.max(1, Math.floor(t.replicas / 2))}
  maxReplicas: ${t.replicas * 3}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70`;
}

export function ManifestsPage({ token }: { token: string }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [selected, setSelected] = useState<Target | null>(null);
  const [activeTab, setActiveTab] = useState<string>("Deployment");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch("/api/v1/targets", token);
    if (Array.isArray(data)) setTargets(data);
    else if (data?.targets) setTargets(data.targets);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useLiveRefresh(["scaling", "live-sync", "microservice-registered"], load);


  // Build manifests for the selected target
  const docs: ManifestDoc[] = selected
    ? [
        { kind: "Deployment", name: selected.serviceName, namespace: selected.namespace, yaml: buildDeploymentYaml(selected) },
        { kind: "Service", name: selected.serviceName, namespace: selected.namespace, yaml: buildServiceYaml(selected) },
        { kind: "HPA", name: `${selected.serviceName}-hpa`, namespace: selected.namespace, yaml: buildHpaYaml(selected) },
      ]
    : [];

  const currentDoc = docs.find((d) => d.kind === activeTab) ?? docs[0];

  const allYaml = docs.map((d) => `# --- ${d.kind} ---\n${d.yaml}`).join("\n\n---\n\n");

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-head">
        <h1>K8s Manifests</h1>
        <p>View, copy, or download the Kubernetes YAML for any managed workload.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
        {/* Target list */}
        <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e2a3a", fontSize: 12, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Managed Workloads
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>Loading…</div>
          ) : targets.length === 0 ? (
            <div style={{ padding: 24, color: "#475569", fontSize: 13 }}>No managed workloads yet.</div>
          ) : (
            targets.map((t) => (
              <button key={t.id} onClick={() => { setSelected(t); setActiveTab("Deployment"); }} style={{
                width: "100%", textAlign: "left", padding: "12px 16px", border: "none",
                borderBottom: "1px solid #0f1623",
                background: selected?.id === t.id ? "#0f2a4a" : "transparent",
                cursor: "pointer", transition: "background 0.15s",
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: selected?.id === t.id ? "#60a5fa" : "#94a3b8" }}>
                  {t.serviceName}
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                  {t.clusterName} / {t.namespace}
                </div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 1 }}>
                  {t.replicas} replica{t.replicas !== 1 ? "s" : ""}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Manifest viewer */}
        <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, overflow: "hidden" }}>
          {!selected ? (
            <div style={{ padding: 48, textAlign: "center", color: "#475569" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 14 }}>Select a workload to view its Kubernetes manifests</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{
                padding: "14px 20px", borderBottom: "1px solid #1e2a3a",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{selected.serviceName}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{selected.namespace} · {selected.clusterName}</div>
                </div>
                <button onClick={() => handleCopy(allYaml)} style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid #1e2a3a",
                  background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 12,
                }}>
                  {copied ? "✓ Copied!" : "⧉ Copy all"}
                </button>
                <button onClick={() => handleDownload(allYaml, `${selected.serviceName}-manifests.yaml`)} style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid #1e3a5f",
                  background: "#0a1628", color: "#60a5fa", cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}>
                  ↓ Download
                </button>
              </div>

              {/* Kind tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #1e2a3a" }}>
                {docs.map((doc) => {
                  const style = KIND_STYLE[doc.kind] ?? KIND_STYLE.ConfigMap;
                  const active = activeTab === doc.kind;
                  return (
                    <button key={doc.kind} onClick={() => setActiveTab(doc.kind)} style={{
                      padding: "10px 20px", border: "none",
                      borderBottom: active ? `2px solid ${style.color}` : "2px solid transparent",
                      background: active ? style.bg : "transparent",
                      color: active ? style.color : "#64748b",
                      cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                    }}>
                      {doc.kind}
                    </button>
                  );
                })}
              </div>

              {/* YAML display */}
              {currentDoc && (
                <div style={{ position: "relative" }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 16px", background: "#080c14", borderBottom: "1px solid #1e2a3a",
                    fontSize: 11, color: "#475569",
                  }}>
                    <span style={{ fontFamily: "monospace" }}>
                      {currentDoc.kind} / {currentDoc.name}
                      {currentDoc.namespace && ` (${currentDoc.namespace})`}
                    </span>
                    <button onClick={() => handleCopy(currentDoc.yaml)} style={{
                      padding: "3px 10px", borderRadius: 5, border: "1px solid #1e2a3a",
                      background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 11,
                    }}>⧉ Copy</button>
                  </div>
                  <pre style={{
                    margin: 0, padding: 20, overflowX: "auto",
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12, lineHeight: 1.7,
                    color: "#94a3b8", background: "#080c14", maxHeight: 480,
                  }}>
                    {currentDoc.yaml.split("\n").map((line, i) => {
                      let color = "#94a3b8";
                      if (line.match(/^(apiVersion|kind|metadata|spec):/)) color = "#60a5fa";
                      else if (line.match(/^\s+(name|namespace|labels|selector|ports|containers|resources|env):/)) color = "#4ade80";
                      else if (line.match(/:\s*.+$/) && !line.trim().startsWith("-") && !line.trim().startsWith("#")) {
                        const val = line.split(":").slice(1).join(":").trim();
                        if (val && !val.endsWith(":")) color = "#fbbf24";
                      } else if (line.trim().startsWith("#")) color = "#475569";
                      return (
                        <span key={i} style={{ display: "block", color }}>
                          <span style={{ color: "#1e2a3a", userSelect: "none", marginRight: 16, minWidth: 28, display: "inline-block", textAlign: "right" }}>
                            {i + 1}
                          </span>
                          {line}
                        </span>
                      );
                    })}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

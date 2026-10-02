import { useState } from "react";
import { Badge, Card } from "../components/ui";

const PROVIDERS = [
  { id: "aws", name: "AWS EKS", icon: "☁️" },
  { id: "gcp", name: "GCP GKE", icon: "🌍" },
  { id: "azure", name: "Azure AKS", icon: "🏢" },
  { id: "onprem", name: "On-Premises", icon: "🖥️" },
];

export function ClusterOnboardingPage({ token }: { token: string }) {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState("aws");
  const [kubeconfig, setKubeconfig] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [namespaces, setNamespaces] = useState<string[]>(["default"]);
  const [newNamespace, setNewNamespace] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate connection validation
    setTimeout(() => {
      setIsConnecting(false);
      setConnectionStatus("success");
      setTimeout(() => setStep(3), 1000);
    }, 1500);
  };

  const handleDeployAgent = () => {
    setIsDeploying(true);
    const logs = [
      "Authenticating with cluster...",
      "Creating namespace aegiscloud-system...",
      "Deploying AegisCloud Agent daemonset...",
      "Setting up RBAC permissions...",
      "Agent pods running 3/3.",
      "Connection established! Waiting for first telemetry sync..."
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      setDeployLogs(prev => [...prev, logs[i]]);
      i++;
      if (i >= logs.length) {
        clearInterval(interval);
        setTimeout(() => setIsDeploying(false), 500);
      }
    }, 600);
  };

  return (
    <div>
      <div className="page-head">
        <h1>Connect a Cluster</h1>
        <p>Deploy the AegisCloud agent to your Kubernetes cluster to start tracking reliability and auto-healing services.</p>
      </div>

      <div style={{ display: "flex", gap: 32 }}>
        {/* Sidebar Steps */}
        <div style={{ width: 220, flexShrink: 0 }}>
          {[
            { num: 1, title: "Select Provider" },
            { num: 2, title: "Kubeconfig" },
            { num: 3, title: "Namespaces" },
            { num: 4, title: "Deploy Agent" },
          ].map(s => (
            <div key={s.num} style={{ 
              display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
              opacity: step >= s.num ? 1 : 0.4
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: step === s.num ? "#3b82f6" : step > s.num ? "#22d3a0" : "#1a2332",
                color: step > s.num ? "#000" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13
              }}>
                {step > s.num ? "✓" : s.num}
              </div>
              <div style={{
                fontWeight: step === s.num ? 700 : 500,
                color: step === s.num ? "#e8eef6" : "#8895aa"
              }}>
                {s.title}
              </div>
            </div>
          ))}
        </div>

        {/* Wizard Content */}
        <div style={{ flex: 1, background: "#0d1117", border: "1px solid #1a2332", borderRadius: 14, padding: 32 }}>
          
          {/* Step 1: Provider */}
          {step === 1 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Select your cloud provider</h2>
              <p style={{ color: "#8895aa", marginBottom: 24 }}>Choose where your Kubernetes cluster is hosted.</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => setProvider(p.id)} style={{
                    padding: 24, borderRadius: 12, border: `2px solid ${provider === p.id ? "#3b82f6" : "#1a2332"}`,
                    background: provider === p.id ? "rgba(59, 130, 246, 0.05)" : "#060810",
                    cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 16
                  }}>
                    <span style={{ fontSize: 28 }}>{p.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 15, color: "#e8eef6" }}>{p.name}</span>
                  </button>
                ))}
              </div>
              
              <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={() => setStep(2)}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 2: Kubeconfig */}
          {step === 2 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Connect via Kubeconfig</h2>
              <p style={{ color: "#8895aa", marginBottom: 24 }}>Paste your cluster's kubeconfig to establish a secure connection.</p>
              
              <textarea 
                value={kubeconfig} 
                onChange={e => setKubeconfig(e.target.value)}
                placeholder="apiVersion: v1&#10;clusters:&#10;- cluster:&#10;    certificate-authority-data: LS0t...&#10;    server: https://..."
                style={{
                  width: "100%", height: 240, background: "#060810", border: "1px solid #1a2332",
                  borderRadius: 8, padding: 16, color: "#e8eef6", fontFamily: "monospace",
                  fontSize: 12, resize: "none"
                }}
              />
              
              {connectionStatus === "success" && (
                <div style={{ marginTop: 16, padding: 12, background: "rgba(34, 211, 160, 0.1)", border: "1px solid #22d3a0", borderRadius: 8, color: "#22d3a0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>✓</span> Connection verified successfully.
                </div>
              )}
              
              <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between" }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleConnect} 
                  disabled={!kubeconfig || isConnecting || connectionStatus === "success"}
                >
                  {isConnecting ? "Validating..." : "Validate & Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Namespaces */}
          {step === 3 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Select namespaces to monitor</h2>
              <p style={{ color: "#8895aa", marginBottom: 24 }}>AegisCloud will only discover services and track SLOs within these namespaces.</p>
              
              <div style={{ background: "#060810", border: "1px solid #1a2332", borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {namespaces.map(ns => (
                    <div key={ns} style={{ 
                      padding: "4px 10px", background: "#1a2332", borderRadius: 16, 
                      fontSize: 13, display: "flex", alignItems: "center", gap: 6 
                    }}>
                      {ns}
                      <button onClick={() => setNamespaces(nsps => nsps.filter(n => n !== ns))} style={{ 
                        background: "transparent", border: "none", color: "#8895aa", cursor: "pointer", fontSize: 14 
                      }}>×</button>
                    </div>
                  ))}
                </div>
                
                <div style={{ display: "flex", gap: 8 }}>
                  <input 
                    value={newNamespace} 
                    onChange={e => setNewNamespace(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newNamespace) {
                        setNamespaces([...namespaces, newNamespace]);
                        setNewNamespace("");
                      }
                    }}
                    placeholder="Add namespace..."
                    style={{ flex: 1, padding: "8px 12px", background: "transparent", border: "1px solid #243044", borderRadius: 6, color: "#e8eef6", fontSize: 13 }}
                  />
                  <button onClick={() => {
                    if (newNamespace) {
                      setNamespaces([...namespaces, newNamespace]);
                      setNewNamespace("");
                    }
                  }} className="btn btn-ghost">Add</button>
                </div>
              </div>
              
              <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between" }}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-primary" onClick={() => setStep(4)} disabled={namespaces.length === 0}>Continue</button>
              </div>
            </div>
          )}

          {/* Step 4: Deploy Agent */}
          {step === 4 && (
            <div className="fade-in">
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Deploy AegisCloud Agent</h2>
              <p style={{ color: "#8895aa", marginBottom: 24 }}>The agent runs as a daemonset to collect telemetry, execute chaos experiments, and perform auto-healing.</p>
              
              {!deployLogs.length ? (
                <div style={{ textAlign: "center", padding: 40, border: "1px dashed #243044", borderRadius: 8 }}>
                  <button className="btn btn-primary" onClick={handleDeployAgent} style={{ fontSize: 16, padding: "12px 24px" }}>
                    🚀 Deploy Agent to Cluster
                  </button>
                </div>
              ) : (
                <div style={{ background: "#060810", border: "1px solid #1a2332", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 13, color: "#a5b4fc", height: 200, overflowY: "auto" }}>
                  {deployLogs.map((log, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <span style={{ color: "#4d5d72" }}>{new Date().toISOString().substring(11, 19)}</span> {log}
                    </div>
                  ))}
                  {isDeploying && <div style={{ color: "#4d5d72", marginTop: 8 }}>█</div>}
                </div>
              )}
              
              {deployLogs.length > 0 && !isDeploying && (
                <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-primary" onClick={() => window.location.href = "/"}>Go to Dashboard</button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

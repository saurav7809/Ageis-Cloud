import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  return r.ok ? r.json() : null;
}

const CHANNELS = [
  { id: "slack",      label: "Slack",      icon: "💬", desc: "Post alerts to a Slack channel via incoming webhook." },
  { id: "email",      label: "Email",      icon: "📧", desc: "Send email digests and critical alert notifications." },
  { id: "pagerduty",  label: "PagerDuty",  icon: "📟", desc: "Escalate CRITICAL alerts to PagerDuty on-call rotation." },
  { id: "webhook",    label: "Webhook",    icon: "🔗", desc: "POST alert payloads to any custom HTTP endpoint." },
];

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

interface Config {
  slack:     { enabled: boolean; url: string; channel: string; severities: string[] };
  email:     { enabled: boolean; to: string; severities: string[] };
  pagerduty: { enabled: boolean; integrationKey: string; severities: string[] };
  webhook:   { enabled: boolean; url: string; secret: string; severities: string[] };
}

const DEFAULT: Config = {
  slack:     { enabled: false, url: "", channel: "#alerts", severities: ["CRITICAL", "HIGH"] },
  email:     { enabled: false, to: "", severities: ["CRITICAL"] },
  pagerduty: { enabled: false, integrationKey: "", severities: ["CRITICAL"] },
  webhook:   { enabled: false, url: "", secret: "", severities: ["CRITICAL", "HIGH", "MEDIUM"] },
};

const LS_KEY = "aegiscloud_notif_config";

function loadSaved(): Config {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "null") ?? DEFAULT; }
  catch { return DEFAULT; }
}

function SeverityToggle({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {SEVERITIES.map((s) => {
        const on = value.includes(s);
        const color = s === "CRITICAL" ? "#f43f5e" : s === "HIGH" ? "#fb923c" : s === "MEDIUM" ? "#f59e0b" : "#22d3a0";
        return (
          <button key={s} onClick={() => onChange(on ? value.filter(x => x !== s) : [...value, s])} style={{
            padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
            border: `1px solid ${on ? color : "#1a2332"}`,
            background: on ? `${color}18` : "transparent",
            color: on ? color : "#4d5d72", cursor: "pointer", transition: "all 0.15s",
          }}>{s}</button>
        );
      })}
    </div>
  );
}

export function NotificationsPage({ token }: { token: string }) {
  const [cfg, setCfg] = useState<Config>(loadSaved);
  const [active, setActive] = useState("slack");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [aiHealth, setAiHealth] = useState<{ reachable: boolean; detail?: string } | null>(null);

  useEffect(() => { apiFetch("/api/v1/ai/health", token).then(d => d && setAiHealth(d)); }, [token]);

  const update = (channel: keyof Config, patch: Partial<Config[typeof channel]>) => {
    setCfg(prev => ({ ...prev, [channel]: { ...prev[channel], ...patch } } as Config));
    setSaved(false);
    setTestResult(null);
  };

  const save = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const sendTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Simulate a test alert via the alert sweep endpoint
    const r = await apiFetch("/api/v1/alerts/sweep", token, { method: "POST" });
    setTesting(false);
    setTestResult(r ? "✓ Alert sweep triggered — check your configured channels." : "⚠ Could not reach backend.");
  };

  const ch = active as keyof Config;
  const current = cfg[ch] as any;

  return (
    <div>
      <div className="page-head">
        <h1>Notifications</h1>
        <p>Configure alert routing to Slack, email, PagerDuty, or custom webhooks.</p>
      </div>

      {/* AI Service status banner */}
      {aiHealth && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          padding: "12px 18px", borderRadius: 12,
          background: aiHealth.reachable ? "#0a1f12" : "#1a1205",
          border: `1px solid ${aiHealth.reachable ? "#166534" : "#713f12"}`,
        }}>
          <span style={{ fontSize: 18 }}>{aiHealth.reachable ? "🤖" : "⚠️"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: aiHealth.reachable ? "#4ade80" : "#fbbf24" }}>
              AI Analysis Service — {aiHealth.reachable ? "Online" : "Offline"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {aiHealth.reachable
                ? "Anomaly detection, latency forecasting and incident re-ranking are available."
                : (aiHealth.detail ?? "The Python AI sidecar is not running. Platform works without it.")}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
        {/* Channel list */}
        <div style={{ background: "#0d1117", border: "1px solid #1a2332", borderRadius: 12, overflow: "hidden" }}>
          {CHANNELS.map(c => {
            const enabled = (cfg[c.id as keyof Config] as any).enabled;
            return (
              <button key={c.id} onClick={() => setActive(c.id)} style={{
                width: "100%", textAlign: "left", padding: "14px 16px",
                border: "none", borderBottom: "1px solid #0f1623",
                background: active === c.id ? "#0f2a4a" : "transparent",
                cursor: "pointer", transition: "background 0.15s",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: active === c.id ? "#60a5fa" : "#94a3b8" }}>
                    {c.label}
                  </div>
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: enabled ? "#22d3a0" : "#1a2332",
                  boxShadow: enabled ? "0 0 6px #22d3a0" : "none",
                }} />
              </button>
            );
          })}
        </div>

        {/* Config panel */}
        <div style={{ background: "#0d1117", border: "1px solid #1a2332", borderRadius: 12, padding: 24 }}>
          {(() => {
            const meta = CHANNELS.find(c => c.id === active)!;
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 28 }}>{meta.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#e8eef6" }}>{meta.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{meta.desc}</div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {current.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <button onClick={() => update(ch, { enabled: !current.enabled } as any)} style={{
                      width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
                      background: current.enabled ? "#3b82f6" : "#1a2332",
                      position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{
                        position: "absolute", top: 3,
                        left: current.enabled ? 21 : 3,
                        width: 18, height: 18, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s",
                      }} />
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Slack */}
                  {active === "slack" && (
                    <>
                      <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                        Webhook URL
                        <input value={current.url} onChange={e => update("slack", { url: e.target.value })}
                          placeholder="https://hooks.slack.com/services/T.../B.../..."
                          style={{ display: "block", width: "100%", marginTop: 6, padding: "9px 12px", background: "#060810", border: "1px solid #1a2332", borderRadius: 8, color: "#e8eef6", fontSize: 13, boxSizing: "border-box" }} />
                      </label>
                      <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                        Channel
                        <input value={current.channel} onChange={e => update("slack", { channel: e.target.value })}
                          placeholder="#platform-alerts"
                          style={{ display: "block", width: "100%", marginTop: 6, padding: "9px 12px", background: "#060810", border: "1px solid #1a2332", borderRadius: 8, color: "#e8eef6", fontSize: 13, boxSizing: "border-box" }} />
                      </label>
                    </>
                  )}
                  {/* Email */}
                  {active === "email" && (
                    <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                      Recipients (comma-separated)
                      <input value={current.to} onChange={e => update("email", { to: e.target.value })}
                        placeholder="ops@company.com, oncall@company.com"
                        style={{ display: "block", width: "100%", marginTop: 6, padding: "9px 12px", background: "#060810", border: "1px solid #1a2332", borderRadius: 8, color: "#e8eef6", fontSize: 13, boxSizing: "border-box" }} />
                    </label>
                  )}
                  {/* PagerDuty */}
                  {active === "pagerduty" && (
                    <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                      Integration Key
                      <input value={current.integrationKey} onChange={e => update("pagerduty", { integrationKey: e.target.value })}
                        placeholder="a1b2c3d4e5f6..."
                        type="password"
                        style={{ display: "block", width: "100%", marginTop: 6, padding: "9px 12px", background: "#060810", border: "1px solid #1a2332", borderRadius: 8, color: "#e8eef6", fontSize: 13, boxSizing: "border-box" }} />
                    </label>
                  )}
                  {/* Webhook */}
                  {active === "webhook" && (
                    <>
                      <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                        Endpoint URL
                        <input value={current.url} onChange={e => update("webhook", { url: e.target.value })}
                          placeholder="https://api.myapp.com/aegiscloud-alerts"
                          style={{ display: "block", width: "100%", marginTop: 6, padding: "9px 12px", background: "#060810", border: "1px solid #1a2332", borderRadius: 8, color: "#e8eef6", fontSize: 13, boxSizing: "border-box" }} />
                      </label>
                      <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                        HMAC Secret (optional)
                        <input value={current.secret} onChange={e => update("webhook", { secret: e.target.value })}
                          placeholder="Signing secret for X-AegisCloud-Signature"
                          type="password"
                          style={{ display: "block", width: "100%", marginTop: 6, padding: "9px 12px", background: "#060810", border: "1px solid #1a2332", borderRadius: 8, color: "#e8eef6", fontSize: 13, boxSizing: "border-box" }} />
                      </label>
                    </>
                  )}

                  {/* Severity filter */}
                  <div>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>
                      Notify on severities
                    </div>
                    <SeverityToggle value={current.severities} onChange={v => update(ch, { severities: v } as any)} />
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button onClick={save} style={{
                      padding: "9px 20px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                      background: saved ? "#166534" : "linear-gradient(135deg, #3b82f6, #6366f1)",
                      color: "#fff", transition: "all 0.2s",
                    }}>{saved ? "✓ Saved" : "Save"}</button>
                    <button onClick={sendTest} disabled={testing} style={{
                      padding: "9px 20px", borderRadius: 9, border: "1px solid #1a2332",
                      background: "transparent", color: "#8895aa", cursor: "pointer", fontSize: 13,
                    }}>{testing ? "Testing…" : "Test alert"}</button>
                  </div>

                  {testResult && (
                    <div style={{ padding: "10px 14px", borderRadius: 8, background: "#0a1628", border: "1px solid #1e3a5f", fontSize: 13, color: "#93c5fd" }}>
                      {testResult}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Payload preview */}
      <div style={{ marginTop: 20, background: "#0d1117", border: "1px solid #1a2332", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #1a2332", fontSize: 12, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Example Alert Payload
        </div>
        <pre style={{ margin: 0, padding: 20, fontFamily: "monospace", fontSize: 12, color: "#8895aa", background: "#080c14", overflowX: "auto", lineHeight: 1.7 }}>
{`{
  "id":        "3f2a1b...",
  "severity":  "CRITICAL",
  "title":     "catlog p95 latency breached SLO",
  "service":   "catlog",
  "cluster":   "aegiscloud-local",
  "namespace": "aegiscloud-live",
  "value":     312.4,
  "threshold": 250.0,
  "openedAt":  "${new Date().toISOString()}",
  "runbook":   "https://wiki/catlog-latency-slo",
  "platform":  "AegisCloud v0.3.0"
}`}
        </pre>
      </div>
    </div>
  );
}

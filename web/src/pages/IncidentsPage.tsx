import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "../components/LiveEvents";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!r.ok) return null;
  return r.json();
}

interface Alert {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  message: string;
  openedAt: string;
  targetLabel: string;
  serviceName: string;
  clusterName: string;
  namespace: string;
  resolvedAt: string | null;
}

interface HealingEvent {
  id: string;
  podName: string;
  reason: string;
  actionTaken: string;
  detectedAt: string;
  resolvedAt: string | null;
  targetLabel: string;
  serviceName: string;
  clusterName: string;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  CRITICAL: { color: "#ff8a8d", bg: "#1a0a0a", border: "#7f1d1d", icon: "🔴" },
  HIGH:     { color: "#fb923c", bg: "#1a1005", border: "#78350f", icon: "🟠" },
  MEDIUM:   { color: "#fbbf24", bg: "#1a1600", border: "#713f12", icon: "🟡" },
  LOW:      { color: "#94a3b8", bg: "#0d1117", border: "#1e2a3a", icon: "⚪" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  OPEN:         { color: "#ff8a8d", label: "Open" },
  ACKNOWLEDGED: { color: "#fbbf24", label: "Acknowledged" },
  RESOLVED:     { color: "#4ade80", label: "Resolved" },
};

const REASON_ICON: Record<string, string> = {
  CRASH_LOOP:    "💥",
  OOM_KILLED:    "💾",
  NOT_READY:     "⏳",
  LIVENESS_FAIL: "❤️",
  NODE_PRESSURE: "📊",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function duration(start: string, end: string | null): string {
  if (!end) return "ongoing";
  const s = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function IncidentsPage({ token }: { token: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [healing, setHealing] = useState<HealingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "OPEN" | "ACKNOWLEDGED" | "RESOLVED">("all");
  const [activeTab, setActiveTab] = useState<"alerts" | "healing">("alerts");

  const load = useCallback(async () => {
    setLoading(true);
    const [alertData, healData] = await Promise.all([
      apiFetch("/api/v1/alerts", token),
      apiFetch("/api/v1/control-plane/healing-events", token),
    ]);
    if (Array.isArray(alertData)) setAlerts(alertData);
    else if (alertData?.alerts) setAlerts(alertData.alerts);
    if (Array.isArray(healData)) setHealing(healData);
    else if (healData?.events) setHealing(healData.events);
    setLoading(false);
  }, [token]);

  const acknowledge = async (id: string) => {
    await apiFetch(`/api/v1/alerts/${id}/acknowledge`, token, { method: "POST" });
    load();
  };

  const resolve = async (id: string) => {
    await apiFetch(`/api/v1/alerts/${id}/resolve`, token, { method: "POST" });
    load();
  };

  useEffect(() => { load(); }, [load]);

  useLiveRefresh(["alert", "healing", "incident", "live-sync"], load);

  const filteredAlerts = alerts.filter((a) => {
    if (filter !== "all" && a.severity !== filter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const openCount = alerts.filter((a) => a.status === "OPEN").length;
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" && a.status === "OPEN").length;
  const unresolvedHealing = healing.filter((h) => !h.resolvedAt).length;

  return (
    <div>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Incidents & Healing</h1>
          <p>Active alerts, self-healing events, and root cause analysis across your fleet.</p>
        </div>
        <button onClick={load} style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid #1e2a3a",
          background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13,
        }}>⟳ Refresh</button>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Open Alerts", value: openCount, color: openCount > 0 ? "#ff8a8d" : "#4ade80", icon: "🚨" },
          { label: "Critical", value: criticalCount, color: criticalCount > 0 ? "#ff8a8d" : "#4ade80", icon: "🔴" },
          { label: "Healing Active", value: unresolvedHealing, color: unresolvedHealing > 0 ? "#fbbf24" : "#4ade80", icon: "🔧" },
          { label: "Resolved (24h)", value: alerts.filter((a) => a.status === "RESOLVED").length, color: "#4ade80", icon: "✅" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12,
            padding: "16px 20px", display: "flex", alignItems: "center", gap: 12
          }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #1e2a3a" }}>
        {(["alerts", "healing"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "10px 24px", border: "none", background: "transparent", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            color: activeTab === tab ? "#60a5fa" : "#64748b",
            borderBottom: activeTab === tab ? "2px solid #60a5fa" : "2px solid transparent",
          }}>
            {tab === "alerts" ? `🚨 Alerts (${alerts.length})` : `🔧 Self-Healing (${healing.length})`}
          </button>
        ))}
      </div>

      {/* Alerts tab */}
      {activeTab === "alerts" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {(["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 12px", borderRadius: 99, border: "1px solid",
                borderColor: filter === f ? "#2563eb" : "#1e2a3a",
                background: filter === f ? "#172554" : "transparent",
                color: filter === f ? "#93c5fd" : "#64748b",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>
                {f === "all" ? "All Severities" : f}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {(["all", "OPEN", "ACKNOWLEDGED", "RESOLVED"] as const).map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{
                padding: "5px 12px", borderRadius: 99, border: "1px solid",
                borderColor: statusFilter === f ? "#7c3aed" : "#1e2a3a",
                background: statusFilter === f ? "#2d1b69" : "transparent",
                color: statusFilter === f ? "#c4b5fd" : "#64748b",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>
                {f === "all" ? "All Status" : STATUS_CONFIG[f]?.label ?? f}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: "#64748b" }}>Loading incidents…</div>
          ) : filteredAlerts.length === 0 ? (
            <div style={{
              textAlign: "center", padding: 48, background: "#0d1117",
              border: "1px solid #1e2a3a", borderRadius: 12, color: "#4ade80"
            }}>
              ✅ No incidents match the current filter.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredAlerts.map((alert) => {
                const sv = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.LOW;
                const st = STATUS_CONFIG[alert.status];
                return (
                  <div key={alert.id} style={{
                    background: sv.bg, border: `1px solid ${sv.border}`,
                    borderRadius: 12, padding: "16px 20px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <span style={{ fontSize: 20, marginTop: 2 }}>{sv.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: sv.color }}>{alert.message}</span>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 99,
                            background: "#0d1117", border: `1px solid ${sv.border}`, color: sv.color,
                          }}>{alert.severity}</span>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 99,
                            color: st.color, background: "#0d1117", border: "1px solid #1e2a3a",
                          }}>● {st.label}</span>
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                          <span>🏷 {alert.serviceName}</span>
                          <span>☁️ {alert.clusterName}</span>
                          <span>📁 {alert.namespace}</span>
                          <span>🕐 {timeAgo(alert.openedAt)}</span>
                          {alert.resolvedAt && <span>⏱ resolved in {duration(alert.openedAt, alert.resolvedAt)}</span>}
                        </div>
                      {alert.status !== "RESOLVED" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          {alert.status === "OPEN" && (
                            <button onClick={() => acknowledge(alert.id)} style={{
                              padding: "4px 12px", borderRadius: 6, border: "1px solid #713f12",
                              background: "#1a1205", color: "#fbbf24", cursor: "pointer", fontSize: 12
                            }}>Acknowledge</button>
                          )}
                          <button onClick={() => resolve(alert.id)} style={{
                            padding: "4px 12px", borderRadius: 6, border: "1px solid #166534",
                            background: "#0a1f12", color: "#4ade80", cursor: "pointer", fontSize: 12
                          }}>Resolve</button>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Healing tab */}
      {activeTab === "healing" && (
        loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#64748b" }}>Loading healing events…</div>
        ) : healing.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 48, background: "#0d1117",
            border: "1px solid #1e2a3a", borderRadius: 12, color: "#4ade80"
          }}>
            ✅ No self-healing events recorded yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {healing.map((ev) => {
              const resolved = !!ev.resolvedAt;
              return (
                <div key={ev.id} style={{
                  background: resolved ? "#0a1f12" : "#1a1205",
                  border: `1px solid ${resolved ? "#166534" : "#713f12"}`,
                  borderRadius: 12, padding: "16px 20px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ fontSize: 20 }}>{REASON_ICON[ev.reason] ?? "🔧"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: resolved ? "#86efac" : "#fbbf24" }}>
                          {ev.podName}
                        </span>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 99,
                          background: "#0d1117", border: "1px solid #1e2a3a", color: "#f59e0b",
                        }}>{ev.reason.replace(/_/g, " ")}</span>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 99,
                          background: "#0d1117", border: "1px solid #1e2a3a", color: "#60a5fa",
                        }}>→ {ev.actionTaken}</span>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 700,
                          background: resolved ? "#0a1f12" : "#1a1205",
                          border: `1px solid ${resolved ? "#166534" : "#713f12"}`,
                          color: resolved ? "#4ade80" : "#fbbf24",
                        }}>{resolved ? "✓ Resolved" : "⟳ Active"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                        <span>🏷 {ev.serviceName}</span>
                        <span>☁️ {ev.clusterName}</span>
                        <span>🕐 detected {timeAgo(ev.detectedAt)}</span>
                        {ev.resolvedAt && <span>⏱ took {duration(ev.detectedAt, ev.resolvedAt)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

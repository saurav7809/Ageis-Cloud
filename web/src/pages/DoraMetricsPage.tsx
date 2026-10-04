import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "../components/LiveEvents";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface DoraMetrics {
  deploymentFrequency: { label: string; value: string; trend: string; rating: string };
  leadTimeForChanges: { label: string; value: string; trend: string; rating: string };
  changeFailureRate: { label: string; value: string; trend: string; rating: string };
  mttr: { label: string; value: string; trend: string; rating: string };
  level: "ELITE" | "HIGH" | "MEDIUM" | "LOW";
  totalDeployments: number;
  successfulDeployments: number;
  totalIncidents: number;
  resolvedIncidents: number;
  avgRecoveryMinutes: number;
  deploymentsByDay: { date: string; count: number }[];
  recentDeployments: { service: string; image: string; at: string; status: string }[];
}

const LEVEL_CONFIG = {
  ELITE:  { color: "#22d3a0", bg: "#0a1f17", border: "#166534", icon: "🏆", desc: "World-class engineering org" },
  HIGH:   { color: "#60a5fa", bg: "#0a1628", border: "#1e3a5f", icon: "⭐", desc: "High-performing team" },
  MEDIUM: { color: "#fbbf24", bg: "#1a1600", border: "#713f12", icon: "📈", desc: "Room for improvement" },
  LOW:    { color: "#f43f5e", bg: "#1a0808", border: "#7f1d1d", icon: "⚠️",  desc: "Needs significant work" },
};

const RATING_COLOR: Record<string, string> = {
  ELITE: "#22d3a0", HIGH: "#60a5fa", MEDIUM: "#fbbf24", LOW: "#f43f5e",
};

function SparkBar({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48 }}>
      {days.map((d, i) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={i} title={`${d.date}: ${d.count} deploy(s)`} style={{
            flex: 1,
            height: `${Math.max(pct, 4)}%`,
            background: pct > 60 ? "#22d3a0" : pct > 30 ? "#60a5fa" : "#334155",
            borderRadius: "2px 2px 0 0",
            transition: "height 0.4s",
            cursor: "default",
          }} />
        );
      })}
    </div>
  );
}

function MetricCard({
  label, value, trend, rating, desc,
}: { label: string; value: string; trend: string; rating: string; desc: string }) {
  const color = RATING_COLOR[rating] ?? "#94a3b8";
  const up = trend.startsWith("+");
  return (
    <div style={{
      background: "#0d1117", border: `1px solid ${color}30`,
      borderRadius: 14, padding: "20px 22px",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: "#4d5d72", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: color + "20", color, border: `1px solid ${color}40`,
        }}>{rating}</span>
        <span style={{ fontSize: 11, color: up ? "#22d3a0" : "#f43f5e" }}>{trend}</span>
      </div>
      <div style={{ fontSize: 11, color: "#4d5d72", marginTop: 6 }}>{desc}</div>
    </div>
  );
}

function buildDoraFromRawData(scaling: any[], healing: any[], alerts: any[]): DoraMetrics {
  const now = Date.now();
  const dayMs = 86_400_000;
  const last30 = now - 30 * dayMs;

  // Deployments = scaling events in last 30 days
  const recentScaling = scaling.filter((s) => new Date(s.at ?? s.createdAt ?? 0).getTime() > last30);
  const totalDeployments = recentScaling.length;
  const deployFreqPerDay = totalDeployments / 30;

  // Deployment frequency rating
  let dfRating = "LOW", dfValue = `${deployFreqPerDay.toFixed(1)}/day`;
  if (deployFreqPerDay >= 3) dfRating = "ELITE";
  else if (deployFreqPerDay >= 1) dfRating = "HIGH";
  else if (deployFreqPerDay >= 0.1) dfRating = "MEDIUM";

  // MTTR from healing events
  const resolved = healing.filter((h) => h.resolvedAt);
  const avgRecovery = resolved.length > 0
    ? resolved.reduce((acc, h) => {
        const dur = (new Date(h.resolvedAt).getTime() - new Date(h.detectedAt).getTime()) / 60000;
        return acc + dur;
      }, 0) / resolved.length
    : 0;

  let mttrRating = "LOW";
  let mttrValue = avgRecovery < 1 ? "<1m" : avgRecovery < 60 ? `${Math.round(avgRecovery)}m` : `${(avgRecovery / 60).toFixed(1)}h`;
  if (avgRecovery < 60) mttrRating = "ELITE";
  else if (avgRecovery < 240) mttrRating = "HIGH";
  else if (avgRecovery < 1440) mttrRating = "MEDIUM";

  // Change failure rate from alerts
  const openAlerts = alerts.filter((a) => a.status === "OPEN" || a.status === "ACKNOWLEDGED").length;
  const cfr = totalDeployments > 0 ? Math.min((openAlerts / Math.max(totalDeployments, 1)) * 100, 100) : 0;
  let cfrRating = "LOW", cfrValue = `${cfr.toFixed(1)}%`;
  if (cfr < 5) cfrRating = "ELITE";
  else if (cfr < 10) cfrRating = "HIGH";
  else if (cfr < 30) cfrRating = "MEDIUM";

  // Level
  const ratings = [dfRating, mttrRating, cfrRating];
  const level = ratings.every(r => r === "ELITE") ? "ELITE"
    : ratings.filter(r => r === "ELITE" || r === "HIGH").length >= 2 ? "HIGH"
    : ratings.filter(r => r === "MEDIUM" || r === "HIGH" || r === "ELITE").length >= 2 ? "MEDIUM"
    : "LOW";

  // Deployments by day (last 14)
  const deploymentsByDay = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now - (13 - i) * dayMs);
    const dateStr = date.toISOString().slice(0, 10);
    const count = recentScaling.filter((s) => (s.at ?? s.createdAt ?? "").startsWith(dateStr)).length;
    return { date: dateStr.slice(5), count };
  });

  const recentDeployments = recentScaling.slice(0, 8).map((s) => ({
    service: s.targetLabel ?? s.workload ?? "unknown",
    image: s.newImage ?? s.action ?? "scale",
    at: s.at ?? s.createdAt ?? "",
    status: s.status ?? "COMPLETED",
  }));

  return {
    deploymentFrequency: { label: "Deployment Frequency", value: dfValue, trend: `+${totalDeployments} in 30d`, rating: dfRating },
    leadTimeForChanges: { label: "Lead Time for Changes", value: "~2h", trend: "estimated", rating: "HIGH" },
    changeFailureRate: { label: "Change Failure Rate", value: cfrValue, trend: `${openAlerts} open alerts`, rating: cfrRating },
    mttr: { label: "Mean Time to Recover", value: mttrValue, trend: `${resolved.length} resolved`, rating: mttrRating },
    level: level as "ELITE" | "HIGH" | "MEDIUM" | "LOW",
    totalDeployments,
    successfulDeployments: Math.max(0, totalDeployments - openAlerts),
    totalIncidents: healing.length,
    resolvedIncidents: resolved.length,
    avgRecoveryMinutes: Math.round(avgRecovery),
    deploymentsByDay,
    recentDeployments,
  };
}

function timeAgo(iso: string): string {
  if (!iso) return "-";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function DoraMetricsPage({ token }: { token: string }) {
  const [metrics, setMetrics] = useState<DoraMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [scalingRes, healingRes, alertsRes] = await Promise.all([
        fetch(`${API}/api/v1/control-plane/scaling-events`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/control-plane/healing-events`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/v1/alerts`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [scaling, healing, alerts] = await Promise.all([
        scalingRes.json(), healingRes.json(), alertsRes.json(),
      ]);
      const s = Array.isArray(scaling) ? scaling : [];
      const h = Array.isArray(healing) ? healing : (healing?.events ?? []);
      const a = Array.isArray(alerts) ? alerts : (alerts?.alerts ?? []);
      setMetrics(buildDoraFromRawData(s, h, a));
    } catch { /* show stale */ } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(["scaling", "healing", "alert", "live-sync"], load);

  const level = metrics?.level ?? "MEDIUM";
  const cfg = LEVEL_CONFIG[level];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>DORA Metrics</h1>
          <p>Four key engineering performance indicators that predict software delivery and reliability.</p>
        </div>
        {metrics && (
          <div style={{
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 12, padding: "10px 18px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 24 }}>{cfg.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>{level} PERFORMER</div>
              <div style={{ fontSize: 11, color: "#4d5d72" }}>{cfg.desc}</div>
            </div>
          </div>
        )}
      </div>

      {loading && !metrics && (
        <div style={{ textAlign: "center", padding: 60, color: "#4d5d72" }}>Loading DORA metrics…</div>
      )}

      {metrics && (
        <>
          {/* 4 DORA cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <MetricCard {...metrics.deploymentFrequency} desc="How often you deploy to production" />
            <MetricCard {...metrics.leadTimeForChanges} desc="Commit to production time" />
            <MetricCard {...metrics.changeFailureRate} desc="% of deployments causing incidents" />
            <MetricCard {...metrics.mttr} desc="Time to restore service after incident" />
          </div>

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { label: "Total Deployments", value: metrics.totalDeployments, color: "#60a5fa" },
              { label: "Successful", value: metrics.successfulDeployments, color: "#22d3a0" },
              { label: "Total Incidents", value: metrics.totalIncidents, color: "#f43f5e" },
              { label: "Resolved", value: metrics.resolvedIncidents, color: "#22d3a0" },
              { label: "Avg Recovery", value: metrics.avgRecoveryMinutes > 0 ? `${metrics.avgRecoveryMinutes}m` : "N/A", color: "#fbbf24" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#0d1117", border: "1px solid #1a2332", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#4d5d72", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Deployment frequency chart */}
          <div style={{ background: "#0d1117", border: "1px solid #1a2332", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 16 }}>
              📦 Deployment Frequency — Last 14 Days
            </div>
            <SparkBar days={metrics.deploymentsByDay} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4d5d72", marginTop: 6 }}>
              <span>{metrics.deploymentsByDay[0]?.date}</span>
              <span>{metrics.deploymentsByDay[6]?.date}</span>
              <span>{metrics.deploymentsByDay[13]?.date}</span>
            </div>
          </div>

          {/* Recent deployments */}
          <div style={{ background: "#0d1117", border: "1px solid #1a2332", borderRadius: 14, padding: "20px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 16 }}>
              🚀 Recent Deployments
            </div>
            {metrics.recentDeployments.length === 0 ? (
              <div style={{ color: "#4d5d72", fontSize: 13, textAlign: "center", padding: 24 }}>No deployments recorded yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a2332" }}>
                    {["Service", "Action / Image", "When", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#4d5d72", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentDeployments.map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0d1117", background: i % 2 === 0 ? "#0a1117" : "transparent" }}>
                      <td style={{ padding: "10px 12px", color: "#e2e8f0", fontWeight: 600 }}>{d.service}</td>
                      <td style={{ padding: "10px 12px", color: "#60a5fa", fontFamily: "monospace", fontSize: 12 }}>{d.image}</td>
                      <td style={{ padding: "10px 12px", color: "#4d5d72" }}>{timeAgo(d.at)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          background: d.status === "COMPLETED" ? "#22d3a020" : "#f43f5e20",
                          color: d.status === "COMPLETED" ? "#22d3a0" : "#f43f5e",
                          border: `1px solid ${d.status === "COMPLETED" ? "#22d3a040" : "#f43f5e40"}`,
                          padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        }}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* DORA reference */}
          <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: "18px 24px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 12 }}>📚 DORA Performance Levels Reference</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {(["ELITE", "HIGH", "MEDIUM", "LOW"] as const).map((lvl) => {
                const c = LEVEL_CONFIG[lvl];
                return (
                  <div key={lvl} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, color: c.color, fontSize: 12 }}>{c.icon} {lvl}</div>
                    <div style={{ fontSize: 11, color: "#4d5d72", marginTop: 4 }}>{c.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

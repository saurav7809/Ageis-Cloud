import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "../components/LiveEvents";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface DataPoint { time: string; value: number; }
interface WorkloadMetrics {
  workload: string;
  namespace: string;
  cluster: string;
  image: string;
  desiredReplicas: number;
  readyReplicas: number;
  health: string;
  cpuUtilizationPct: number | null;
  availabilityPct: number;
  latencyP95Ms: number;
  errorRatePct: number;
  reliabilityScore: number;
  totalDeployments: number;
  failedDeployments: number;
  availabilityTrend: DataPoint[];
  latencyTrend: DataPoint[];
  replicaTrend: DataPoint[];
  lastDeployedAt: string | null;
  lastImage: string;
}

interface Summary {
  totalWorkloads: number;
  healthy: number;
  degraded: number;
  down: number;
  avgAvailabilityPct: number;
  avgLatencyP95Ms: number;
}

function Sparkline({ points, color, height = 36 }: { points: DataPoint[]; color: string; height?: number }) {
  if (points.length < 2) return <div style={{ height, background: "#0f172a", borderRadius: 4 }} />;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = height;
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.value - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={points.length > 0 ? (120) : 0} cy={h - ((values[values.length - 1] - min) / range) * (h - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

function HealthBadge({ health }: { health: string }) {
  const color: Record<string, string> = {
    HEALTHY: "#22c55e",
    DEGRADED: "#f59e0b",
    DOWN: "#ef4444",
    MISSING: "#6b7280",
  };
  return (
    <span style={{
      background: (color[health] ?? "#6b7280") + "22",
      color: color[health] ?? "#9ca3af",
      border: `1px solid ${(color[health] ?? "#6b7280")}44`,
      padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600
    }}>
      {health}
    </span>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  return (
    <div style={{ background: "#1e293b", borderRadius: 4, height: 6, overflow: "hidden", width: 80 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
    </div>
  );
}

export function MetricsPage({ token }: { token: string }) {
  const [metrics, setMetrics] = useState<WorkloadMetrics[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/metrics`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_URL}/api/v1/metrics/summary`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([m, s]) => { setMetrics(Array.isArray(m) ? m : []); setSummary(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useLiveRefresh(["evaluation", "live-sync"], load);

  const detail = metrics.find((m) => m.workload === selected);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>
            📊 Metrics Dashboard
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Real-time availability, latency, CPU and replica trends per workload.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ accentColor: "#6366f1" }} />
            Auto-refresh (10s)
          </label>
          <button onClick={load} style={{ padding: "6px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          {[
            { label: "Total Workloads", value: summary.totalWorkloads, color: "#a3cfff" },
            { label: "Healthy", value: summary.healthy, color: "#86efac" },
            { label: "Degraded", value: summary.degraded, color: "#fbbf24" },
            { label: "Down / Missing", value: summary.down, color: "#fca5a5" },
            { label: "Avg Availability", value: `${summary.avgAvailabilityPct.toFixed(1)}%`, color: "#c4b5fd" },
            { label: "Avg Latency p95", value: `${summary.avgLatencyP95Ms.toFixed(0)}ms`, color: "#fdba74" },
          ].map((card) => (
            <div key={card.label} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Workload cards */}
      {metrics.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#334155", fontSize: 14 }}>
          No metrics available. Register microservices to start measuring them.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {metrics.map((m) => (
          <div
            key={m.workload}
            onClick={() => setSelected(selected === m.workload ? null : m.workload)}
            style={{
              background: "#0f172a",
              border: `1px solid ${selected === m.workload ? "#6366f1" : "#1e293b"}`,
              borderRadius: 12,
              padding: "18px 20px",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>{m.workload}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{m.namespace} / {m.cluster}</div>
              </div>
              <HealthBadge health={m.health} />
            </div>

            {/* Key metrics row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Availability</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.availabilityPct >= 99 ? "#86efac" : m.availabilityPct >= 95 ? "#fbbf24" : "#fca5a5" }}>
                  {m.availabilityPct > 0 ? `${m.availabilityPct.toFixed(1)}%` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Latency p95</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.latencyP95Ms < 100 ? "#86efac" : m.latencyP95Ms < 300 ? "#fbbf24" : "#fca5a5" }}>
                  {m.latencyP95Ms > 0 ? `${m.latencyP95Ms.toFixed(0)}ms` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Replicas</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.readyReplicas === m.desiredReplicas ? "#86efac" : "#fbbf24" }}>
                  {m.readyReplicas}/{m.desiredReplicas}
                </div>
              </div>
            </div>

            {/* Availability sparkline */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Availability trend (1h)</div>
              <Sparkline points={m.availabilityTrend} color="#6366f1" />
            </div>

            {/* CPU bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#64748b", width: 28 }}>CPU</div>
              {m.cpuUtilizationPct != null ? (
                <>
                  <MiniBar value={m.cpuUtilizationPct} max={100} color={m.cpuUtilizationPct > 80 ? "#ef4444" : "#6366f1"} />
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{m.cpuUtilizationPct.toFixed(0)}%</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: "#334155" }}>metrics-server not available</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {detail && (
        <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 16 }}>
              {detail.workload} — detail
            </h3>
            <button
              onClick={() => setSelected(null)}
              style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 18 }}
            >×</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Availability trend</div>
              <Sparkline points={detail.availabilityTrend} color="#6366f1" height={56} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Latency p95 trend</div>
              <Sparkline points={detail.latencyTrend} color="#f59e0b" height={56} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Replica count</div>
              <Sparkline points={detail.replicaTrend} color="#22c55e" height={56} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Image</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", wordBreak: "break-all" }}>{detail.lastImage}</div>
            </div>
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Deployments</div>
              <div style={{ fontSize: 13, color: "#e2e8f0" }}>
                {detail.totalDeployments} total, <span style={{ color: detail.failedDeployments > 0 ? "#fca5a5" : "#86efac" }}>
                  {detail.failedDeployments} failed
                </span>
              </div>
            </div>
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Reliability score</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: detail.reliabilityScore >= 90 ? "#86efac" : detail.reliabilityScore >= 70 ? "#fbbf24" : "#fca5a5" }}>
                {detail.reliabilityScore > 0 ? `${detail.reliabilityScore.toFixed(1)}` : "—"}
              </div>
            </div>
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Error rate</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: detail.errorRatePct < 1 ? "#86efac" : detail.errorRatePct < 5 ? "#fbbf24" : "#fca5a5" }}>
                {detail.errorRatePct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

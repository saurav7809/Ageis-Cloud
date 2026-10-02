import { useState, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// ── Types ────────────────────────────────────────────────────────────────────

interface TelemetryPoint {
  timeLabel: string;
  cpu: number;
  latency: number;
  replicas: number;
  workloadRate: number;
  predictedLoad: number;
  trendGradient: number;
  costRate: number;
}

interface ScalingEvent {
  type: string;
  severity: string;
  message: string;
  previousReplicas: number;
  targetReplicas: number;
  metricTrigger: string;
  tickIndex: number;
}

interface StrategyResult {
  strategy: string;
  status: string;
  finalReplicas: number;
  avgCpu: number;
  avgLatency: number;
  peakCpu: number;
  peakLatency: number;
  scalingEventCount: number;
  thrashingScore: number;
  costPerHour: number;
  efficiencyPct: number;
  rating: string;
  telemetry: TelemetryPoint[];
  events: ScalingEvent[];
}

interface SimulationResult {
  workload: string;
  trafficPattern: string;
  durationTicks: number;
  minReplicas: number;
  maxReplicas: number;
  strategies: StrategyResult[];
  bestStrategy: string;
  bestEfficiency: number;
  confidencePct: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STRATEGY_COLOR: Record<string, string> = {
  CPU:     "#6366f1",
  TREND:   "#22c55e",
  LATENCY: "#f59e0b",
};

const RATING_COLOR: Record<string, string> = {
  EXCELLENT: "#22c55e",
  GOOD:      "#6366f1",
  FAIR:      "#f59e0b",
  POOR:      "#ef4444",
};

function Sparkline({
  points, accessor, color, height = 48, width = 140
}: {
  points: TelemetryPoint[];
  accessor: (p: TelemetryPoint) => number;
  color: string;
  height?: number;
  width?: number;
}) {
  if (points.length < 2) return <div style={{ width, height, background: "#0f172a", borderRadius: 4 }} />;
  const values = points.map(accessor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  const lastX = (1) * (width - 4) + 2;
  const lastY = height - ((values[values.length - 1] - min) / range) * (height - 8) - 4;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" opacity="0.85" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
    </svg>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / (max || 1)) * 100);
  return (
    <div style={{ background: "#1e293b", borderRadius: 4, height: 8, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s" }} />
    </div>
  );
}

const TRAFFIC_PATTERNS = [
  { id: "STABLE",   name: "Stable Baseline",      icon: "─", desc: "Steady low-noise traffic" },
  { id: "SPIKE",    name: "Sudden Spike (5×)",     icon: "⚡", desc: "Burst every ~40s" },
  { id: "PERIODIC", name: "Periodic Sine Wave",    icon: "~",  desc: "Diurnal retail pattern" },
  { id: "CHAOTIC",  name: "Chaotic / Random",      icon: "≈",  desc: "Worst-case random load" },
];

const EVENT_ICON: Record<string, string> = {
  SCALE_UP:       "↑",
  SCALE_DOWN:     "↓",
  HEALTH_CHECK:   "✓",
  LATENCY_SPIKE:  "⚠",
  THRASH_WARNING: "⚡",
};

const SEV_COLOR: Record<string, string> = {
  success: "#86efac",
  info:    "#93c5fd",
  warning: "#fbbf24",
  error:   "#fca5a5",
};

// ── Main Component ────────────────────────────────────────────────────────────

export function SimulatorPage({ token }: { token: string }) {
  const [trafficPattern, setTrafficPattern] = useState("SPIKE");
  const [workload, setWorkload] = useState("orders");
  const [minReplicas, setMinReplicas] = useState(2);
  const [maxReplicas, setMaxReplicas] = useState(12);
  const [ticks, setTicks] = useState(60);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<"cpu" | "latency" | "replicas">("cpu");
  const [liveTick, setLiveTick] = useState(0);

  // Animation loop for real-time visual playback
  useEffect(() => {
    if (result && liveTick > 0 && liveTick < result.durationTicks) {
      const timer = setTimeout(() => {
        setLiveTick(t => t + 1);
      }, 50); // fast playback (50ms per tick)
      return () => clearTimeout(timer);
    }
  }, [result, liveTick]);

  const runSimulation = useCallback(() => {
    setRunning(true);
    setResult(null);
    setSelectedStrategy(null);

    fetch(`${API_URL}/api/v1/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workload, trafficPattern, minReplicas, maxReplicas, ticks }),
    })
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setSelectedStrategy(data.bestStrategy);
        setRunning(false);
        setLiveTick(1);
      })
      .catch(() => setRunning(false));
  }, [workload, trafficPattern, minReplicas, maxReplicas, ticks, token]);

  const detailResult = result?.strategies.find((s) => s.strategy === selectedStrategy) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>
          🧪 Scaling Strategy Simulator
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          Compare CPU, Trend, and Latency-based auto-scaling strategies under real workload patterns.
          Understand which strategy fits your service before deploying it.
        </p>
      </div>

      {/* Config panel */}
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 18 }}>
          ⚙ Simulation Configuration
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Workload name</label>
            <input
              type="text"
              value={workload}
              onChange={(e) => setWorkload(e.target.value)}
              placeholder="orders, payments, auth..."
              style={{ display: "block", width: "100%", marginTop: 6, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Min replicas</label>
            <input type="number" min={1} max={20} value={minReplicas} onChange={(e) => setMinReplicas(Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 6, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Max replicas</label>
            <input type="number" min={2} max={50} value={maxReplicas} onChange={(e) => setMaxReplicas(Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 6, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Ticks (×5s)</label>
            <input type="number" min={20} max={120} value={ticks} onChange={(e) => setTicks(Number(e.target.value))}
              style={{ display: "block", width: "100%", marginTop: 6, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Traffic pattern selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Traffic pattern</label>
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            {TRAFFIC_PATTERNS.map((p) => (
              <div
                key={p.id}
                onClick={() => setTrafficPattern(p.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: trafficPattern === p.id ? "#1e3a5f" : "#0a1628",
                  border: `1px solid ${trafficPattern === p.id ? "#3b82f6" : "#1e293b"}`,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: trafficPattern === p.id ? "#93c5fd" : "#94a3b8" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={running}
          style={{
            padding: "10px 28px",
            background: running ? "#334155" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", border: "none", borderRadius: 8, cursor: running ? "default" : "pointer",
            fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
            boxShadow: running ? "none" : "0 4px 15px #6366f155",
            transition: "all 0.2s",
          }}
        >
          {running ? "⟳ Simulating…" : "▶ Run Simulation"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Winner banner */}
          <div style={{
            background: "linear-gradient(135deg, #0f2a0f, #0a1628)",
            border: "1px solid #166534",
            borderRadius: 12,
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}>
            <div style={{ fontSize: 36 }}>🏆</div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Best strategy for "{result.workload}" on {result.trafficPattern}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: STRATEGY_COLOR[result.bestStrategy] ?? "#e2e8f0", marginTop: 2 }}>
                {result.bestStrategy}-Based Scaling
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                Efficiency: <strong style={{ color: "#86efac" }}>{result.bestEfficiency}%</strong>
                &nbsp;·&nbsp; Confidence: <strong style={{ color: "#c4b5fd" }}>{result.confidencePct.toFixed(1)}%</strong>
                &nbsp;·&nbsp; {ticks * 5}s simulated with {result.minReplicas}–{result.maxReplicas} replicas
              </div>
            </div>
          </div>

          {/* Progress bar during playback */}
          {liveTick > 0 && liveTick < result.durationTicks && (
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                <span>Simulating T+{(liveTick * 5)}s...</span>
                <span>{Math.round((liveTick / result.durationTicks) * 100)}%</span>
              </div>
              <MiniBar value={liveTick} max={result.durationTicks} color="#3b82f6" />
            </div>
          )}

          {/* Strategy cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {result.strategies.map((s) => (
              <div
                key={s.strategy}
                onClick={() => setSelectedStrategy(s.strategy)}
                style={{
                  background: "#0f172a",
                  border: `2px solid ${selectedStrategy === s.strategy ? STRATEGY_COLOR[s.strategy] : "#1e293b"}`,
                  borderRadius: 12,
                  padding: "18px 20px",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                  position: "relative",
                }}
              >
                {result.bestStrategy === s.strategy && (
                  <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, background: "#22c55e22", color: "#86efac", border: "1px solid #22c55e44", borderRadius: 10, padding: "2px 8px", fontWeight: 600 }}>
                    WINNER
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: STRATEGY_COLOR[s.strategy] }}>{s.strategy}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: RATING_COLOR[s.rating], background: RATING_COLOR[s.rating] + "22", padding: "2px 8px", borderRadius: 10, border: `1px solid ${RATING_COLOR[s.rating]}44` }}>
                    {s.rating}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>{s.status}</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Avg CPU", value: `${s.avgCpu}%`, color: s.avgCpu > 80 ? "#fca5a5" : "#a3cfff" },
                    { label: "Avg Latency", value: `${s.avgLatency}ms`, color: s.avgLatency > 200 ? "#fca5a5" : "#a3cfff" },
                    { label: "Final Replicas", value: s.finalReplicas, color: "#e2e8f0" },
                    { label: "Thrash events", value: s.thrashingScore, color: s.thrashingScore > 5 ? "#fbbf24" : "#86efac" },
                    { label: "Scale events", value: s.scalingEventCount, color: "#c4b5fd" },
                    { label: "Cost/hr", value: `$${s.costPerHour}`, color: "#fdba74" },
                  ].map((m) => (
                    <div key={m.label}>
                      <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>{m.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: m.color, marginTop: 1 }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Efficiency bar */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginBottom: 4 }}>
                    <span>Efficiency</span>
                    <span style={{ color: RATING_COLOR[s.rating] }}>{s.efficiencyPct}%</span>
                  </div>
                  <MiniBar value={s.efficiencyPct} max={100} color={RATING_COLOR[s.rating]} />
                </div>

                {/* CPU sparkline */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: "#334155", marginBottom: 4 }}>CPU over time</div>
                  <Sparkline points={s.telemetry.slice(0, liveTick || s.telemetry.length)} accessor={(p) => p.cpu} color={STRATEGY_COLOR[s.strategy]} height={36} width={180} />
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {detailResult && (
            <div style={{ background: "#0a1628", border: `1px solid ${STRATEGY_COLOR[detailResult.strategy]}44`, borderRadius: 12, padding: "22px 26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, color: STRATEGY_COLOR[detailResult.strategy], fontSize: 17 }}>
                  {detailResult.strategy} — detailed telemetry
                </h3>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["cpu", "latency", "replicas"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setActiveMetric(m)}
                      style={{ padding: "5px 12px", background: activeMetric === m ? "#1e3a5f" : "transparent", border: `1px solid ${activeMetric === m ? "#3b82f6" : "#1e293b"}`, borderRadius: 6, color: activeMetric === m ? "#93c5fd" : "#64748b", cursor: "pointer", fontSize: 12 }}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Big chart */}
              <div style={{ background: "#050d1a", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>
                  {activeMetric === "cpu" ? "CPU Utilisation (%)" : activeMetric === "latency" ? "Latency p95 (ms)" : "Active Replicas"}
                </div>
                {(() => {
                  const accessor = activeMetric === "cpu" ? (p: TelemetryPoint) => p.cpu
                    : activeMetric === "latency" ? (p: TelemetryPoint) => p.latency
                    : (p: TelemetryPoint) => p.replicas;
                  const visiblePts = detailResult.telemetry.slice(0, liveTick || detailResult.telemetry.length);
                  return (
                    <Sparkline
                      points={visiblePts}
                      accessor={accessor}
                      color={STRATEGY_COLOR[detailResult.strategy]}
                      height={100}
                      width={Math.min(900, detailResult.telemetry.length * 10)}
                    />
                  );
                })()}
                {/* X-axis labels */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#334155", marginTop: 4 }}>
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const idx = Math.floor(pct * (detailResult.telemetry.length - 1));
                    return <span key={pct}>{detailResult.telemetry[idx]?.timeLabel ?? ""}</span>;
                  })}
                </div>
              </div>

              {/* Stats + Events side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Stats */}
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Stats</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Peak CPU", value: `${detailResult.peakCpu}%`, color: detailResult.peakCpu > 90 ? "#fca5a5" : "#e2e8f0" },
                      { label: "Peak Latency", value: `${detailResult.peakLatency}ms`, color: detailResult.peakLatency > 300 ? "#fca5a5" : "#e2e8f0" },
                      { label: "Avg CPU", value: `${detailResult.avgCpu}%`, color: "#a3cfff" },
                      { label: "Avg Latency", value: `${detailResult.avgLatency}ms`, color: "#a3cfff" },
                      { label: "Final Replicas", value: detailResult.finalReplicas, color: "#e2e8f0" },
                      { label: "Thrash Score", value: detailResult.thrashingScore, color: detailResult.thrashingScore > 5 ? "#fbbf24" : "#86efac" },
                      { label: "Scale Events", value: detailResult.scalingEventCount, color: "#c4b5fd" },
                      { label: "Cost / hr", value: `$${detailResult.costPerHour}`, color: "#fdba74" },
                    ].map((stat) => (
                      <div key={stat.label} style={{ background: "#0f172a", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>{stat.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, marginTop: 2 }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scaling events */}
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                    Scaling events ({detailResult.events.length})
                  </div>
                  <div style={{ maxHeight: 260, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {detailResult.events.length === 0 && (
                      <div style={{ color: "#334155", fontSize: 12, padding: 16, textAlign: "center" }}>No scaling events recorded.</div>
                    )}
                    {detailResult.events.filter(e => e.tickIndex <= liveTick).map((ev, i) => (
                      <div key={i} style={{ background: "#0f172a", borderRadius: 8, padding: "8px 12px", borderLeft: `3px solid ${SEV_COLOR[ev.severity]}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: SEV_COLOR[ev.severity] }}>
                            {EVENT_ICON[ev.type] ?? "•"} {ev.message}
                          </span>
                          <span style={{ fontSize: 10, color: "#475569" }}>T+{ev.tickIndex * 5}s</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {ev.metricTrigger} • {ev.previousReplicas} → {ev.targetReplicas} replicas
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparison table */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "18px 24px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 14 }}>📊 Side-by-side comparison</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#475569" }}>Metric</th>
                  {result.strategies.map((s) => (
                    <th key={s.strategy} style={{ textAlign: "center", padding: "8px 10px", color: STRATEGY_COLOR[s.strategy], fontWeight: 700 }}>
                      {s.strategy} {result.bestStrategy === s.strategy ? "🏆" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Efficiency", key: (s: StrategyResult) => `${s.efficiencyPct}%` },
                  { label: "Avg CPU", key: (s: StrategyResult) => `${s.avgCpu}%` },
                  { label: "Avg Latency", key: (s: StrategyResult) => `${s.avgLatency}ms` },
                  { label: "Peak Latency", key: (s: StrategyResult) => `${s.peakLatency}ms` },
                  { label: "Scale Events", key: (s: StrategyResult) => s.scalingEventCount },
                  { label: "Thrash Score", key: (s: StrategyResult) => s.thrashingScore },
                  { label: "Final Replicas", key: (s: StrategyResult) => s.finalReplicas },
                  { label: "Cost / hr", key: (s: StrategyResult) => `$${s.costPerHour}` },
                  { label: "Rating", key: (s: StrategyResult) => s.rating },
                ].map((row, ri) => (
                  <tr key={row.label} style={{ borderBottom: "1px solid #0f172a", background: ri % 2 === 0 ? "#0a1628" : "transparent" }}>
                    <td style={{ padding: "8px 10px", color: "#64748b", fontWeight: 500 }}>{row.label}</td>
                    {result.strategies.map((s) => (
                      <td key={s.strategy} style={{ padding: "8px 10px", textAlign: "center", color: "#e2e8f0" }}>
                        {row.key(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !running && (
        <div style={{ textAlign: "center", padding: "60px 40px", color: "#334155" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
          <div style={{ fontSize: 16, color: "#475569", marginBottom: 8 }}>Configure a simulation above and click Run.</div>
          <div style={{ fontSize: 13, color: "#334155" }}>
            All three strategies will run against the same workload in parallel — then you'll see which one wins.
          </div>
        </div>
      )}

      {running && (
        <div style={{ textAlign: "center", padding: "60px 40px" }}>
          <div style={{ fontSize: 48, marginBottom: 12, animation: "spin 1s linear infinite" }}>⟳</div>
          <div style={{ fontSize: 15, color: "#6366f1", fontWeight: 600 }}>Simulating {ticks * 5}s of {trafficPattern} traffic…</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>Running CPU, TREND, and LATENCY strategies in parallel</div>
        </div>
      )}
    </div>
  );
}

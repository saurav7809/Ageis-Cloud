import { useCallback, useEffect, useState } from "react";
import { getTargets, getSlos, type DeploymentTarget, type Slo } from "../api/client";
import { Badge, Card } from "../components/ui";
import { useLiveRefresh } from "../components/LiveEvents";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

const SLI_TYPES = [
  { value: "AVAILABILITY",  label: "Availability",       unit: "%",  min: 90,   max: 99.99, step: 0.01, defaultVal: 99.9,  description: "% of requests that succeed" },
  { value: "LATENCY_P95",   label: "Latency p95",        unit: "ms", min: 10,   max: 2000,  step: 1,    defaultVal: 250,   description: "95th‑percentile response time" },
  { value: "LATENCY_P99",   label: "Latency p99",        unit: "ms", min: 10,   max: 5000,  step: 1,    defaultVal: 500,   description: "99th‑percentile response time" },
  { value: "ERROR_RATE",    label: "Error Rate",         unit: "%",  min: 0,    max: 10,    step: 0.01, defaultVal: 1,     description: "% of requests that return 5xx" },
  { value: "THROUGHPUT",    label: "Throughput",         unit: "rps",min: 1,    max: 10000, step: 1,    defaultVal: 100,   description: "Minimum sustained requests/sec" },
];

const BURN_COLOR = (rate: number) =>
  rate > 2 ? "#f43f5e" : rate > 1 ? "#f59e0b" : "#22d3a0";

function BudgetBar({ remaining }: { remaining: number }) {
  const w = Math.max(0, Math.min(100, remaining));
  const color = w < 10 ? "#f43f5e" : w < 30 ? "#f59e0b" : "#22d3a0";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "#141b25", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color, fontWeight: 700, minWidth: 38 }}>
        {remaining?.toFixed(1)}%
      </span>
    </div>
  );
}

export function SloConfigPage({ token }: { token: string }) {
  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [slos, setSlos]       = useState<Slo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Create form state
  const [targetId,  setTargetId]  = useState("");
  const [sliType,   setSliType]   = useState("AVAILABILITY");
  const [objective, setObjective] = useState(99.9);
  const [windowDays, setWindowDays] = useState(30);
  const [creating, setCreating]   = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([getTargets(token), getSlos(token)]);
      setTargets(t);
      setSlos(s);
      if (!targetId && t.length > 0) setTargetId(t[0].id);
      setError(null);
    } catch {
      setError("Failed to load SLO data");
    } finally {
      setLoading(false);
    }
  }, [token, targetId]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(["evaluation"], load);

  const selectedSli = SLI_TYPES.find(s => s.value === sliType)!;

  // When SLI type changes, reset objective to default
  const handleSliChange = (v: string) => {
    setSliType(v);
    const meta = SLI_TYPES.find(s => s.value === v)!;
    setObjective(meta.defaultVal);
  };

  async function createSlo() {
    if (!targetId) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const r = await fetch(`${API}/api/v1/targets/${targetId}/slos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sliType, objectiveValue: objective, windowDays }),
      });
      if (r.ok) {
        setCreateMsg("✓ SLO created — evaluation engine will pick it up on its next cycle.");
        setShowForm(false);
        await load();
      } else {
        const body = await r.json().catch(() => ({}));
        setCreateMsg(`⚠ ${body.message ?? "Failed to create SLO"}`);
      }
    } catch {
      setCreateMsg("⚠ Network error");
    } finally {
      setCreating(false);
    }
  }

  const grouped = targets.map(t => ({
    target: t,
    slos: slos.filter(s => s.targetLabel === t.serviceName),
  })).filter(g => g.slos.length > 0 || showForm);

  return (
    <div>
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>SLO Configuration</h1>
          <p>Define Service Level Objectives per target. The evaluation engine enforces them every 60 s and fires alerts when error budgets burn fast.</p>
        </div>
        <button onClick={() => { setShowForm(f => !f); setCreateMsg(null); }} style={{
          padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700,
          background: showForm ? "#1a2332" : "linear-gradient(135deg,#3b82f6,#6366f1)",
          color: showForm ? "#8895aa" : "#fff", fontSize: 13, flexShrink: 0, marginTop: 4,
        }}>
          {showForm ? "Cancel" : "+ New SLO"}
        </button>
      </div>

      {error && <p style={{ color: "#f43f5e", marginBottom: 16 }}>{error}</p>}

      {/* Create form */}
      {showForm && (
        <div style={{
          background: "#0d1117", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 14,
          padding: 24, marginBottom: 20,
          boxShadow: "0 0 30px rgba(59,130,246,0.06)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#e8eef6", marginBottom: 18 }}>
            Define a new SLO
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Target picker */}
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              Service / Target
              <select value={targetId} onChange={e => setTargetId(e.target.value)} style={{
                display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
                background: "#060810", border: "1px solid #1a2332", borderRadius: 9,
                color: "#e8eef6", fontSize: 13, cursor: "pointer",
              }}>
                {targets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.serviceName} — {t.clusterName} / {t.namespace}
                  </option>
                ))}
              </select>
            </label>

            {/* SLI type */}
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              SLI Type
              <select value={sliType} onChange={e => handleSliChange(e.target.value)} style={{
                display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
                background: "#060810", border: "1px solid #1a2332", borderRadius: 9,
                color: "#e8eef6", fontSize: 13, cursor: "pointer",
              }}>
                {SLI_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>

            {/* Objective slider */}
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600, gridColumn: "span 2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span>Objective — {selectedSli.description}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6", letterSpacing: "-0.5px" }}>
                  {objective.toFixed(sliType === "THROUGHPUT" ? 0 : sliType.startsWith("LATENCY") ? 0 : 2)} {selectedSli.unit}
                </span>
              </div>
              <div style={{ position: "relative" }}>
                <input type="range"
                  min={selectedSli.min} max={selectedSli.max} step={selectedSli.step}
                  value={objective} onChange={e => setObjective(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4d5d72", marginTop: 4 }}>
                  <span>{selectedSli.min} {selectedSli.unit}</span>
                  <span>{selectedSli.max} {selectedSli.unit}</span>
                </div>
              </div>
            </label>

            {/* Window */}
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              Rolling Window
              <select value={windowDays} onChange={e => setWindowDays(parseInt(e.target.value))} style={{
                display: "block", width: "100%", marginTop: 6, padding: "10px 12px",
                background: "#060810", border: "1px solid #1a2332", borderRadius: 9,
                color: "#e8eef6", fontSize: 13, cursor: "pointer",
              }}>
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>

            {/* Error budget preview */}
            <div style={{ background: "#060810", border: "1px solid #1a2332", borderRadius: 9, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#4d5d72", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Error Budget
              </div>
              <div style={{ fontSize: 13, color: "#e8eef6" }}>
                {sliType === "AVAILABILITY"
                  ? `${((100 - objective) * windowDays * 24 * 60).toFixed(0)} minutes of downtime allowed over ${windowDays}d`
                  : sliType.startsWith("LATENCY")
                  ? `p${sliType === "LATENCY_P95" ? 95 : 99} must stay under ${objective} ms`
                  : sliType === "ERROR_RATE"
                  ? `At most ${objective}% of requests may fail over ${windowDays}d`
                  : `Throughput must stay above ${objective} rps`}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={createSlo} disabled={creating || !targetId} style={{
              padding: "10px 24px", borderRadius: 9, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff",
              fontWeight: 700, fontSize: 13, opacity: creating ? 0.7 : 1,
            }}>
              {creating ? "Creating…" : "Create SLO"}
            </button>
            {createMsg && (
              <span style={{ fontSize: 13, color: createMsg.startsWith("✓") ? "#22d3a0" : "#f59e0b" }}>
                {createMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* SLO list */}
      {loading ? (
        <div className="loading">Loading SLOs…</div>
      ) : slos.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 40px",
          background: "#0d1117", border: "1px dashed #1a2332", borderRadius: 14,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#e8eef6", marginBottom: 6 }}>No SLOs defined yet</div>
          <div style={{ fontSize: 13, color: "#4d5d72", marginBottom: 20 }}>
            SLOs define what "good" means for each service. The engine tracks error budgets and fires alerts when they burn too fast.
          </div>
          <button onClick={() => setShowForm(true)} style={{
            padding: "10px 24px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontWeight: 700, fontSize: 13,
          }}>
            Define your first SLO
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary row */}
          <div className="grid stat-row">
            {[
              { label: "Total SLOs", value: slos.length },
              { label: "Burning Fast", value: slos.filter(s => s.burnRate > 2).length, tone: "bad" as const },
              { label: "Healthy Budget", value: slos.filter(s => s.budgetRemainingPct > 50).length, tone: "good" as const },
              { label: "At Risk", value: slos.filter(s => s.budgetRemainingPct > 0 && s.budgetRemainingPct <= 30).length, tone: "warn" as const },
            ].map(s => (
              <Card key={s.label}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.tone === "bad" ? "#f43f5e" : s.tone === "warn" ? "#f59e0b" : s.tone === "good" ? "#22d3a0" : "#e8eef6" }}>
                  {s.value}
                </div>
              </Card>
            ))}
          </div>

          {/* SLO table */}
          <Card title="Active SLOs">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>SLI Type</th>
                    <th>Objective</th>
                    <th>Current</th>
                    <th>Burn Rate</th>
                    <th>Error Budget</th>
                    <th>Window</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slos.map(slo => {
                    const sliMeta = SLI_TYPES.find(s => s.value === slo.sliType);
                    const unit = sliMeta?.unit ?? "";
                    const isGood = slo.burnRate <= 1 && slo.budgetRemainingPct > 30;
                    const isBad  = slo.burnRate > 2 || slo.budgetRemainingPct <= 10;
                    return (
                      <tr key={slo.id}>
                        <td className="td-strong">{slo.targetLabel}</td>
                        <td>
                          <Badge tone="info">{sliMeta?.label ?? slo.sliType}</Badge>
                        </td>
                        <td className="mono">
                          {slo.objectiveValue?.toFixed(sliMeta?.step === 1 ? 0 : 2)} {unit}
                        </td>
                        <td className="mono" style={{
                          color: slo.burnRate > 1 ? "#f43f5e" : "#22d3a0",
                          fontWeight: 700,
                        }}>
                          {slo.currentValue?.toFixed(sliMeta?.step === 1 ? 0 : 2)} {unit}
                        </td>
                        <td className="mono" style={{ color: BURN_COLOR(slo.burnRate), fontWeight: 700 }}>
                          {slo.burnRate?.toFixed(2)}×
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <BudgetBar remaining={slo.budgetRemainingPct} />
                        </td>
                        <td className="mono">{slo.windowDays}d</td>
                        <td>
                          <Badge tone={isBad ? "bad" : isGood ? "good" : "warn"}>
                            {isBad ? "BREACHING" : isGood ? "HEALTHY" : "AT RISK"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

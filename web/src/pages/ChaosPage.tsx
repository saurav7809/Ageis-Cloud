import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "../components/LiveEvents";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function apiFetch(path: string, token: string, opts: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) return null;
  return r.json();
}

const FAULT_META: Record<string, { icon: string; color: string; bg: string; border: string; desc: string }> = {
  POD_KILL: {
    icon: "💥", color: "#ff8a8d", bg: "#1a0808", border: "#7f1d1d",
    desc: "Deletes running pods. Kubernetes recreates them — tests recovery speed and self-healing."
  },
  REPLICA_LOSS: {
    icon: "📉", color: "#fb923c", bg: "#1a1005", border: "#78350f",
    desc: "Reduces replica count for the duration. Tests whether remaining pods can sustain load."
  },
  DEPENDENCY_OUTAGE: {
    icon: "🔌", color: "#c084fc", bg: "#130b1f", border: "#6b21a8",
    desc: "Scales a dependency to zero. Produces upstream/downstream failures for RCA validation."
  },
};

interface ExperimentRun {
  id: string;
  serviceName: string;
  targetLabel: string;
  faultType: string;
  status: string;
  scoreBefore: number | null;
  scoreDuring: number | null;
  scoreAfter: number | null;
  startedAt: string;
  endedAt: string | null;
}

interface Target {
  id: string;
  label: string;
  serviceName: string;
  clusterName: string;
  namespace: string;
  replicas: number;
}

const STATUS_CFG: Record<string, { color: string; icon: string }> = {
  RUNNING:            { color: "#60a5fa", icon: "⟳" },
  COMPLETED:          { color: "#4ade80", icon: "✓" },
  REJECTED_BY_POLICY: { color: "#f59e0b", icon: "⛔" },
  FAILED:             { color: "#ff8a8d", icon: "✗" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function ScorePill({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "#475569" }}>—</span>;
  const color = value >= 90 ? "#4ade80" : value >= 70 ? "#fbbf24" : "#ff8a8d";
  return (
    <span style={{
      fontFamily: "monospace", fontWeight: 700, fontSize: 13, color,
      background: `${color}15`, padding: "2px 8px", borderRadius: 6,
      border: `1px solid ${color}40`,
    }}>{value.toFixed(1)}</span>
  );
}

export function ChaosPage({ token }: { token: string }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedTarget, setSelectedTarget] = useState("");
  const [faultType, setFaultType] = useState("POD_KILL");
  const [magnitude, setMagnitude] = useState(1);
  const [duration, setDuration] = useState(120);
  const [depTarget, setDepTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [targetsData, expsData] = await Promise.all([
      apiFetch("/api/v1/targets", token),
      apiFetch("/api/v1/fleet", token),
    ]);
    if (Array.isArray(targetsData)) setTargets(targetsData);
    else if (targetsData?.targets) setTargets(targetsData.targets);
    if (expsData?.experiments) setExperiments(expsData.experiments);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useLiveRefresh(["experiment", "scaling", "live-sync"], load);


  const handleSubmit = async () => {
    if (!selectedTarget) { setSubmitError("Select a target first."); return; }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitOk(null);
    const body: Record<string, unknown> = {
      targetId: selectedTarget,
      faultType,
      magnitude,
      durationSeconds: duration,
    };
    if (faultType === "DEPENDENCY_OUTAGE" && depTarget) body.dependencyTargetId = depTarget;

    const result = await apiFetch("/api/v1/experiments", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (result) {
      setSubmitOk(`Experiment started: ${result.runId ?? result.id ?? "ok"}`);
      load();
    } else {
      setSubmitError("Failed to start experiment — check the control plane logs.");
    }
  };

  const selectedMeta = FAULT_META[faultType];
  const runningCount = experiments.filter((e) => e.status === "RUNNING").length;

  return (
    <div>
      <div className="page-head">
        <h1>Chaos Engineering</h1>
        <p>Inject real faults into your cluster and validate that the platform detects, heals, and recovers.</p>
      </div>

      {/* Warning */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 18px", borderRadius: 10, marginBottom: 20,
        background: "#1a1205", border: "1px solid #713f12",
      }}>
        <span style={{ fontSize: 22 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#fbbf24" }}>
            Chaos experiments affect real Kubernetes workloads
          </div>
          <div style={{ fontSize: 12, color: "#92400e" }}>
            Faults are injected via the Kubernetes API — pods will actually be deleted or scaled down.
            Only target workloads you understand and can recover. Never target <code>kube-system</code>.
          </div>
        </div>
        {runningCount > 0 && (
          <div style={{
            marginLeft: "auto", padding: "4px 12px", borderRadius: 99,
            background: "#172554", border: "1px solid #1e40af", color: "#93c5fd",
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
          }}>
            {runningCount} running
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20, alignItems: "start" }}>
        {/* Launch panel */}
        <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
            Launch Experiment
          </div>

          {/* Fault type cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {Object.entries(FAULT_META).map(([type, meta]) => (
              <button key={type} onClick={() => setFaultType(type)} style={{
                padding: "12px 14px", borderRadius: 10, border: `1px solid`,
                borderColor: faultType === type ? meta.border : "#1e2a3a",
                background: faultType === type ? meta.bg : "transparent",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: faultType === type ? meta.color : "#94a3b8" }}>
                    {type.replace(/_/g, " ")}
                  </span>
                </div>
                {faultType === type && (
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{meta.desc}</div>
                )}
              </button>
            ))}
          </div>

          {/* Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              Target Workload
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                style={{
                  display: "block", width: "100%", marginTop: 6,
                  padding: "9px 12px", background: "#0a0e17", border: "1px solid #1e2a3a",
                  borderRadius: 8, color: "#e2e8f0", fontSize: 13,
                }}>
                <option value="">— Select a target —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.serviceName} @ {t.clusterName}/{t.namespace}
                  </option>
                ))}
              </select>
            </label>

            {faultType === "DEPENDENCY_OUTAGE" && (
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                Dependency to outage
                <select
                  value={depTarget}
                  onChange={(e) => setDepTarget(e.target.value)}
                  style={{
                    display: "block", width: "100%", marginTop: 6,
                    padding: "9px 12px", background: "#0a0e17", border: "1px solid #1e2a3a",
                    borderRadius: 8, color: "#e2e8f0", fontSize: 13,
                  }}>
                  <option value="">— Select dependency target —</option>
                  {targets.filter((t) => t.id !== selectedTarget).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.serviceName} @ {t.namespace}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                Magnitude (pods)
                <input
                  type="number" min={1} max={10} value={magnitude}
                  onChange={(e) => setMagnitude(Number(e.target.value))}
                  style={{
                    display: "block", width: "100%", marginTop: 6, boxSizing: "border-box",
                    padding: "9px 12px", background: "#0a0e17", border: "1px solid #1e2a3a",
                    borderRadius: 8, color: "#e2e8f0", fontSize: 13,
                  }} />
              </label>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                Duration (seconds)
                <input
                  type="number" min={30} max={600} step={30} value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  style={{
                    display: "block", width: "100%", marginTop: 6, boxSizing: "border-box",
                    padding: "9px 12px", background: "#0a0e17", border: "1px solid #1e2a3a",
                    borderRadius: 8, color: "#e2e8f0", fontSize: 13,
                  }} />
              </label>
            </div>

            {submitError && (
              <div style={{ padding: "8px 12px", background: "#1a0808", border: "1px solid #7f1d1d", borderRadius: 7, fontSize: 12, color: "#fca5a5" }}>
                {submitError}
              </div>
            )}
            {submitOk && (
              <div style={{ padding: "8px 12px", background: "#0a1f12", border: "1px solid #166534", borderRadius: 7, fontSize: 12, color: "#86efac" }}>
                ✓ {submitOk}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedTarget}
              style={{
                padding: "12px", borderRadius: 9, border: "none", cursor: "pointer",
                background: submitting || !selectedTarget
                  ? "#1e2a3a"
                  : `linear-gradient(135deg, ${selectedMeta.bg}, #1e2a3a)`,
                color: !selectedTarget ? "#475569" : selectedMeta.color,
                fontWeight: 700, fontSize: 14,
                border: `1px solid ${!selectedTarget ? "#1e2a3a" : selectedMeta.border}`,
                transition: "all 0.2s",
              }}>
              {submitting ? "⟳ Launching…" : `${selectedMeta.icon} Launch ${faultType.replace(/_/g, " ")}`}
            </button>
          </div>
        </div>

        {/* Experiment history */}
        <div style={{ background: "#0d1117", border: "1px solid #1e2a3a", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Experiment History
            </div>
            <button onClick={load} style={{
              padding: "5px 12px", borderRadius: 7, border: "1px solid #1e2a3a",
              background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 12,
            }}>⟳</button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>Loading…</div>
          ) : experiments.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#475569", fontSize: 13 }}>
              No experiments yet. Launch one to validate resilience.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {experiments.map((exp) => {
                const meta = FAULT_META[exp.faultType] ?? FAULT_META.POD_KILL;
                const st = STATUS_CFG[exp.status] ?? { color: "#94a3b8", icon: "?" };
                return (
                  <div key={exp.id} style={{
                    padding: "14px 16px", borderRadius: 10,
                    background: "#080c14", border: "1px solid #1e2a3a",
                    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "start",
                  }}>
                    <span style={{ fontSize: 20, marginTop: 2 }}>{meta.icon}</span>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>
                          {exp.faultType.replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: 11, color: meta.color, background: `${meta.color}15`, padding: "2px 7px", borderRadius: 6, border: `1px solid ${meta.color}40` }}>
                          {exp.serviceName}
                        </span>
                        <span style={{ fontSize: 11, color: st.color, fontWeight: 700 }}>
                          {st.icon} {exp.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748b" }}>
                        <span>🏷 {exp.targetLabel}</span>
                        <span>🕐 {timeAgo(exp.startedAt)}</span>
                      </div>
                      {/* Score comparison */}
                      <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>Before</span>
                        <ScorePill value={exp.scoreBefore} />
                        <span style={{ fontSize: 11, color: "#64748b" }}>→ During</span>
                        <ScorePill value={exp.scoreDuring} />
                        <span style={{ fontSize: 11, color: "#64748b" }}>→ After</span>
                        <ScorePill value={exp.scoreAfter} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  diagnoseNow,
  getIncident,
  getIncidents,
  getRcaAccuracy,
  judgeVerdict,
  type Incident,
  type Verdict,
} from "../api/client";
import { Badge, Card, timeAgo } from "../components/ui";
import { useLiveRefresh } from "../components/LiveEvents";

const ASSESSMENT_TONE: Record<string, "good" | "warn" | "bad" | "info"> = {
  LIKELY_CAUSE: "bad",
  POSSIBLE_CAUSE: "warn",
  LIKELY_SYMPTOM: "info",
};

const SIGNAL_LABEL: Record<string, string> = {
  GRAPH_POSITION: "graph position",
  TEMPORAL_ORDER: "what failed first",
  CHANGE_EVENT: "recent changes",
  RESOURCE_SATURATION: "the pods themselves",
};

/**
 * Incidents and their diagnoses.
 *
 * The evidence is shown in full rather than summarised into a score. A verdict that
 * cannot be checked is one an operator has to take on faith at exactly the moment
 * they should not, so every fact the engine used is on the screen beside the number
 * it produced — including the facts that argue against a candidate.
 */
export function DiagnosticsPage({ token }: { token: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [accuracy, setAccuracy] = useState<{
    correct: number;
    total: number;
    precisionAt1: number;
    detail: string[];
  } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

  const refresh = useCallback(async () => {
    try {
      const rows = await getIncidents(token);
      setIncidents(rows);
      setAccuracy(await getRcaAccuracy(token));
      setError(null);
      if (rows.length > 0 && !selected) {
        setSelected(rows[0]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load incidents");
    }
  }, [token, selected]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A new incident is exactly the thing this page exists to show, and it should not
  // wait for someone to reload.
  useLiveRefresh(["incident", "experiment"], refresh);

  useEffect(() => {
    if (!selected) return;
    getIncident(token, selected.id)
      .then((d) => setVerdicts(d.verdicts))
      .catch(() => setVerdicts([]));
  }, [token, selected]);

  async function handleDiagnose() {
    setBusy(true);
    setNote(null);
    try {
      const result = await diagnoseNow(token);
      // "nothing is degraded" is a real answer, not an empty one. Saying so beats
      // opening an incident nobody asked for.
      setNote(result.summary ? `${result.title} — ${result.summary}` : (result.status ?? ""));
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Diagnosis failed");
    } finally {
      setBusy(false);
    }
  }

  async function judge(rank: number, verdict: "CORRECT" | "INCORRECT") {
    if (!selected) return;
    try {
      await judgeVerdict(token, selected.id, rank, verdict);
      const d = await getIncident(token, selected.id);
      setVerdicts(d.verdicts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the judgement");
    }
  }

  async function runAiAnalysis() {
    if (!selected) return;
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const r = await fetch(`${API}/api/v1/ai/incidents/${selected.id}/rerank`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setAiAnalysis(data);
      if (!data.analysed) setAiError(data.detail ?? "AI service unavailable");
    } catch {
      setAiError("Could not reach the AI analysis service");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Diagnostics</h1>
        <p>
          When several services fail at once, which one is actually broken. Every
          verdict carries the facts it rests on — a candidate the engine cannot
          explain is never shown at all.
        </p>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <Card
        title="Accuracy against known causes"
        meta={accuracy ? `${accuracy.correct}/${accuracy.total} scored` : "—"}
      >
        <p className="muted">
          Chaos experiments are the only incidents whose true cause the platform knows,
          because it caused them. Each run's window is re-analysed through the same code
          path a live diagnosis uses.
        </p>
        {accuracy && (
          <p className="stat-line">
            precision@1 <strong>{(accuracy.precisionAt1 * 100).toFixed(0)}%</strong> over{" "}
            {accuracy.total} scored run{accuracy.total === 1 ? "" : "s"}
          </p>
        )}
        <button className="btn btn-primary" onClick={handleDiagnose} disabled={busy}>
          {busy ? "Diagnosing…" : "Diagnose what is degraded now"}
        </button>
        {note && <p className="hint">{note}</p>}
      </Card>

      <Card title="Incidents" meta={`${incidents.length} recorded`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Incident</th>
                <th>Root cause</th>
                <th>Confidence</th>
                <th>Affected</th>
                <th>Status</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr
                  key={i.id}
                  className={selected?.id === i.id ? "row-selected" : "row-clickable"}
                  onClick={() => setSelected(i)}
                >
                  <td className="td-strong">{i.title}</td>
                  <td>{i.rootCauseService ?? "—"}</td>
                  <td className="mono">
                    {i.confidence == null ? "—" : i.confidence.toFixed(2)}
                  </td>
                  <td className="mono">{i.blastRadiusCount}</td>
                  <td>
                    <Badge tone={i.status === "RESOLVED" ? "good" : "warn"}>{i.status}</Badge>
                  </td>
                  <td className="small">{timeAgo(i.startedAt)}</td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No incidents recorded. An incident is opened when a measured service
                    falls below its degradation threshold — not on a schedule.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <Card title={`Verdicts — ${selected.title}`} meta={`${verdicts.length} candidates`}>
          {verdicts.length === 0 && (
            <p className="muted">
              No candidate could be supported by evidence, so the incident is recorded
              without a verdict.
            </p>
          )}
          {verdicts.map((v) => {
            const assessment = String(v.evidence?.assessment ?? "");
            const facts = v.evidence?.facts ?? [];
            return (
              <div className="verdict" key={v.rank}>
                <div className="verdict-head">
                  <span className="verdict-rank">#{v.rank}</span>
                  <span className="td-strong">{v.serviceName}</span>
                  <Badge tone={ASSESSMENT_TONE[assessment] ?? "info"}>
                    {assessment.replace(/_/g, " ").toLowerCase() || "candidate"}
                  </Badge>
                  <span className="mono">{v.confidence.toFixed(2)}</span>
                  <span className="verdict-actions">
                    <button className="btn btn-ghost" onClick={() => judge(v.rank, "CORRECT")}>
                      Correct
                    </button>
                    <button className="btn btn-ghost" onClick={() => judge(v.rank, "INCORRECT")}>
                      Wrong
                    </button>
                    {v.humanVerdict && <Badge tone="info">{v.humanVerdict}</Badge>}
                  </span>
                </div>
                <ul className="evidence">
                  {facts.map((f, i) => (
                    <li key={i} className={f.weight < 0 ? "evidence-against" : ""}>
                      <span className="evidence-signal">
                        {SIGNAL_LABEL[f.signal] ?? f.signal}
                      </span>
                      {f.detail}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Card>
      )}

      {/* AI Analysis Panel */}
      {selected && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            background: "#0d1117", border: "1px solid #1a2332", borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 20px", borderBottom: "1px solid #1a2332",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>🤖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e8eef6" }}>AI Analysis</div>
                <div style={{ fontSize: 12, color: "#4d5d72" }}>Cross-references anomaly detection with RCA verdicts</div>
              </div>
              <button onClick={runAiAnalysis} disabled={aiLoading} style={{
                padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
                background: aiLoading ? "#1a2332" : "linear-gradient(135deg, #6366f1, #3b82f6)",
                color: aiLoading ? "#4d5d72" : "#fff", fontWeight: 700, fontSize: 13, transition: "all 0.2s",
              }}>
                {aiLoading ? "⟳ Analysing…" : "Run AI Analysis"}
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {!aiAnalysis && !aiError && (
                <div style={{ textAlign: "center", padding: 24, color: "#4d5d72", fontSize: 13 }}>
                  Click "Run AI Analysis" to get a second opinion using anomaly detection.
                </div>
              )}

              {aiError && (
                <div style={{ padding: "12px 16px", background: "#1a1205", border: "1px solid #713f12", borderRadius: 9, color: "#fbbf24", fontSize: 13 }}>
                  ⚠ {aiError} — The Python AI sidecar needs to be running for this feature.
                </div>
              )}

              {aiAnalysis?.analysed && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  {/* Platform ranking */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#4d5d72", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Platform RCA</div>
                    {(aiAnalysis.platformRanking ?? []).map((p: any, i: number) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", marginBottom: 6, borderRadius: 9,
                        background: "#060810", border: "1px solid #1a2332",
                      }}>
                        <span style={{ color: "#4d5d72", fontFamily: "monospace", fontSize: 12, width: 20 }}>#{p.rank}</span>
                        <span style={{ flex: 1, fontWeight: 600, color: "#c8d4e3", fontSize: 13 }}>{p.service}</span>
                        <span style={{
                          fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                          color: p.confidence > 0.7 ? "#f43f5e" : p.confidence > 0.4 ? "#f59e0b" : "#22d3a0",
                        }}>{(p.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>

                  {/* AI ranking */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>AI Re-ranking</div>
                    {(Array.isArray(aiAnalysis.aiRanking) ? aiAnalysis.aiRanking : []).map((p: any, i: number) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", marginBottom: 6, borderRadius: 9,
                        background: "#0d0f1f", border: "1px solid #2a2060",
                      }}>
                        <span style={{ color: "#4d5d72", fontFamily: "monospace", fontSize: 12, width: 20 }}>#{i + 1}</span>
                        <span style={{ flex: 1, fontWeight: 600, color: "#a5b4fc", fontSize: 13 }}>
                          {p.service_name ?? p.service ?? "—"}
                        </span>
                        {p.anomaly_score != null && (
                          <span style={{ fontSize: 11, color: "#f43f5e", background: "#1a0008", padding: "2px 7px", borderRadius: 6, border: "1px solid #7f1d1d" }}>
                            anomaly {p.anomaly_score.toFixed(2)}σ
                          </span>
                        )}
                        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#818cf8" }}>
                          {p.confidence != null ? `${(p.confidence * 100).toFixed(0)}%` : "—"}
                        </span>
                      </div>
                    ))}
                    {aiAnalysis.aiRanking?.length === 0 && (
                      <div style={{ color: "#4d5d72", fontSize: 13 }}>No AI ranking available.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

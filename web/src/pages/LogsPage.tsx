import { useEffect, useState, useRef, useCallback } from "react";
import { useLiveRefresh } from "../components/LiveEvents";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface PodSummary {
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
}

interface LogLine {
  pod: string;
  line: string;
  lineNumber: number;
}

interface LogResponse {
  cluster: string;
  namespace: string;
  workload: string;
  pod: string | null;
  tailLines: number;
  lines: LogLine[];
  note: string | null;
}

interface Microservice {
  targetId: string;
  name: string;
  namespace: string;
  cluster: string;
  image: string;
  desiredReplicas: number;
  readyReplicas: number;
  health: string;
  dependencies: string[];
}

function levelOf(line: string): "error" | "warn" | "info" | "debug" {
  const l = line.toLowerCase();
  if (l.includes("error") || l.includes("exception") || l.includes("fatal") || l.includes("critical"))
    return "error";
  if (l.includes("warn")) return "warn";
  if (l.includes("debug") || l.includes("trace")) return "debug";
  return "info";
}

const LEVEL_COLOR: Record<string, string> = {
  error: "#ff6b6b",
  warn: "#ffa94d",
  info: "#a3cfff",
  debug: "#888",
};

export function LogsPage({ token }: { token: string }) {
  const [services, setServices] = useState<Microservice[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [selectedPod, setSelectedPod] = useState<string>("");
  const [tail, setTail] = useState(200);
  const [logs, setLogs] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<null | {
    matchCount: number;
    matches: { pod: string; line: string; lineNumber: number }[];
  }>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);


  // Load registered microservices
  useEffect(() => {
    fetch(`${API_URL}/api/v1/microservices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setServices(data);
        if (data.length > 0) setSelectedService(data[0].name);
      })
      .catch(() => {});
  }, [token]);

  // Load pods when service changes
  useEffect(() => {
    if (!selectedService) return;
    const svc = services.find((s) => s.name === selectedService);
    if (!svc) return;

    fetch(
      `${API_URL}/api/v1/logs/pods?cluster=${svc.cluster}&namespace=${svc.namespace}&workload=${svc.name}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data) => {
        setPods(data);
        setSelectedPod("");
      })
      .catch(() => setPods([]));
  }, [selectedService, services, token]);

  const fetchLogs = useCallback(() => {
    const svc = services.find((s) => s.name === selectedService);
    if (!svc) return;

    setLoading(true);
    const podParam = selectedPod ? `&pod=${encodeURIComponent(selectedPod)}` : "";
    fetch(
      `${API_URL}/api/v1/logs?cluster=${svc.cluster}&namespace=${svc.namespace}&workload=${svc.name}&tail=${tail}${podParam}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
        setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .catch(() => setLoading(false));
  }, [selectedService, selectedPod, tail, services, token]);

  const searchLogs = () => {
    const svc = services.find((s) => s.name === selectedService);
    if (!svc || !searchQuery.trim()) return;

    fetch(
      `${API_URL}/api/v1/logs/search?cluster=${svc.cluster}&namespace=${svc.namespace}&workload=${svc.name}&query=${encodeURIComponent(searchQuery)}&tail=500`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data) => setSearchResults(data))
      .catch(() => {});
  };

  // Auto-refresh on live-sync events
  useLiveRefresh(["live-sync", "scaling"], fetchLogs);

  const displayLines = searchResults
    ? searchResults.matches.map((m, i) => ({ ...m, lineNumber: m.lineNumber ?? i + 1 }))
    : (logs?.lines ?? []);

  const filtered = searchQuery && !searchResults
    ? displayLines.filter((l) => l.line.toLowerCase().includes(searchQuery.toLowerCase()))
    : displayLines;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>
            📋 Pod Logs
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Live log viewer — stream the last N lines from any registered workload.
          </p>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#94a3b8", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ accentColor: "#6366f1" }}
          />
          Auto-refresh (5s)
        </label>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Workload</label>
          <select
            value={selectedService}
            onChange={(e) => { setSelectedService(e.target.value); setLogs(null); setSearchResults(null); }}
            style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          >
            {services.length === 0 && <option value="">No services registered</option>}
            {services.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Pod</label>
          <select
            value={selectedPod}
            onChange={(e) => setSelectedPod(e.target.value)}
            style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          >
            <option value="">Any running pod</option>
            {pods.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.phase}) {p.ready ? "✓" : "✗"} {p.restarts > 0 ? `↺${p.restarts}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Lines</label>
          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
          >
            {[50, 100, 200, 500, 1000, 2000].map((n) => (
              <option key={n} value={n}>{n} lines</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchLogs}
          disabled={!selectedService || loading}
          style={{ padding: "7px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, alignSelf: "flex-end" }}
        >
          {loading ? "Loading…" : "Fetch Logs"}
        </button>
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Search logs…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
          onKeyDown={(e) => e.key === "Enter" && searchLogs()}
          style={{ flex: 1, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, padding: "6px 12px", fontSize: 13 }}
        />
        <button
          onClick={searchLogs}
          style={{ padding: "6px 14px", background: "#0f172a", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          Search All Pods
        </button>
        {searchResults && (
          <span style={{ alignSelf: "center", fontSize: 12, color: searchResults.matchCount > 0 ? "#a3cfff" : "#64748b" }}>
            {searchResults.matchCount} match{searchResults.matchCount !== 1 ? "es" : ""}
          </span>
        )}
        {(searchResults || searchQuery) && (
          <button
            onClick={() => { setSearchQuery(""); setSearchResults(null); }}
            style={{ padding: "6px 10px", background: "transparent", border: "1px solid #334155", color: "#64748b", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Log pane */}
      <div
        style={{
          flex: 1,
          background: "#050d1a",
          border: "1px solid #1e293b",
          borderRadius: 10,
          overflow: "auto",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 12,
          lineHeight: 1.6,
          padding: "12px 16px",
          minHeight: 300,
          maxHeight: 560,
        }}
      >
        {!logs && !loading && (
          <div style={{ color: "#334155", textAlign: "center", paddingTop: 60 }}>
            Select a workload and click "Fetch Logs" to begin.
          </div>
        )}
        {loading && (
          <div style={{ color: "#6366f1", textAlign: "center", paddingTop: 60 }}>
            ⟳ Fetching logs…
          </div>
        )}
        {logs?.note && (
          <div style={{ color: "#ffa94d", padding: "8px 0", marginBottom: 8, borderBottom: "1px solid #1e293b" }}>
            ⚠ {logs.note}
          </div>
        )}
        {!loading && logs && (
          <div style={{ color: "#475569", fontSize: 11, marginBottom: 8 }}>
            {logs.pod ? `pod: ${logs.pod}` : "any pod"} — {filtered.length} line{filtered.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}
        {filtered.map((line, i) => {
          const level = levelOf(line.line);
          return (
            <div
              key={i}
              style={{ display: "flex", gap: 12, borderRadius: 3, padding: "1px 0" }}
            >
              <span style={{ color: "#334155", minWidth: 40, textAlign: "right", userSelect: "none", fontSize: 11 }}>
                {line.lineNumber}
              </span>
              <span
                style={{ color: LEVEL_COLOR[level], whiteSpace: "pre-wrap", wordBreak: "break-all" }}
              >
                {line.line}
              </span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* Pod status pills */}
      {pods.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pods.map((p) => (
            <div
              key={p.name}
              onClick={() => setSelectedPod(p.name)}
              style={{
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 11,
                cursor: "pointer",
                background: selectedPod === p.name ? "#1e3a5f" : "#0f172a",
                border: `1px solid ${p.ready ? "#22c55e44" : "#ef444444"}`,
                color: p.ready ? "#86efac" : "#fca5a5",
              }}
            >
              {p.name.split("-").slice(-2).join("-")} {p.ready ? "●" : "○"}
              {p.restarts > 0 && <span style={{ color: "#ffa94d" }}> ↺{p.restarts}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

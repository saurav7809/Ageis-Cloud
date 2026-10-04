import { useEffect, useRef, useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface SearchResult {
  type: "service" | "alert" | "cluster" | "incident" | "metric";
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  tab: string;
}

const TYPE_ICON: Record<string, string> = {
  service: "⬢",
  alert: "🚨",
  cluster: "▦",
  incident: "⚠️",
  metric: "▲",
};

const TYPE_COLOR: Record<string, string> = {
  service: "#60a5fa",
  alert: "#f43f5e",
  cluster: "#22d3a0",
  incident: "#f59e0b",
  metric: "#c084fc",
};

interface GlobalSearchProps {
  token: string;
  onNavigate: (tab: string) => void;
}

export function GlobalSearch({ token, onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const lower = q.toLowerCase();

    try {
      const [services, alerts, clusters] = await Promise.all([
        fetch(`${API}/api/v1/microservices`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/v1/alerts`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
        fetch(`${API}/api/v1/clusters`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      ]);

      const out: SearchResult[] = [];

      // Services
      (Array.isArray(services) ? services : []).filter((s: any) =>
        s.name?.toLowerCase().includes(lower) || s.namespace?.toLowerCase().includes(lower)
      ).slice(0, 4).forEach((s: any) => out.push({
        type: "service", title: s.name, subtitle: `${s.namespace} · ${s.cluster}`,
        badge: s.health ?? "UNKNOWN", badgeColor: s.health === "HEALTHY" ? "#22d3a0" : "#f43f5e",
        tab: "microservices",
      }));

      // Alerts
      (Array.isArray(alerts) ? alerts : []).filter((a: any) =>
        a.serviceName?.toLowerCase().includes(lower) || a.message?.toLowerCase().includes(lower) || a.severity?.toLowerCase().includes(lower)
      ).slice(0, 3).forEach((a: any) => out.push({
        type: "alert", title: a.serviceName ?? "Alert", subtitle: a.message ?? a.severity,
        badge: a.severity, badgeColor: a.severity === "CRITICAL" ? "#f43f5e" : "#f59e0b",
        tab: "incidents",
      }));

      // Clusters
      (Array.isArray(clusters) ? clusters : []).filter((c: any) =>
        c.name?.toLowerCase().includes(lower) || c.region?.toLowerCase().includes(lower)
      ).slice(0, 3).forEach((c: any) => out.push({
        type: "cluster", title: c.name, subtitle: `${c.providerType} · ${c.region ?? "local"}`,
        badge: c.status, badgeColor: c.status === "HEALTHY" ? "#22d3a0" : "#f43f5e",
        tab: "clusters",
      }));

      setResults(out);
      setSelected(0);
    } catch { setResults([]); }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const pick = (r: SearchResult) => {
    onNavigate(r.tab);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) pick(results[selected]);
  };

  return (
    <>
      {/* Search trigger button in sidebar */}
      <button
        id="global-search-trigger"
        onClick={() => setOpen(true)}
        title="Search (Ctrl+K)"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "7px 12px", marginBottom: 8,
          background: "#0d1117", border: "1px solid #1a2332",
          borderRadius: 8, color: "#4d5d72", cursor: "pointer",
          fontSize: 12, transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#94a3b8"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2332"; e.currentTarget.style.color = "#4d5d72"; }}
      >
        <span>🔍</span>
        <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
        <kbd style={{ background: "#1a2332", border: "1px solid #243044", borderRadius: 4, padding: "1px 5px", fontSize: 10, color: "#4d5d72" }}>⌃K</kbd>
      </button>

      {/* Search modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "#000a",
            zIndex: 2000, display: "flex", alignItems: "flex-start",
            justifyContent: "center", paddingTop: "10vh",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 560, maxWidth: "90vw",
              background: "#0d1117", border: "1px solid #1a2332",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 24px 80px #000c, 0 0 0 1px #6366f120",
              animation: "slideUpChat 0.2s ease",
            }}
          >
            {/* Input */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #1a2332" }}>
              <span style={{ fontSize: 16, color: "#4d5d72" }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search services, alerts, clusters…"
                style={{
                  flex: 1, background: "none", border: "none",
                  color: "#e2e8f0", fontSize: 15, outline: "none",
                }}
              />
              {loading && <span style={{ color: "#4d5d72", fontSize: 12 }}>⟳</span>}
              <kbd onClick={() => setOpen(false)} style={{ background: "#1a2332", border: "1px solid #243044", borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "#4d5d72", cursor: "pointer" }}>Esc</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {results.length === 0 && query.trim() && !loading && (
                <div style={{ padding: "32px 20px", textAlign: "center", color: "#4d5d72", fontSize: 13 }}>
                  No results for "<strong style={{ color: "#94a3b8" }}>{query}</strong>"
                </div>
              )}
              {results.length === 0 && !query.trim() && (
                <div style={{ padding: "20px 18px" }}>
                  <div style={{ fontSize: 11, color: "#4d5d72", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Quick nav</div>
                  {[
                    { label: "Overview", icon: "◎", tab: "overview" },
                    { label: "Incidents", icon: "🚨", tab: "incidents" },
                    { label: "Metrics", icon: "▲", tab: "metrics" },
                    { label: "DORA Metrics", icon: "📊", tab: "dora" },
                    { label: "Chaos", icon: "☠️", tab: "chaos" },
                  ].map(n => (
                    <button key={n.tab} onClick={() => { onNavigate(n.tab); setOpen(false); }} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "9px 12px", background: "none",
                      border: "none", borderRadius: 8, color: "#94a3b8",
                      cursor: "pointer", fontSize: 13, textAlign: "left",
                      transition: "background 0.1s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#141b25"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                    >
                      <span style={{ width: 20 }}>{n.icon}</span> {n.label}
                    </button>
                  ))}
                </div>
              )}

              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pick(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    width: "100%", padding: "11px 18px", background: i === selected ? "#141b25" : "none",
                    border: "none", borderLeft: `3px solid ${i === selected ? TYPE_COLOR[r.type] : "transparent"}`,
                    cursor: "pointer", textAlign: "left", transition: "all 0.1s",
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span style={{ fontSize: 18, color: TYPE_COLOR[r.type], width: 24 }}>{TYPE_ICON[r.type]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#4d5d72" }}>{r.subtitle}</div>
                  </div>
                  {r.badge && (
                    <span style={{
                      background: (r.badgeColor ?? "#4d5d72") + "20",
                      color: r.badgeColor ?? "#4d5d72",
                      border: `1px solid ${(r.badgeColor ?? "#4d5d72")}40`,
                      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>{r.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {results.length > 0 && (
              <div style={{ padding: "8px 18px", borderTop: "1px solid #1a2332", display: "flex", gap: 16, fontSize: 11, color: "#4d5d72" }}>
                <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

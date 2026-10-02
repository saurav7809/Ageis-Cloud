import { useLiveEvents } from "./LiveEvents";
import type { LiveEvent } from "../api/client";

const EVENT_STYLE: Record<string, { icon: string; color: string }> = {
  scaling:                { icon: "⇅", color: "#60a5fa" },
  healing:                { icon: "✚", color: "#22d3a0" },
  alert:                  { icon: "⚠", color: "#f59e0b" },
  incident:               { icon: "🔴", color: "#f43f5e" },
  evaluation:             { icon: "◈", color: "#a78bfa" },
  "microservice-registered": { icon: "⬢", color: "#34d399" },
  experiment:             { icon: "⚗", color: "#fb923c" },
  deployment:             { icon: "🚀", color: "#38bdf8" },
  "pod-restart":          { icon: "↺", color: "#f472b6" },
};

function label(e: LiveEvent): string {
  const k = e.kind;
  const svc = e.payload?.serviceName ?? e.payload?.service ?? "";
  const cluster = e.payload?.clusterName ?? e.payload?.cluster ?? "";
  if (k === "scaling")   return `Auto-scaled ${svc}${cluster ? ` on ${cluster}` : ""}`;
  if (k === "healing")   return `Self-healed ${svc}${cluster ? ` on ${cluster}` : ""}`;
  if (k === "alert")     return `Alert: ${e.payload?.title ?? e.payload?.message ?? svc}`;
  if (k === "incident")  return `Incident opened: ${e.payload?.title ?? svc}`;
  if (k === "evaluation") return `SLO evaluated ${svc}`;
  if (k === "microservice-registered") return `Service registered: ${svc}`;
  if (k === "experiment") return `Chaos experiment on ${svc}`;
  if (k === "deployment") return `Deployed ${svc}`;
  return `${k.replace(/-/g, " ")}: ${svc}`;
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function LiveActivityBar() {
  const { connected, recent } = useLiveEvents();
  const visible = recent.slice(0, 6);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      background: "#0a0e17",
      borderBottom: "1px solid #1a2332",
      padding: "0 32px",
      height: 36,
      overflow: "hidden",
      fontSize: 12,
      position: "relative",
    }}>
      {/* Live pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        paddingRight: 16, marginRight: 16,
        borderRight: "1px solid #1a2332",
        flexShrink: 0,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: connected ? "#22d3a0" : "#f59e0b",
          boxShadow: connected ? "0 0 6px #22d3a0" : "none",
          display: "inline-block",
          animation: connected ? "live-pulse 2s infinite" : "none",
        }} />
        <span style={{ color: connected ? "#22d3a0" : "#f59e0b", fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {connected ? "Live" : "Reconnecting"}
        </span>
      </div>

      {/* Scrolling events */}
      {visible.length === 0 ? (
        <span style={{ color: "#4d5d72" }}>Waiting for events…</span>
      ) : (
        <div style={{ display: "flex", gap: 24, alignItems: "center", overflow: "hidden" }}>
          {visible.map((e, i) => {
            const st = EVENT_STYLE[e.kind] ?? { icon: "·", color: "#8895aa" };
            return (
              <div key={`${e.kind}-${e.timestamp}-${i}`} style={{
                display: "flex", alignItems: "center", gap: 6,
                opacity: i === 0 ? 1 : 1 - i * 0.15,
                flexShrink: 0,
                animation: i === 0 ? "slide-in 0.3s ease-out" : "none",
              }}>
                <span style={{ color: st.color, fontSize: 13 }}>{st.icon}</span>
                <span style={{ color: i === 0 ? "#c8d4e3" : "#5a6a80" }}>{label(e)}</span>
                <span style={{ color: "#2d3d52", fontSize: 10 }}>{timeAgo(e.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #22d3a0; }
          50%       { opacity: 0.6; box-shadow: 0 0 12px #22d3a0; }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

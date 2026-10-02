import React, { useMemo, useState, useEffect } from "react";
import type { DeploymentTarget } from "../api/client";
import { Badge } from "../components/ui";
import { useLiveEvents } from "../components/LiveEvents";

interface GoldenSignalsPageProps {
  targets: DeploymentTarget[];
}

export function GoldenSignalsPage({ targets }: GoldenSignalsPageProps) {
  const { connected, recent } = useLiveEvents();
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const liveSyncEvent = recent.find(e => e.kind === "live-sync" || e.kind === "evaluation");
    if (liveSyncEvent) setLastSync(new Date().toLocaleTimeString());
  }, [recent]);
  // Sort targets by health so the most degraded ones are at the top
  const sortedTargets = useMemo(() => {
    return [...targets].sort((a, b) => {
      if (a.status === "DEGRADED" && b.status !== "DEGRADED") return -1;
      if (b.status === "DEGRADED" && a.status !== "DEGRADED") return 1;
      return a.reliabilityScore - b.reliabilityScore;
    });
  }, [targets]);

  return (
    <div>
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>Golden Signals Heatmap</h1>
          <p>Live health overview of all running services across the fleet.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, background: "#0d1117", border: "1px solid #1a2332", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "#22d3a0" : "#f59e0b",
            animation: connected ? "pulse-dot 1.8s ease-in-out infinite" : "none",
            display: "inline-block", flexShrink: 0
          }} />
          <span style={{ color: connected ? "#22d3a0" : "#f59e0b", fontWeight: 600 }}>
            {connected ? "Live" : "Reconnecting"}
          </span>
          {lastSync && <span style={{ color: "#4d5d72" }}>· updated {lastSync}</span>}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16
      }}>
        {sortedTargets.map((target) => {
          const isDegraded = target.status === "DEGRADED";
          
          return (
            <div key={target.id} style={{
              background: "#0d1117",
              border: `1px solid ${isDegraded ? "#7f1d1d" : "#1a2332"}`,
              borderRadius: 14,
              padding: 20,
              boxShadow: isDegraded ? "0 0 20px rgba(244, 63, 94, 0.1)" : "none",
              transition: "all 0.2s ease"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#e8eef6", marginBottom: 4 }}>
                    {target.serviceName}
                  </div>
                  <div style={{ fontSize: 12, color: "#8895aa" }}>
                    {target.clusterName} / {target.namespace}
                  </div>
                </div>
                <Badge tone={isDegraded ? "bad" : "good"}>{target.status}</Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Latency */}
                <div style={{ background: "#060810", padding: 12, borderRadius: 8, border: "1px solid #1a2332" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Latency (p95)</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: target.latencyP95Ms > 500 ? "#f43f5e" : target.latencyP95Ms > 250 ? "#f59e0b" : "#22d3a0" }}>
                    {target.latencyP95Ms.toFixed(0)} ms
                  </div>
                </div>

                {/* Error Rate */}
                <div style={{ background: "#060810", padding: 12, borderRadius: 8, border: "1px solid #1a2332" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Error Rate</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: target.errorRatePct > 1 ? "#f43f5e" : target.errorRatePct > 0.1 ? "#f59e0b" : "#22d3a0" }}>
                    {target.errorRatePct.toFixed(2)}%
                  </div>
                </div>

                {/* Availability */}
                <div style={{ background: "#060810", padding: 12, borderRadius: 8, border: "1px solid #1a2332" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Availability</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: target.availabilityPct < 99 ? "#f43f5e" : target.availabilityPct < 99.9 ? "#f59e0b" : "#22d3a0" }}>
                    {target.availabilityPct.toFixed(2)}%
                  </div>
                </div>

                {/* Reliability Score */}
                <div style={{ background: "#060810", padding: 12, borderRadius: 8, border: "1px solid #1a2332" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Reliability</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: target.reliabilityScore < 70 ? "#f43f5e" : target.reliabilityScore < 90 ? "#f59e0b" : "#22d3a0" }}>
                    {target.reliabilityScore.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {targets.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 40px", color: "#8895aa" }}>
          No services running to display signals for.
        </div>
      )}
    </div>
  );
}

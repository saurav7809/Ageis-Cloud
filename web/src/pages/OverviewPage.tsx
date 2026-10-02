import { useEffect, useState } from "react";
import { useLiveRefresh } from "../components/LiveEvents";
import type { Overview } from "../api/client";
import { Card, Stat, StatusBadge, money, timeAgo } from "../components/ui";
import { TrendChart, ProviderBars } from "../components/Charts";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

interface ClusterSyncSummary {
  totalClusters: number;
  liveClusters: number;
  inventoryClusters: number;
  healthyClusters: number;
  hasLiveData: boolean;
  lastLiveSyncAt: string | null;
  syncIntervalSeconds: number;
}

function LiveStatusBar({ token }: { token?: string }) {
  const [summary, setSummary] = useState<ClusterSyncSummary | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const load = () => {
      fetch(`${API_URL}/api/v1/cluster-status/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          setSummary(d);
          setSecondsAgo(0);
        })
        .catch(() => {});
    };
    load();
  }, [token]);

  useLiveRefresh(["live-sync", "evaluation"], () => {
    fetch(`${API_URL}/api/v1/cluster-status/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setSummary(d);
        setSecondsAgo(0);
      })
      .catch(() => {});
  });

  // Tick the seconds counter each second
  useEffect(() => {
    const t = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [summary]);

  if (!summary) return null;

  const isLive = summary.hasLiveData && summary.liveClusters > 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "10px 18px",
      background: isLive ? "#0a1f12" : "#1a1205",
      border: `1px solid ${isLive ? "#166534" : "#713f12"}`,
      borderRadius: 10,
      marginBottom: 8,
      flexWrap: "wrap",
    }}>
      {/* Pulsing dot */}
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: isLive ? "#22c55e" : "#f59e0b",
          boxShadow: isLive ? "0 0 0 0 #22c55e88" : "0 0 0 0 #f59e0b88",
          animation: "pulse-dot 1.8s ease-in-out infinite",
          display: "inline-block",
        }} />
      </span>

      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: isLive ? "#86efac" : "#fbbf24" }}>
          {isLive ? "Live data — all readings are real" : "Partial live — some clusters are inventory only"}
        </span>
        <span style={{ fontSize: 12, color: "#64748b", marginLeft: 12 }}>
          {summary.liveClusters} live-connected
          {summary.inventoryClusters > 0 && ` · ${summary.inventoryClusters} cloud inventory (no kubeconfig)`}
        </span>
      </div>

      <div style={{ fontSize: 12, color: "#475569", textAlign: "right" }}>
        {isLive ? (
          <>
            <span style={{ color: "#94a3b8" }}>Synced </span>
            <span style={{ color: "#c4b5fd", fontWeight: 600 }}>{secondsAgo}s ago</span>
            <span style={{ color: "#334155" }}> · every {summary.syncIntervalSeconds}s</span>
          </>
        ) : (
          <span style={{ color: "#92400e" }}>Add kubeconfig to enable live sync</span>
        )}
      </div>
    </div>
  );
}

export function OverviewPage({ data, token }: { data: Overview; token?: string }) {
  return (
    <>
      <div className="page-head">
        <h1>Fleet Overview</h1>
        <p>
          Reliability posture across {data.totalClusters} clusters and{" "}
          {data.totalTargets} deployment targets.
        </p>
      </div>

      <LiveStatusBar token={token} />

      <div className="grid stat-row">
        <Stat
          label="Avg Reliability"
          value={data.avgScore.toFixed(1)}
          sub="across all targets"
        />
        <Stat
          label="Clusters"
          value={`${data.healthyClusters}/${data.totalClusters}`}
          sub={
            data.healthyClusters === data.totalClusters
              ? "all healthy"
              : `${data.totalClusters - data.healthyClusters} degraded`
          }
          tone={data.healthyClusters === data.totalClusters ? "good" : "warn"}
        />
        <Stat label="Running Replicas" value={data.totalReplicas} sub={`${data.totalServices} services`} />
        <Stat
          label="Open Alerts"
          value={data.openAlerts}
          sub={data.openAlerts ? "needs attention" : "all clear"}
          tone={data.openAlerts ? "bad" : "good"}
        />
        <Stat label="Monthly Spend" value={money(data.monthlyCostUsd)} sub="all providers" />
      </div>

      <div className="grid cols-2">
        <Card title="Reliability Trend" meta="last 14 days">
          <TrendChart points={data.scoreTrend} />
        </Card>

        <Card title="Score by Provider" meta="cross-cloud comparison">
          <ProviderBars data={data.scoreByProvider} />
          <div className="legend">
            {data.scoreByProvider.map((p) => (
              <span className="legend-item" key={p.provider}>
                {p.provider} · {money(p.costUsd)}/mo
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card title="Control Plane Engines">
          {data.engineStatus.map((e) => (
            <div className="engine-item" key={e.name}>
              <div className="row-main">
                <div className="row-title">{e.name}</div>
                <div className="row-sub">{e.detail}</div>
              </div>
              <span className="mono" style={{ color: "var(--text-dim)" }}>
                {e.actionsLast24h}
              </span>
              <StatusBadge status={e.status} />
            </div>
          ))}
        </Card>

        <div className="grid" style={{ gap: 14, alignContent: "start" }}>
          <Card title="Recent Scaling Decisions">
            <div className="rows">
              {data.recentScaling.map((s) => (
                <div className="row-item" key={s.id}>
                  <div className="row-main">
                    <div className="row-title">
                      {s.previousReplicas} → {s.newReplicas} replicas
                    </div>
                    <div className="row-sub">
                      {s.targetLabel} · {s.triggerMetric} {s.triggerValue}
                    </div>
                  </div>
                  <span className="row-time">{timeAgo(s.decidedAt)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Observability Sources">
            {data.observabilityFeed.map((o) => (
              <div className="engine-item" key={o.name}>
                <div className="row-main">
                  <div className="row-title">{o.name}</div>
                  <div className="row-sub">
                    {o.kind} · {o.ingestRate}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </div>
            ))}
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%   { box-shadow: 0 0 0 0 currentColor; }
          70%  { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
      `}</style>
    </>
  );
}

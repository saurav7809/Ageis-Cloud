import { useCallback, useEffect, useState } from "react";
import {
  getAlerts,
  getClusters,
  getExperiments,
  getHealingEvents,
  getOverview,
  getPolicies,
  getScalingEvents,
  getServices,
  getSlos,
  getTargets,
  me,
  type Alert,
  type Cluster,
  type DeploymentTarget,
  type ExperimentRun,
  type HealingEvent,
  type MeResponse,
  type Overview,
  type Policy,
  type ScalingEvent,
  type Service,
  type Slo,
} from "../api/client";
import { Brand } from "./ui";
import { OverviewPage } from "../pages/OverviewPage";
import { ClustersPage } from "../pages/ClustersPage";
import { ServicesPage } from "../pages/ServicesPage";
import { ControlPlanePage } from "../pages/ControlPlanePage";
import { ReliabilityPage } from "../pages/ReliabilityPage";
import { AlertsPage } from "../pages/AlertsPage";
import { MicroservicesPage } from "../pages/MicroservicesPage";
import { LiveEventsProvider, useLiveEvents, useLiveRefresh } from "./LiveEvents";
import { DiagnosticsPage } from "../pages/DiagnosticsPage";
import { GraphPage } from "../pages/GraphPage";
import { OptimizationPage } from "../pages/OptimizationPage";
import { LogsPage } from "../pages/LogsPage";
import { MetricsPage } from "../pages/MetricsPage";
import { CicdPage } from "../pages/CicdPage";
import { SimulatorPage } from "../pages/SimulatorPage";
import { DeployPage } from "../pages/DeployPage";
import { IncidentsPage } from "../pages/IncidentsPage";
import { ChaosPage } from "../pages/ChaosPage";
import { ManifestsPage } from "../pages/ManifestsPage";
import { LiveActivityBar } from "./LiveActivityBar";
import { NotificationsPage } from "../pages/NotificationsPage";
import { SloConfigPage } from "../pages/SloConfigPage";
import { GoldenSignalsPage } from "../pages/GoldenSignalsPage";
import { ClusterOnboardingPage } from "../pages/ClusterOnboardingPage";
import { AiChatWidget } from "./AiChatWidget";

type Tab =
  | "microservices"
  | "overview"
  | "clusters"
  | "services"
  | "control"
  | "reliability"
  | "graph"
  | "diagnostics"
  | "optimization"
  | "alerts"
  | "logs"
  | "metrics"
  | "cicd"
  | "simulator"
  | "deploy"
  | "incidents"
  | "chaos"
  | "manifests"
  | "notifications"
  | "slo-config"
  | "golden-signals"
  | "cluster-onboarding";

const NAV: { id: Tab; label: string; icon: string }[] = [
  // Ordered as the platform works: register and run a service first, then the
  // capabilities that only mean anything once one is running.
  { id: "microservices", label: "Microservices", icon: "⬢" },
  { id: "golden-signals", label: "Golden Signals", icon: "🔥" },
  { id: "overview", label: "Overview", icon: "◎" },
  { id: "metrics", label: "Metrics", icon: "▲" },
  { id: "logs", label: "Logs", icon: "≡" },
  { id: "clusters", label: "Clusters", icon: "▦" },
  { id: "cluster-onboarding", label: "Add Cluster", icon: "➕" },
  { id: "services", label: "Fleet detail", icon: "◈" },
  { id: "control", label: "Control Plane", icon: "⟳" },
  { id: "reliability", label: "Reliability", icon: "◔" },
  { id: "slo-config", label: "SLO Config", icon: "🎯" },
  { id: "graph", label: "Dependencies", icon: "⇄" },
  { id: "diagnostics", label: "Diagnostics", icon: "◇" },
  { id: "optimization", label: "Optimization", icon: "◐" },
  { id: "cicd", label: "CI/CD", icon: "⊕" },
  { id: "simulator", label: "Simulator", icon: "🧪" },
  { id: "deploy", label: "Deploy", icon: "🚀" },
  { id: "incidents", label: "Incidents", icon: "🚨" },
  { id: "chaos", label: "Chaos", icon: "☠️" },
  { id: "manifests", label: "Manifests", icon: "📄" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "alerts", label: "Alerts", icon: "△" },
];

interface Data {
  overview: Overview;
  clusters: Cluster[];
  services: Service[];
  targets: DeploymentTarget[];
  slos: Slo[];
  policies: Policy[];
  alerts: Alert[];
  experiments: ExperimentRun[];
  scaling: ScalingEvent[];
  healing: HealingEvent[];
}

export function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  // One live connection for every page beneath, opened once per session.
  return (
    <LiveEventsProvider token={token}>
      <DashboardShell token={token} onLogout={onLogout} />
    </LiveEventsProvider>
  );
}

function DashboardShell({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("microservices");
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [
        overview,
        clusters,
        services,
        targets,
        slos,
        policies,
        alerts,
        experiments,
        scaling,
        healing,
      ] = await Promise.all([
        getOverview(token),
        getClusters(token),
        getServices(token),
        getTargets(token),
        getSlos(token),
        getPolicies(token),
        getAlerts(token),
        getExperiments(token),
        getScalingEvents(token),
        getHealingEvents(token),
      ]);
      setError(null);
      setData({
        overview,
        clusters,
        services,
        targets,
        slos,
        policies,
        alerts,
        experiments,
        scaling,
        healing,
      });
    } catch (e: any) {
      // 401 = token invalid/expired → force re-login immediately
      if (e?.status === 401) {
        onLogout();
        return;
      }
      // Any other error (503, network down, etc.) shows a retry banner
      // but does NOT wipe existing data so the UI stays usable.
      setError("Backend unreachable. Check that the control plane is running.");
    }
  }, [token, onLogout]);

  useEffect(() => {
    me(token)
      .then(setProfile)
      .catch((e: any) => {
        if (e?.status === 401) onLogout();
        else setError("Could not reach the backend.");
      });
    load();
  }, [token, load, onLogout]);

  // The fleet is reloaded when the platform changes it, not on a timer. These are
  // the events that alter what these pages show: a replica count, a pod, a score,
  // an alert, a newly registered service.
  useLiveRefresh(
    [
      "scaling",
      "healing",
      "evaluation",
      "alert",
      "microservice-registered",
      "experiment",
      "incident",
      "live-sync",
    ],
    load,
  );

  const { connected } = useLiveEvents();
  const openAlerts = data?.alerts.filter((a) => a.status === "OPEN").length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Global AI Chat Widget — floats on every page */}
      <AiChatWidget token={token} />

      {/* Top live activity strip */}
      <LiveActivityBar />
      <div className="layout" style={{ flex: 1 }}>
      <aside className="sidebar">
        <Brand size={26} />

        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? "active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              <span aria-hidden="true" style={{ width: 15 }}>
                {n.icon}
              </span>
              {n.label}
              {n.id === "alerts" && openAlerts > 0 && (
                <span className="nav-count">{openAlerts}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="avatar">
            {(profile?.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="who">
            <div className="who-email">{profile?.email ?? "…"}</div>
            <div className={`live-dot ${connected ? "live-on" : "live-off"}`}>
              {connected ? "live" : "reconnecting"}
            </div>
            <div className="who-role">{profile?.role ?? ""}</div>
          </div>
          <button className="btn btn-ghost" onClick={onLogout}>
            Exit
          </button>
        </div>
      </aside>

      <main className="main">
        {error && (
          <div style={{
            margin: "16px 0", padding: "14px 18px",
            background: "#1a0808", border: "1px solid #7f1d1d", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ flex: 1, color: "#fca5a5", fontSize: 13 }}>{error}</span>
            <button onClick={load} style={{
              padding: "6px 14px", borderRadius: 7, border: "1px solid #7f1d1d",
              background: "#2d0a0a", color: "#fca5a5", cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}>⟳ Retry</button>
            <button onClick={onLogout} style={{
              padding: "6px 14px", borderRadius: 7, border: "1px solid #1e2a3a",
              background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 12,
            }}>Sign in again</button>
          </div>
        )}

        {!data && !error && <div className="loading">Loading platform data…</div>}


        {data && (
          <>
            {tab === "overview" && <OverviewPage data={data.overview} token={token} />}
            {tab === "clusters" && (
              <ClustersPage clusters={data.clusters} policies={data.policies} />
            )}
            {tab === "graph" && <GraphPage token={token} />}
            {tab === "diagnostics" && <DiagnosticsPage token={token} />}
            {tab === "optimization" && <OptimizationPage token={token} />}
            {tab === "microservices" && (
              <MicroservicesPage token={token} clusters={data.clusters} />
            )}
            {tab === "services" && (
              <ServicesPage services={data.services} targets={data.targets} />
            )}
            {tab === "control" && (
              <ControlPlanePage scaling={data.scaling} healing={data.healing} />
            )}
            {tab === "reliability" && (
              <ReliabilityPage slos={data.slos} experiments={data.experiments} />
            )}
            {tab === "alerts" && (
              <AlertsPage alerts={data.alerts} token={token} onChanged={load} />
            )}
            {tab === "logs" && <LogsPage token={token} />}
            {tab === "metrics" && <MetricsPage token={token} />}
            {tab === "cicd" && <CicdPage token={token} />}
            {tab === "simulator" && <SimulatorPage token={token} />}
            {tab === "deploy" && <DeployPage token={token} />}
            {tab === "incidents" && <IncidentsPage token={token} />}
            {tab === "chaos" && <ChaosPage token={token} />}
            {tab === "manifests" && <ManifestsPage token={token} />}
            {tab === "notifications" && <NotificationsPage token={token} />}
            {tab === "slo-config" && <SloConfigPage token={token} />}
            {tab === "golden-signals" && <GoldenSignalsPage targets={data.targets} />}
            {tab === "cluster-onboarding" && <ClusterOnboardingPage token={token} />}
          </>
        )}
      </main>
    </div>
    </div>
  );
}

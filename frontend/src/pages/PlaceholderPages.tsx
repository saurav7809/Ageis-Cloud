import React from 'react'
import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
  phase: string
}

/**
 * Placeholder page shown for features not yet implemented.
 * Displays the planned phase for each feature.
 */
export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center min-h-96">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
             style={{ background: 'rgba(99,102,241,0.1)' }}>
          <Construction size={28} color="#6366f1" />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        <span className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
          {phase}
        </span>
      </div>
    </div>
  )
}

// Individual placeholder pages
export const ProjectsPage       = () => <PlaceholderPage title="Projects"       description="Create and manage your project workspaces."          phase="Phase 4" />
export const ApplicationsPage   = () => <PlaceholderPage title="Applications"   description="Manage applications within your projects."          phase="Phase 5" />
export const ServicesPage       = () => <PlaceholderPage title="Microservices"  description="Configure and manage your microservices."           phase="Phase 7" />
export const DeploymentsPage    = () => <PlaceholderPage title="Deployments"    description="Deploy and manage Kubernetes workloads."            phase="Phase 9" />
export const MonitoringPage     = () => <PlaceholderPage title="Monitoring"     description="Prometheus metrics — CPU, memory, requests."        phase="Phase 13" />
export const LogsPage           = () => <PlaceholderPage title="Logs"           description="View and search application logs via Loki."         phase="Phase 14" />
export const ScalingPage        = () => <PlaceholderPage title="Auto Scaling"   description="Configure Kubernetes HPA scaling policies."         phase="Phase 16" />
export const IncidentsPage      = () => <PlaceholderPage title="Incidents"      description="Detect and manage reliability incidents."           phase="Phase 19" />
export const ReliabilityPage    = () => <PlaceholderPage title="Reliability"    description="SLO tracking and reliability metrics."              phase="Phase 18" />
export const ChaosPage          = () => <PlaceholderPage title="Chaos Engineering" description="Run controlled experiments with Chaos Mesh."    phase="Phase 23" />
export const CostPage           = () => <PlaceholderPage title="Cost"           description="Resource cost analysis via OpenCost."               phase="Phase 24" />
export const AuditPage          = () => <PlaceholderPage title="Audit Logs"     description="Immutable record of all platform actions."          phase="Phase 27" />
export const SettingsPage       = () => <PlaceholderPage title="Settings"       description="Platform configuration and preferences."            phase="Phase 27" />

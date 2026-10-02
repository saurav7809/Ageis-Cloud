import React from 'react'
import {
  Layers, Server, Rocket, CheckCircle2,
  AlertTriangle, Cpu, MemoryStick, Activity,
  TrendingUp, ArrowRight, Shield
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// =====================================================
// Dashboard Home — Overview & Summary Cards
// =====================================================

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  trend?: { value: string; up: boolean }
  glowColor?: string
}

function StatCard({ title, value, subtitle, icon: Icon, iconColor, trend, glowColor }: StatCardProps) {
  return (
    <div className="rounded-xl p-5 border card-hover"
         style={{
           background: 'var(--surface-100)',
           borderColor: 'var(--border-subtle)',
         }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
             style={{ background: `${iconColor}20` }}>
          <Icon size={20} color={iconColor} />
        </div>
        {trend && (
          <span className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  background: trend.up ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                  color: trend.up ? '#10b981' : '#f43f5e'
                }}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{title}</div>
      {subtitle && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>
      )}
    </div>
  )
}

interface QuickActionProps {
  label: string
  description: string
  href: string
  color: string
}

function QuickAction({ label, description, href, color }: QuickActionProps) {
  return (
    <a href={href}
       className="flex items-center justify-between p-4 rounded-xl border cursor-pointer group transition-all"
       style={{ background: 'var(--surface-100)', borderColor: 'var(--border-subtle)' }}
       onMouseEnter={(e) => {
         e.currentTarget.style.borderColor = `${color}50`
         e.currentTarget.style.background = `${color}08`
       }}
       onMouseLeave={(e) => {
         e.currentTarget.style.borderColor = 'var(--border-subtle)'
         e.currentTarget.style.background = 'var(--surface-100)'
       }}>
      <div>
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>
      </div>
      <ArrowRight size={16} style={{ color }} className="group-hover:translate-x-1 transition-transform" />
    </a>
  )
}

export default function DashboardHomePage() {
  const { user } = useAuth()

  const stats = [
    { title: 'Applications', value: 0, icon: Layers, iconColor: '#6366f1', subtitle: 'Across all projects' },
    { title: 'Running Services', value: 0, icon: Server, iconColor: '#22d3ee', subtitle: 'Active deployments' },
    { title: 'Healthy Pods', value: 0, icon: CheckCircle2, iconColor: '#10b981', subtitle: 'Running & ready' },
    { title: 'Unhealthy Pods', value: 0, icon: AlertTriangle, iconColor: '#f43f5e', subtitle: 'Needs attention' },
    { title: 'Active Incidents', value: 0, icon: AlertTriangle, iconColor: '#f59e0b', subtitle: 'Open incidents' },
    { title: 'CPU Usage', value: '—', icon: Cpu, iconColor: '#7c3aed', subtitle: 'Cluster average' },
    { title: 'Memory Usage', value: '—', icon: MemoryStick, iconColor: '#22d3ee', subtitle: 'Cluster average' },
    { title: 'Deployments (24h)', value: 0, icon: Rocket, iconColor: '#10b981', subtitle: 'Last 24 hours' },
  ]

  return (
    <div className="animate-fade-in space-y-6">

      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Good morning, {user?.firstName} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Here's what's happening across your Kubernetes clusters.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border"
             style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-medium" style={{ color: '#10b981' }}>All Systems Normal</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-3 gap-6">

        {/* Quick Actions */}
        <div className="col-span-1">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            QUICK ACTIONS
          </h2>
          <div className="space-y-2">
            <QuickAction
              label="New Project"
              description="Create a new project workspace"
              href="/dashboard/projects"
              color="#6366f1"
            />
            <QuickAction
              label="Deploy Service"
              description="Deploy a configured microservice"
              href="/dashboard/deployments"
              color="#22d3ee"
            />
            <QuickAction
              label="View Incidents"
              description="Check active reliability incidents"
              href="/dashboard/incidents"
              color="#f59e0b"
            />
            <QuickAction
              label="Monitor Cluster"
              description="View CPU, memory, and request metrics"
              href="/dashboard/monitoring"
              color="#10b981"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-2">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            RECENT ACTIVITY
          </h2>
          <div className="rounded-xl border p-6 flex flex-col items-center justify-center text-center"
               style={{ background: 'var(--surface-100)', borderColor: 'var(--border-subtle)', minHeight: '250px' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: 'rgba(99,102,241,0.1)' }}>
              <Shield size={28} color="#6366f1" />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No activity yet
            </h3>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
              Start by creating a project and deploying your first microservice to Kubernetes.
            </p>
            <a href="/dashboard/projects"
               className="btn btn-primary mt-4 text-sm">
              Create Your First Project
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

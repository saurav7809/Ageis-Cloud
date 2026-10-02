import React from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
  Shield, LayoutDashboard, FolderKanban, Layers, Server,
  Rocket, Activity, FileText, BarChart3, AlertTriangle,
  Zap, TestTube, DollarSign, FileSearch, Settings, LogOut,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// =====================================================
// Dashboard Layout — Sidebar + Top Bar + Content Area
// =====================================================

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/dashboard/applications', icon: Layers, label: 'Applications' },
  { to: '/dashboard/services', icon: Server, label: 'Microservices' },
  { to: '/dashboard/deployments', icon: Rocket, label: 'Deployments' },
  null, // separator
  { to: '/dashboard/monitoring', icon: Activity, label: 'Monitoring' },
  { to: '/dashboard/logs', icon: FileText, label: 'Logs' },
  { to: '/dashboard/scaling', icon: BarChart3, label: 'Auto Scaling' },
  null, // separator
  { to: '/dashboard/incidents', icon: AlertTriangle, label: 'Incidents' },
  { to: '/dashboard/reliability', icon: Zap, label: 'Reliability' },
  { to: '/dashboard/chaos', icon: TestTube, label: 'Chaos' },
  { to: '/dashboard/cost', icon: DollarSign, label: 'Cost' },
  null, // separator
  { to: '/dashboard/audit', icon: FileSearch, label: 'Audit Logs' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>

      {/* ===== SIDEBAR ===== */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r overflow-y-auto"
             style={{
               background: 'var(--surface-50)',
               borderColor: 'var(--border-subtle)',
             }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b"
             style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            <Shield size={18} color="white" />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>AegisCloud</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Control Plane</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item, idx) => {
            if (item === null) {
              return <div key={`sep-${idx}`} className="my-2 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
            }
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }>
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3 p-2 rounded-lg"
               style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                 style={{ background: 'linear-gradient(135deg, #6366f1, #22d3ee)', color: 'white' }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {user?.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                style={{
                  background: 'rgba(15, 15, 26, 0.8)',
                  borderColor: 'var(--border-subtle)',
                  backdropFilter: 'blur(12px)',
                }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium px-2 py-0.5 rounded"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              docker-desktop
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm"
                 style={{ color: 'var(--text-secondary)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Kubernetes Connected
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

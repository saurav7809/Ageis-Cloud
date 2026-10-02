import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * ProtectedRoute — Redirects unauthenticated users to login.
 * Shows a loading spinner while auth state is being hydrated from storage.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-0)' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} color="#6366f1" className="animate-spin" />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading AegisCloud...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

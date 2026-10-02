import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'

// =====================================================
// Login Page — AegisCloud Authentication
// =====================================================

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const authResponse = await authApi.login({ email, password })
      login(authResponse)
      navigate('/dashboard')
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: 'var(--surface-0)' }}>

      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #22d3ee, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
             style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md mx-4 animate-fade-in">
        <div className="glass rounded-2xl p-8 shadow-2xl"
             style={{ boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.1)' }}>

          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                 style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 25px rgba(99,102,241,0.4)' }}>
              <Shield size={32} color="white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Welcome to <span className="gradient-text">AegisCloud</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Kubernetes Deployment & Reliability Platform
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 rounded-lg flex items-center gap-2 animate-slide-up"
                 style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
              <AlertCircle size={16} color="#f43f5e" />
              <span className="text-sm" style={{ color: '#f43f5e' }}>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full mt-2">
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Register Link */}
          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-medium" style={{ color: 'var(--brand-400)' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

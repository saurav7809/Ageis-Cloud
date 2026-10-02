import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'

// =====================================================
// Register Page — Create AegisCloud Account
// =====================================================

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const passwordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (pwd.length < 6) return { level: 1, label: 'Weak', color: '#f43f5e' }
    if (pwd.length < 8) return { level: 2, label: 'Fair', color: '#f59e0b' }
    if (pwd.match(/[A-Z]/) && pwd.match(/[0-9]/)) return { level: 4, label: 'Strong', color: '#10b981' }
    return { level: 3, label: 'Good', color: '#22d3ee' }
  }

  const strength = passwordStrength(form.password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    try {
      const authResponse = await authApi.register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
      })
      login(authResponse)
      navigate('/dashboard')
    } catch (err: any) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-8"
         style={{ background: 'var(--surface-0)' }}>

      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-md mx-4 animate-fade-in">
        <div className="glass rounded-2xl p-8 shadow-2xl">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                 style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 25px rgba(99,102,241,0.4)' }}>
              <Shield size={32} color="white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Join <span className="gradient-text">AegisCloud</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Create your developer account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg flex items-center gap-2"
                 style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
              <AlertCircle size={16} color="#f43f5e" />
              <span className="text-sm" style={{ color: '#f43f5e' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  First Name
                </label>
                <input
                  id="reg-firstname"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className="input"
                  placeholder="Jane"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Last Name
                </label>
                <input
                  id="reg-lastname"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className="input"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="input"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="input pr-10"
                  placeholder="Min. 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength bar */}
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                           style={{
                             background: i <= strength.level ? strength.color : 'rgba(255,255,255,0.1)'
                           }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: strength.color }}>
                    Password strength: {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className="input pr-10"
                  placeholder="Repeat your password"
                  required
                />
                {form.confirmPassword && form.password === form.confirmPassword && (
                  <CheckCircle size={16} color="#10b981" className="absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full mt-2">
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account...</>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium" style={{ color: 'var(--brand-400)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

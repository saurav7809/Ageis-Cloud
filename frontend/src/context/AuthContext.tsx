import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { UserProfile, AuthResponse } from '../types/auth'

// =====================================================
// Auth Context — Global authentication state management
// =====================================================

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (authResponse: AuthResponse) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'aegiscloud_token'
const USER_KEY = 'aegiscloud_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  const login = (authResponse: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, authResponse.token)
    localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user))
    setToken(authResponse.token)
    setUser(authResponse.user)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

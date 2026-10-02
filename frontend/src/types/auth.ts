// =====================================================
// AegisCloud TypeScript Types
// =====================================================

// Auth types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'DEVELOPER' | 'VIEWER'
  createdAt: string
}

export interface AuthResponse {
  token: string
  tokenType: string
  expiresIn: number
  user: UserProfile
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
  timestamp: string
}

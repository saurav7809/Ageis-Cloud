import apiClient from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '../types/auth'

// =====================================================
// Authentication API calls
// =====================================================

export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', data)
    return response.data.data
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data)
    return response.data.data
  },

  me: async (): Promise<UserProfile> => {
    const response = await apiClient.get('/auth/me')
    return response.data.data
  },
}

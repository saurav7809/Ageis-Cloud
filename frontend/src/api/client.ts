import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'

// =====================================================
// AegisCloud API Client
// Configured Axios instance for all backend communication
// =====================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// -------------------------------------------------------
// Request Interceptor — Attach JWT token to every request
// -------------------------------------------------------
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('aegiscloud_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// -------------------------------------------------------
// Response Interceptor — Handle auth errors globally
// -------------------------------------------------------
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear and redirect to login
      localStorage.removeItem('aegiscloud_token')
      localStorage.removeItem('aegiscloud_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient

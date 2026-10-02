import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardLayout from './pages/DashboardLayout'
import DashboardHomePage from './pages/DashboardHomePage'
import {
  ProjectsPage, ApplicationsPage, ServicesPage, DeploymentsPage,
  MonitoringPage, LogsPage, ScalingPage, IncidentsPage, ReliabilityPage,
  ChaosPage, CostPage, AuditPage, SettingsPage
} from './pages/PlaceholderPages'

// =====================================================
// AegisCloud Application Router
// =====================================================

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected dashboard routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHomePage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="deployments" element={<DeploymentsPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="scaling" element={<ScalingPage />} />
              <Route path="incidents" element={<IncidentsPage />} />
              <Route path="reliability" element={<ReliabilityPage />} />
              <Route path="chaos" element={<ChaosPage />} />
              <Route path="cost" element={<CostPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

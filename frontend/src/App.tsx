import { Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/LoginPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'
import DashboardPage from '@/pages/DashboardPage'
import FunnelsPage from '@/pages/FunnelsPage'
import RetentionPage from '@/pages/RetentionPage'
import AnomaliesPage from '@/pages/AnomaliesPage'
import AiCopilotPage from '@/pages/AiCopilotPage' // <-- Add this import

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/funnels" element={<ProtectedRoute><FunnelsPage /></ProtectedRoute>} />
      <Route path="/retention" element={<ProtectedRoute><RetentionPage /></ProtectedRoute>} />
      <Route path="/anomalies" element={<ProtectedRoute><AnomaliesPage /></ProtectedRoute>} />

      {/* 👇 Update the AI route 👇 */}
      <Route path="/ai" element={<ProtectedRoute><AiCopilotPage /></ProtectedRoute>} />

      <Route path="/settings" element={<ProtectedRoute><div className="text-white text-lg">Settings — Step 12</div></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

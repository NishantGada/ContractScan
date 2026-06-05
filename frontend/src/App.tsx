import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from '@/hooks/useAuth'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import VendorDetailPage from '@/pages/VendorDetailPage'

/** Full-screen placeholder shown while the initial session is hydrating. */
function AuthLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <span className="font-mono text-sm text-text-muted">Loading…</span>
    </div>
  )
}

/** Gate for authenticated-only routes — redirects to /login, remembering where we came from. */
function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

/** Keeps signed-in users away from the login/register screens. */
function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoading />
  if (user) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendors/:vendorId"
        element={
          <ProtectedRoute>
            <VendorDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

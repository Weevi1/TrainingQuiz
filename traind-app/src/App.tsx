import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { BrandingProvider } from './contexts/BrandingContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ProtectedRoute } from './components/ProtectedRoute'

// Participant routes — eagerly loaded (hot path for 30-50 concurrent users)
import { JoinSession } from './pages/JoinSession'
import { PlaySession } from './pages/PlaySession'
import { ParticipantResults } from './pages/ParticipantResults'

// Trainer/Admin routes — lazy-loaded (code-split into separate chunks)
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const OrganizationSetup = lazy(() => import('./pages/OrganizationSetup').then(m => ({ default: m.OrganizationSetup })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const QuizManagement = lazy(() => import('./pages/QuizManagement').then(m => ({ default: m.QuizManagement })))
const QuizBuilder = lazy(() => import('./pages/QuizBuilder').then(m => ({ default: m.QuizBuilder })))
const SessionManagement = lazy(() => import('./pages/SessionManagement').then(m => ({ default: m.SessionManagement })))
const SessionCreator = lazy(() => import('./pages/SessionCreator').then(m => ({ default: m.SessionCreator })))
const SessionControl = lazy(() => import('./pages/SessionControl').then(m => ({ default: m.SessionControl })))
const AdminSessionDetails = lazy(() => import('./pages/AdminSessionDetails').then(m => ({ default: m.AdminSessionDetails })))
const BillingManagement = lazy(() => import('./pages/BillingManagement').then(m => ({ default: m.BillingManagement })))
const BillingSuccess = lazy(() => import('./pages/BillingSuccess').then(m => ({ default: m.BillingSuccess })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite').then(m => ({ default: m.AcceptInvite })))
const PlatformAdmin = lazy(() => import('./pages/PlatformAdmin').then(m => ({ default: m.PlatformAdmin })))

function App() {
  return (
    <Router>
      <AuthProvider>
        <BrandingProvider>
          <div className="min-h-screen bg-background text-text">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<OrganizationSetup />} />

                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/setup"
                  element={
                    <ProtectedRoute>
                      <OrganizationSetup />
                    </ProtectedRoute>
                  }
                />

                {/* Quiz routes */}
                <Route
                  path="/quizzes"
                  element={
                    <ProtectedRoute>
                      <QuizManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/quiz/new"
                  element={
                    <ProtectedRoute>
                      <QuizBuilder />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/quiz/:quizId"
                  element={
                    <ProtectedRoute>
                      <QuizBuilder />
                    </ProtectedRoute>
                  }
                />

                {/* Session routes */}
                <Route
                  path="/sessions"
                  element={
                    <ProtectedRoute>
                      <SessionManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/session/create"
                  element={
                    <ProtectedRoute>
                      <SessionCreator />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/session/create/:gameType"
                  element={
                    <ProtectedRoute>
                      <SessionCreator />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/session/:sessionId/report"
                  element={
                    <ProtectedRoute>
                      <AdminSessionDetails />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/session/:sessionId"
                  element={
                    <ProtectedRoute>
                      <SessionControl />
                    </ProtectedRoute>
                  }
                />

                {/* Settings route */}
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />

                {/* Platform Admin */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <PlatformAdmin />
                    </ProtectedRoute>
                  }
                />

                {/* Billing routes */}
                <Route
                  path="/billing"
                  element={
                    <ProtectedRoute>
                      <BillingManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/billing/success"
                  element={
                    <ProtectedRoute>
                      <BillingSuccess />
                    </ProtectedRoute>
                  }
                />

                {/* Invitation acceptance (public - handles own auth) */}
                <Route path="/invite/accept" element={<AcceptInvite />} />

                {/* Participant routes (public - no authentication required) */}
                <Route path="/join" element={<JoinSession />} />
                <Route path="/join/:sessionCode" element={<JoinSession />} />
                <Route path="/play/:sessionCode" element={<PlaySession />} />
                <Route path="/results" element={<ParticipantResults />} />

                {/* Debug route - presenter results with mock data, no auth */}
                <Route path="/debug/results" element={<SessionControl />} />

                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </BrandingProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

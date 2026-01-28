import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { BrandingProvider } from './contexts/BrandingContext'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { OrganizationSetup } from './pages/OrganizationSetup'
import { QuizManagement } from './pages/QuizManagement'
import { QuizBuilder } from './pages/QuizBuilder'
import { SessionManagement } from './pages/SessionManagement'
import { SessionCreator } from './pages/SessionCreator'
import { JoinSession } from './pages/JoinSession'
import { PlaySession } from './pages/PlaySession'
import { ParticipantResults } from './pages/ParticipantResults'
import { SessionControl } from './pages/SessionControl'
import { BillingManagement } from './pages/BillingManagement'
import { BillingSuccess } from './pages/BillingSuccess'
import { Settings } from './pages/Settings'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <Router>
      <AuthProvider>
        <BrandingProvider>
          <div className="min-h-screen bg-background text-text">
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

              {/* Participant routes (public - no authentication required) */}
              <Route path="/join" element={<JoinSession />} />
              <Route path="/join/:sessionCode" element={<JoinSession />} />
              <Route path="/play/:sessionCode" element={<PlaySession />} />
              <Route path="/results" element={<ParticipantResults />} />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Catch all - redirect to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </BrandingProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

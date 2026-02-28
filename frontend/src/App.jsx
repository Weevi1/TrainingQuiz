import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import QuizBuilder from './pages/QuizBuilder'
import QuizManagement from './pages/QuizManagement'
import QuizSession from './pages/QuizSession'
import QuizTaking from './pages/QuizTaking'
import Results from './pages/Results'
import SessionResults from './pages/SessionResults'
import AdminSessionDetails from './pages/AdminSessionDetails'
import ScratchCardSetup from './pages/ScratchCardSetup'
import ScratchCardSession from './pages/ScratchCardSession'
import ScratchCard from './pages/ScratchCard'
import ScratchCardResults from './pages/ScratchCardResults'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gb-navy">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            
            {/* Protected Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/quiz/create" element={
              <ProtectedRoute>
                <QuizBuilder />
              </ProtectedRoute>
            } />
            <Route path="/admin/quiz/:quizId/edit" element={
              <ProtectedRoute>
                <QuizBuilder />
              </ProtectedRoute>
            } />
            <Route path="/admin/quizzes" element={
              <ProtectedRoute>
                <QuizManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/session/:sessionId" element={
              <ProtectedRoute>
                <QuizSession />
              </ProtectedRoute>
            } />
            <Route path="/admin/results" element={
              <ProtectedRoute>
                <SessionResults />
              </ProtectedRoute>
            } />
            <Route path="/admin/results/:sessionId" element={
              <ProtectedRoute>
                <AdminSessionDetails />
              </ProtectedRoute>
            } />

            {/* Scratch Card Routes */}
            <Route path="/admin/scratch-card/setup" element={
              <ProtectedRoute>
                <ScratchCardSetup />
              </ProtectedRoute>
            } />
            <Route path="/scratch-session/:sessionId" element={
              <ProtectedRoute>
                <ScratchCardSession />
              </ProtectedRoute>
            } />
            <Route path="/admin/scratch-results/:sessionId" element={
              <ProtectedRoute>
                <ScratchCardResults />
              </ProtectedRoute>
            } />

            {/* Public Routes */}
            <Route path="/quiz/:sessionCode" element={<QuizTaking />} />
            <Route path="/scratch/:sessionCode" element={<ScratchCard />} />
            <Route path="/results/:sessionId" element={<Results />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import AdminDashboard from './pages/AdminDashboard'
import QuizBuilder from './pages/QuizBuilder'
import QuizManagement from './pages/QuizManagement'
import QuizSession from './pages/QuizSession'
import QuizTaking from './pages/QuizTaking'
import Results from './pages/Results'

function App() {
  return (
    <Router basename="/TrainingQuiz">
      <div className="min-h-screen bg-gb-navy">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/quiz/create" element={<QuizBuilder />} />
          <Route path="/admin/quiz/:quizId/edit" element={<QuizBuilder />} />
          <Route path="/admin/quizzes" element={<QuizManagement />} />
          <Route path="/admin/session/:sessionId" element={<QuizSession />} />
          <Route path="/quiz/:sessionCode" element={<QuizTaking />} />
          <Route path="/results/:sessionId" element={<Results />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App

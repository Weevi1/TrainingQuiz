import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Play, BarChart, Settings, Edit } from 'lucide-react'
import { supabase } from '../lib/supabase'

function AdminDashboard() {
  const navigate = useNavigate()
  const [recentQuizzes, setRecentQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [allQuizzes, setAllQuizzes] = useState([])
  const [selectedQuiz, setSelectedQuiz] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const dummyTrainerId = '00000000-0000-0000-0000-000000000001'
      
      // Get recent quizzes
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('*')
        .eq('trainer_id', dummyTrainerId)
        .order('created_at', { ascending: false })
        .limit(3)

      // Get all quizzes for the modal
      const { data: allQuizzesData } = await supabase
        .from('quizzes')
        .select('*')
        .eq('trainer_id', dummyTrainerId)
        .order('created_at', { ascending: false })

      setRecentQuizzes(quizzes || [])
      setAllQuizzes(allQuizzesData || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSessionCode = () => {
    // Generate a more robust 6-character code with better entropy
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid confusing characters like 0/O, 1/I
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const openQuizModal = () => {
    if (allQuizzes.length === 0) {
      alert('Create a quiz first before starting a session!')
      return
    }
    setShowQuizModal(true)
  }

  const startQuizSession = async () => {
    try {
      if (!selectedQuiz) {
        alert('Please select a quiz to start.')
        return
      }

      const dummyTrainerId = '00000000-0000-0000-0000-000000000001'
      
      // Try to generate a unique session code (with retry logic)
      let sessionCode = generateSessionCode()
      let retries = 0
      const maxRetries = 5
      
      while (retries < maxRetries) {
        // Check if code already exists
        const { data: existingSession } = await supabase
          .from('quiz_sessions')
          .select('id')
          .eq('session_code', sessionCode)
          .single()
        
        if (!existingSession) {
          break // Code is unique, we can use it
        }
        
        // Generate a new code and try again
        sessionCode = generateSessionCode()
        retries++
      }
      
      if (retries === maxRetries) {
        throw new Error('Could not generate unique session code. Please try again.')
      }
      
      const { data: session, error } = await supabase
        .from('quiz_sessions')
        .insert({
          quiz_id: selectedQuiz.id,
          trainer_id: dummyTrainerId,
          session_code: sessionCode,
          status: 'waiting'
        })
        .select()
        .single()

      if (error) throw error

      // Close modal and navigate to the quiz session page
      setShowQuizModal(false)
      setSelectedQuiz(null)
      navigate(`/admin/session/${session.id}`)
    } catch (error) {
      console.error('Error starting quiz session:', error)
      alert(error.message || 'Error starting quiz session. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gb-navy flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gb-gold"></div>
          <p className="mt-4 text-gb-gold">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gb-navy">
      <header className="bg-gb-navy border-b border-gb-gold/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <img 
              src="/gblogo.png" 
              alt="GB Logo" 
              className="h-12"
            />
            <h1 className="text-3xl font-bold text-gb-gold font-serif">Quiz Admin Dashboard</h1>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white/95 rounded-lg shadow border border-gb-gold/20">
            <div className="p-6 border-b border-gb-gold/20">
              <h2 className="text-xl font-semibold text-gb-navy font-serif">Quick Actions</h2>
            </div>
            <div className="p-6 space-y-4">
              <Link 
                to="/admin/quiz/create"
                className="flex items-center p-4 border border-gb-gold/30 rounded-lg hover:bg-gb-gold/10 transition-colors"
              >
                <Plus className="w-8 h-8 text-gb-gold mr-4" />
                <div>
                  <h3 className="font-semibold text-gb-navy">Create New Quiz</h3>
                  <p className="text-gb-navy/70 text-sm">Build a new training quiz</p>
                </div>
              </Link>
              
              <button 
                onClick={openQuizModal}
                className="flex items-center w-full p-4 border border-gb-gold/30 rounded-lg hover:bg-gb-gold/10 transition-colors"
              >
                <Play className="w-8 h-8 text-gb-gold mr-4" />
                <div className="text-left">
                  <h3 className="font-semibold text-gb-navy">Start Quiz Session</h3>
                  <p className="text-gb-navy/70 text-sm">Launch a live quiz session</p>
                </div>
              </button>
              
              <button 
                onClick={() => navigate('/admin/quizzes')}
                className="flex items-center w-full p-4 border border-gb-gold/30 rounded-lg hover:bg-gb-gold/10 transition-colors"
              >
                <BarChart className="w-8 h-8 text-gb-gold mr-4" />
                <div className="text-left">
                  <h3 className="font-semibold text-gb-navy">Manage All Quizzes</h3>
                  <p className="text-gb-navy/70 text-sm">View, edit, and delete all your quizzes</p>
                </div>
              </button>
            </div>
          </div>
          
          <div className="bg-white/95 rounded-lg shadow border border-gb-gold/20">
            <div className="p-6 border-b border-gb-gold/20">
              <h2 className="text-xl font-semibold text-gb-navy font-serif">Recent Quizzes</h2>
            </div>
            <div className="divide-y">
              {recentQuizzes.length === 0 ? (
                <div className="p-6 text-center text-gb-navy/70">
                  <p>No quizzes created yet.</p>
                  <Link 
                    to="/admin/quiz/create"
                    className="text-gb-gold hover:underline"
                  >
                    Create your first quiz
                  </Link>
                </div>
              ) : (
                recentQuizzes.map((quiz) => (
                  <div key={quiz.id} className="p-4 hover:bg-gb-gold/10">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gb-navy">{quiz.title}</h3>
                        <p className="text-gb-navy/70 text-sm">
                          {quiz.description} • {new Date(quiz.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/quiz/${quiz.id}/edit`)}
                          className="p-2 text-gb-gold hover:bg-gb-gold/20 rounded-lg transition-colors"
                          title="Edit Quiz"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <Settings className="w-5 h-5 text-gb-navy/40" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Quiz Selection Modal */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 border border-gb-gold/20">
            <div className="p-6 border-b border-gb-gold/20">
              <h2 className="text-xl font-semibold text-gb-navy font-serif">Select Quiz to Start</h2>
              <p className="text-gb-navy/70 mt-1">Choose which quiz you want to start a live session for</p>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              {allQuizzes.length === 0 ? (
                <p className="text-gb-navy/70 text-center py-4">No quizzes available</p>
              ) : (
                <div className="space-y-3">
                  {allQuizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      onClick={() => setSelectedQuiz(quiz)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedQuiz?.id === quiz.id
                          ? 'border-gb-gold bg-gb-gold/20'
                          : 'border-gb-gold/30 hover:border-gb-gold/50'
                      }`}
                    >
                      <h3 className="font-semibold text-gb-navy">{quiz.title}</h3>
                      <p className="text-gb-navy/70 text-sm">{quiz.description}</p>
                      <p className="text-gb-navy/50 text-xs mt-1">
                        Created: {new Date(quiz.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gb-gold/20 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowQuizModal(false)
                  setSelectedQuiz(null)
                }}
                className="px-4 py-2 text-gb-navy border border-gb-gold/30 rounded-lg hover:bg-gb-gold/10"
              >
                Cancel
              </button>
              <button
                onClick={startQuizSession}
                disabled={!selectedQuiz}
                className="px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                <Play className="w-4 h-4" />
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
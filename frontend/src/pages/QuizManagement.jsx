import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit, Trash2, Plus, ArrowLeft, Calendar, Clock, Hash } from 'lucide-react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'

function QuizManagement() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    loadQuizzes()
  }, [])

  const loadQuizzes = async () => {
    try {
      console.log('📚 Loading quizzes for trainer:', user?.uid)

      // Get all quizzes from Firebase (no trainer filtering since we migrated all data)
      const quizzesQuery = query(
        collection(db, 'quizzes'),
        orderBy('createdAt', 'desc')
      )
      const quizzesSnapshot = await getDocs(quizzesQuery)

      const quizzesData = quizzesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        questionCount: doc.data().questions?.length || 0
      }))

      console.log('✅ Loaded', quizzesData.length, 'quizzes')
      setQuizzes(quizzesData)
    } catch (error) {
      console.error('Error loading quizzes:', error)
      alert('Error loading quizzes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const deleteQuiz = async (quizId, quizTitle) => {
    if (!confirm(`Are you sure you want to delete "${quizTitle}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(quizId)
    try {
      // Delete quiz from Firebase
      await deleteDoc(doc(db, 'quizzes', quizId))

      // Remove from local state
      setQuizzes(prev => prev.filter(q => q.id !== quizId))
      alert('Quiz deleted successfully!')
    } catch (error) {
      console.error('Error deleting quiz:', error)
      alert('Error deleting quiz. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} min`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gb-navy flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gb-gold"></div>
          <p className="mt-4 text-gb-gold">Loading quizzes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gb-navy">
      <header className="bg-gb-navy border-b border-gb-gold/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-gb-gold hover:bg-gb-gold/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <img 
                src="/gblogo.png" 
                alt="GB Logo" 
                className="h-12"
              />
              <div>
                <h1 className="text-3xl font-bold text-gb-gold font-serif">Manage Quizzes</h1>
                <p className="text-gb-gold/80 mt-1">View, edit, and delete all your quizzes</p>
              </div>
            </div>
            <Link 
              to="/admin/quiz/create"
              className="bg-gb-gold text-gb-navy px-4 py-2 rounded-lg hover:bg-gb-gold-light flex items-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Quiz
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {quizzes.length === 0 ? (
          <div className="rounded-lg shadow border border-gb-gold/20 p-12 text-center" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
            <Hash className="w-16 h-16 text-gb-gold/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gb-navy mb-2">No quizzes yet</h2>
            <p className="text-gb-navy/70 mb-6">Create your first quiz to get started</p>
            <Link 
              to="/admin/quiz/create"
              className="bg-gb-gold text-gb-navy px-6 py-3 rounded-lg hover:bg-gb-gold-light inline-flex items-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Quiz
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="rounded-lg shadow border border-gb-gold/20 hover:shadow-lg transition-shadow" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gb-navy mb-2 font-serif">{quiz.title}</h3>
                      <p className="text-gb-navy/70 mb-4">{quiz.description || 'No description'}</p>
                      
                      <div className="flex items-center gap-6 text-sm text-gb-navy/60">
                        <div className="flex items-center gap-1">
                          <Hash className="w-4 h-4" />
                          <span>{quiz.questionCount} questions</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatTime(quiz.timeLimit)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Created {formatDate(quiz.createdAt)}</span>
                        </div>
                        {quiz.updatedAt && quiz.updatedAt !== quiz.createdAt && (
                          <div className="flex items-center gap-1">
                            <Edit className="w-4 h-4" />
                            <span>Updated {formatDate(quiz.updatedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/admin/quiz/${quiz.id}/edit`)}
                        className="p-2 text-gb-gold hover:bg-gb-gold/20 rounded-lg transition-colors"
                        title="Edit Quiz"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteQuiz(quiz.id, quiz.title)}
                        disabled={deleting === quiz.id}
                        className="p-2 rounded-lg transition-colors disabled:opacity-50"
                        style={{
                          color: 'var(--error-color, #dc2626)',
                          '--hover-bg': 'var(--error-bg-color, #fef2f2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--error-bg-color, #fef2f2)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default QuizManagement
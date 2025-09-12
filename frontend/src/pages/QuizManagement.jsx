import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit, Trash2, Plus, ArrowLeft, Calendar, Clock, Hash } from 'lucide-react'
import { supabase } from '../lib/supabase'

function QuizManagement() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    loadQuizzes()
  }, [])

  const loadQuizzes = async () => {
    try {
      const dummyTrainerId = '00000000-0000-0000-0000-000000000001'
      
      // Get all quizzes with question count
      const { data: quizzesData, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          questions (id)
        `)
        .eq('trainer_id', dummyTrainerId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading quizzes:', error)
        throw error
      }

      // Transform data to include question count
      const transformedQuizzes = quizzesData.map(quiz => ({
        ...quiz,
        questionCount: quiz.questions?.length || 0
      }))

      setQuizzes(transformedQuizzes)
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
      // Delete quiz (questions will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId)

      if (error) {
        console.error('Error deleting quiz:', error)
        throw error
      }

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading quizzes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Manage Quizzes</h1>
                <p className="text-gray-600 mt-1">View, edit, and delete all your quizzes</p>
              </div>
            </div>
            <Link 
              to="/admin/quiz/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Quiz
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {quizzes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Hash className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No quizzes yet</h2>
            <p className="text-gray-600 mb-6">Create your first quiz to get started</p>
            <Link 
              to="/admin/quiz/create"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Your First Quiz
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{quiz.title}</h3>
                      <p className="text-gray-600 mb-4">{quiz.description || 'No description'}</p>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Hash className="w-4 h-4" />
                          <span>{quiz.questionCount} questions</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatTime(quiz.time_limit)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Created {formatDate(quiz.created_at)}</span>
                        </div>
                        {quiz.updated_at && quiz.updated_at !== quiz.created_at && (
                          <div className="flex items-center gap-1">
                            <Edit className="w-4 h-4" />
                            <span>Updated {formatDate(quiz.updated_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/admin/quiz/${quiz.id}/edit`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Quiz"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteQuiz(quiz.id, quiz.title)}
                        disabled={deleting === quiz.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
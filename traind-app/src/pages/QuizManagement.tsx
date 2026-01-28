import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Play, Users, BarChart, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type Quiz, type GameSession } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const QuizManagement: React.FC = () => {
  const navigate = useNavigate()
  const { user, currentOrganization, hasPermission } = useAuth()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingSession, setCreatingSession] = useState<string | null>(null)

  // Check permissions
  useEffect(() => {
    if (!hasPermission('create_sessions') && !hasPermission('manage_content')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate])

  useEffect(() => {
    loadQuizzes()
  }, [currentOrganization])

  const loadQuizzes = async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      let quizList: Quiz[]

      // If user has manage_content permission, show all org quizzes
      // Otherwise, show only their own quizzes
      if (hasPermission('manage_content')) {
        quizList = await FirestoreService.getOrganizationQuizzes(currentOrganization.id)
      } else {
        quizList = await FirestoreService.getTrainerQuizzes(currentOrganization.id, user?.id || '')
      }

      setQuizzes(quizList)
    } catch (error) {
      console.error('Error loading quizzes:', error)
      alert('Error loading quizzes')
    } finally {
      setLoading(false)
    }
  }

  const deleteQuiz = async (quizId: string) => {
    if (!currentOrganization) return

    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return
    }

    try {
      await FirestoreService.deleteQuiz(currentOrganization.id, quizId)
      setQuizzes(prev => prev.filter(q => q.id !== quizId))
    } catch (error) {
      console.error('Error deleting quiz:', error)
      alert('Error deleting quiz')
    }
  }

  const createSession = async (quiz: Quiz) => {
    if (!currentOrganization || !user) return

    setCreatingSession(quiz.id!)

    try {
      // Generate unique session code
      const sessionCode = FirestoreService.generateSessionCode()

      // Create session with quiz data
      const sessionData: Partial<GameSession> = {
        organizationId: currentOrganization.id,
        gameType: 'quiz',
        title: quiz.title,
        code: sessionCode,
        status: 'waiting',
        trainerId: user.id,
        participantLimit: 50,
        currentParticipants: 0,
        gameData: {
          quizId: quiz.id,
          quiz: quiz // Embed quiz data for offline access
        },
        settings: {
          allowLateJoin: true,
          showLeaderboard: true,
          enableSounds: true,
          recordSession: true
        }
      }

      const sessionId = await FirestoreService.createSession(sessionData)

      // Navigate to session control (waiting room with QR code)
      navigate(`/session/${sessionId}`)
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Error creating session. Please try again.')
    } finally {
      setCreatingSession(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-md transition-colors"
                style={{ color: 'var(--text-secondary-color)' }}
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-primary">Quiz Management</h1>
            </div>
            <button
              onClick={() => navigate('/quiz/new')}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>Create Quiz</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Quizzes</p>
                <p className="text-3xl font-bold text-primary">{quizzes.length}</p>
              </div>
              <BarChart className="text-primary" size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Questions</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--success-color)' }}>
                  {quizzes.reduce((acc, quiz) => acc + quiz.questions.length, 0)}
                </p>
              </div>
              <Edit style={{ color: 'var(--success-color)' }} size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Sessions Created</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--accent-color)' }}>0</p>
              </div>
              <Play style={{ color: 'var(--accent-color)' }} size={32} />
            </div>
          </div>
        </div>

        {/* Quiz List */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Your Quizzes</h2>
          </div>

          {quizzes.length === 0 ? (
            <div className="text-center py-12">
              <BarChart className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-secondary-color)' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-color)' }}>No quizzes yet</h3>
              <p className="text-text-secondary mb-6">
                Create your first quiz to get started with interactive training sessions.
              </p>
              <button
                onClick={() => navigate('/quiz/new')}
                className="btn-primary"
              >
                Create Your First Quiz
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{quiz.title}</h3>
                      {quiz.description && (
                        <p className="text-sm text-text-secondary mb-4 line-clamp-3">
                          {quiz.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Questions:</span>
                      <span className="font-medium">{quiz.questions.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Time per Question:</span>
                      <span className="font-medium">{quiz.timeLimit}s</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Passing Score:</span>
                      <span className="font-medium">{quiz.settings.passingScore}%</span>
                    </div>
                    {quiz.updatedAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Last Updated:</span>
                        <span className="font-medium">
                          {quiz.updatedAt.toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => createSession(quiz)}
                      disabled={creatingSession === quiz.id}
                      className="btn-primary btn-sm flex items-center space-x-1 flex-1 disabled:opacity-50"
                    >
                      {creatingSession === quiz.id ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} />
                          <span>Start Session</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                      className="btn-secondary btn-sm flex items-center space-x-1"
                    >
                      <Edit size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => deleteQuiz(quiz.id!)}
                      className="btn-danger btn-sm flex items-center space-x-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
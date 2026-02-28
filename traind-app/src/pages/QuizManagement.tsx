import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Play, Users, BarChart, ArrowLeft, Copy, Globe, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OrgLogo } from '../components/OrgLogo'
import { FirestoreService, type Quiz, type GameSession, isPublished } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

const QuizCard: React.FC<{
  quiz: Quiz
  isOwn: boolean
  canEdit: boolean
  creatingSession: string | null
  onStartSession: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onTogglePublished?: () => void
}> = ({ quiz, isOwn, canEdit, creatingSession, onStartSession, onEdit, onDuplicate, onDelete, onTogglePublished }) => {
  const published = isPublished(quiz)

  return (
    <div className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg">{quiz.title}</h3>
            {isOwn && (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: published ? 'var(--success-color)' : 'var(--border-color)',
                  color: published ? 'white' : 'var(--text-secondary-color)'
                }}
              >
                {published ? <><Globe size={10} /> Published</> : <><Lock size={10} /> Draft</>}
              </span>
            )}
          </div>
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

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onStartSession}
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
        {isOwn && onTogglePublished && (
          <button
            onClick={onTogglePublished}
            className="btn-secondary btn-sm flex items-center space-x-1"
            title={published ? 'Make draft (hide from team)' : 'Publish (share with team)'}
          >
            {published ? <Lock size={14} /> : <Globe size={14} />}
            <span>{published ? 'Unpublish' : 'Publish'}</span>
          </button>
        )}
        {canEdit && (
          <button
            onClick={onEdit}
            className="btn-secondary btn-sm flex items-center space-x-1"
          >
            <Edit size={14} />
            <span>Edit</span>
          </button>
        )}
        <button
          onClick={onDuplicate}
          className="btn-secondary btn-sm flex items-center space-x-1"
          title="Duplicate quiz"
        >
          <Copy size={14} />
        </button>
        {canEdit && (
          <button
            onClick={onDelete}
            className="btn-danger btn-sm flex items-center space-x-1"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

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
      // Always load all org quizzes — filtering to own vs. team done client-side
      const quizList = await FirestoreService.getOrganizationQuizzes(currentOrganization.id)
      setQuizzes(quizList)
    } catch (error) {
      console.error('Error loading quizzes:', error)
      alert('Error loading quizzes')
    } finally {
      setLoading(false)
    }
  }

  const togglePublished = async (quiz: Quiz) => {
    if (!currentOrganization) return
    const newPublished = !isPublished(quiz)
    try {
      await FirestoreService.updateQuiz(currentOrganization.id, quiz.id!, { published: newPublished })
      setQuizzes(prev => prev.map(q => q.id === quiz.id ? { ...q, published: newPublished } : q))
    } catch (error) {
      console.error('Error updating quiz:', error)
      alert('Error updating quiz status')
    }
  }

  const canEditQuiz = (quiz: Quiz): boolean => {
    return quiz.trainerId === user?.id || hasPermission('manage_content')
  }

  // Split quizzes into own vs. team
  const myQuizzes = quizzes.filter(q => q.trainerId === user?.id)
  const teamQuizzes = quizzes.filter(q => q.trainerId !== user?.id && isPublished(q))

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
      const sessionCode = await FirestoreService.generateSessionCode()

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

  const duplicateQuiz = async (quiz: Quiz) => {
    if (!currentOrganization || !user) return

    try {
      const quizData = {
        title: `${quiz.title} (Copy)`,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        questions: quiz.questions.map(q => ({
          ...q,
          id: crypto.randomUUID()
        })),
        interstitials: quiz.interstitials?.map(i => ({
          ...i,
          id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        })),
        organizationId: currentOrganization.id,
        trainerId: user.id,
        published: false, // Copies start as draft
        settings: quiz.settings ? { ...quiz.settings } : undefined
      }

      await FirestoreService.createQuiz(currentOrganization.id, quizData)
      await loadQuizzes()
    } catch (error) {
      console.error('Error duplicating quiz:', error)
      alert('Error duplicating quiz')
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
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-md transition-colors"
                style={{ color: 'var(--text-secondary-color)' }}
              >
                <ArrowLeft size={20} />
              </button>
              <OrgLogo
                logo={currentOrganization?.branding?.logo}
                orgName={currentOrganization?.name}
                size="sm"
              />
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
                <p className="text-sm font-medium text-text-secondary">My Quizzes</p>
                <p className="text-3xl font-bold text-primary">{myQuizzes.length}</p>
              </div>
              <BarChart className="text-primary" size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Team Quizzes</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--success-color)' }}>
                  {teamQuizzes.length}
                </p>
              </div>
              <Users style={{ color: 'var(--success-color)' }} size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Questions</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--accent-color)' }}>
                  {quizzes.reduce((acc, quiz) => acc + quiz.questions.length, 0)}
                </p>
              </div>
              <Edit style={{ color: 'var(--accent-color)' }} size={32} />
            </div>
          </div>
        </div>

        {/* My Quizzes */}
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">My Quizzes</h2>
          </div>

          {myQuizzes.length === 0 ? (
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
              {myQuizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  isOwn={true}
                  canEdit={true}
                  creatingSession={creatingSession}
                  onStartSession={() => createSession(quiz)}
                  onEdit={() => navigate(`/quiz/${quiz.id}`)}
                  onDuplicate={() => duplicateQuiz(quiz)}
                  onDelete={() => deleteQuiz(quiz.id!)}
                  onTogglePublished={() => togglePublished(quiz)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Team Quizzes */}
        {teamQuizzes.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Team Quizzes</h2>
              <span className="text-sm text-text-secondary">Published by other trainers</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamQuizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  isOwn={false}
                  canEdit={hasPermission('manage_content')}
                  creatingSession={creatingSession}
                  onStartSession={() => createSession(quiz)}
                  onEdit={() => navigate(`/quiz/${quiz.id}`)}
                  onDuplicate={() => duplicateQuiz(quiz)}
                  onDelete={() => deleteQuiz(quiz.id!)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
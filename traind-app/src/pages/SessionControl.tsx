import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play, Pause, Square, Users, Clock, BarChart,
  QrCode, Settings, ArrowLeft, Monitor, Smartphone,
  CheckCircle, AlertCircle, Zap, Trophy
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type GameSession, type Quiz, type Participant } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

type SessionStatus = 'waiting' | 'active' | 'paused' | 'completed'

interface SessionStats {
  totalParticipants: number
  averageScore: number
  completionRate: number
  averageTime: number
}

export const SessionControl: React.FC = () => {
  const navigate = useNavigate()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user, currentOrganization, hasPermission } = useAuth()

  const [session, setSession] = useState<GameSession | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalParticipants: 0,
    averageScore: 0,
    completionRate: 0,
    averageTime: 0
  })

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showQRCode, setShowQRCode] = useState(false)

  // Check permissions
  useEffect(() => {
    if (!hasPermission('create_sessions')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate])

  // Load session data
  useEffect(() => {
    if (sessionId) {
      loadSession()
    }
  }, [sessionId])

  // Real-time participants subscription
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = FirestoreService.subscribeToSessionParticipants(
      sessionId,
      (participants) => {
        setParticipants(participants)
        updateSessionStats(participants)
      }
    )

    return unsubscribe
  }, [sessionId])

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false)
            moveToNextQuestion()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [isTimerRunning, timeRemaining])

  const loadSession = async () => {
    if (!sessionId) return

    setLoading(true)
    try {
      // Fetch real session from Firestore
      const realSession = await FirestoreService.getSession(sessionId)

      if (!realSession) {
        console.error('Session not found:', sessionId)
        alert('Session not found')
        navigate('/dashboard')
        return
      }

      // Fetch real quiz from Firestore
      const quizId = realSession.gameData?.quizId
      if (!quizId) {
        console.error('No quiz ID found in session')
        alert('Session has no associated quiz')
        navigate('/dashboard')
        return
      }

      const realQuiz = await FirestoreService.getQuiz(realSession.organizationId, quizId)

      if (!realQuiz) {
        console.error('Quiz not found:', quizId)
        alert('Quiz not found')
        navigate('/dashboard')
        return
      }

      setSession(realSession)
      setQuiz(realQuiz)
      setTimeRemaining(realQuiz.timeLimit)

    } catch (error) {
      console.error('Error loading session:', error)
      alert('Error loading session')
    } finally {
      setLoading(false)
    }
  }

  const updateSessionStats = (participants: Participant[]) => {
    if (participants.length === 0) {
      setSessionStats({
        totalParticipants: 0,
        averageScore: 0,
        completionRate: 0,
        averageTime: 0
      })
      return
    }

    const participantsWithGameState = participants.filter(p => p.gameState)
    const totalScores = participantsWithGameState.reduce((sum, p) => sum + (p.gameState?.score || 0), 0)
    const averageScore = participantsWithGameState.length > 0 ? totalScores / participantsWithGameState.length : 0

    const completedParticipants = participantsWithGameState.filter(p =>
      (p.gameState?.answers?.length || 0) >= (quiz?.questions.length || 0)
    )
    const completionRate = participants.length > 0 ? (completedParticipants.length / participants.length) * 100 : 0

    // Calculate average time from all answers
    const allAnswers = participantsWithGameState.flatMap(p => p.gameState?.answers || [])
    const averageTime = allAnswers.length > 0
      ? allAnswers.reduce((sum, answer) => sum + answer.timeSpent, 0) / allAnswers.length
      : 0

    setSessionStats({
      totalParticipants: participants.length,
      averageScore: Math.round(averageScore),
      completionRate: Math.round(completionRate),
      averageTime: Math.round(averageTime)
    })
  }

  const startSession = async () => {
    if (!session) return

    try {
      await FirestoreService.updateSession(session.id, {
        status: 'active',
        startTime: new Date()
      })

      setSession(prev => prev ? { ...prev, status: 'active' } : null)
      setIsTimerRunning(true)
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Error starting session')
    }
  }

  const pauseSession = () => {
    setIsTimerRunning(false)
  }

  const resumeSession = () => {
    setIsTimerRunning(true)
  }

  const endSession = async () => {
    if (!session) return

    if (!confirm('Are you sure you want to end this session? This action cannot be undone.')) {
      return
    }

    try {
      await FirestoreService.updateSession(session.id, {
        status: 'completed',
        endTime: new Date()
      })

      setSession(prev => prev ? { ...prev, status: 'completed' } : null)
      setIsTimerRunning(false)
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Error ending session')
    }
  }

  const moveToNextQuestion = () => {
    if (!quiz) return

    const nextIndex = currentQuestionIndex + 1
    if (nextIndex < quiz.questions.length) {
      setCurrentQuestionIndex(nextIndex)
      setTimeRemaining(quiz.timeLimit)
      if (session?.status === 'active') {
        setIsTimerRunning(true)
      }
    } else {
      endSession()
    }
  }

  const moveToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      setTimeRemaining(quiz?.timeLimit || 30)
      setIsTimerRunning(false)
    }
  }

  const resetTimer = () => {
    setTimeRemaining(quiz?.timeLimit || 30)
    setIsTimerRunning(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!session || !quiz) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Session not found</p>
          <button
            onClick={() => navigate('/sessions')}
            className="btn-primary"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = quiz.questions[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/sessions')}
                className="p-2 text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-primary">{session.title}</h1>
                <p className="text-sm text-text-secondary">Session Code: {session.code}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowQRCode(!showQRCode)}
                className="btn-secondary flex items-center space-x-2"
              >
                <QrCode size={16} />
                <span>QR Code</span>
              </button>

              <div className="flex items-center space-x-2">
                {session.status === 'waiting' && (
                  <button
                    onClick={startSession}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Play size={16} />
                    <span>Start Session</span>
                  </button>
                )}

                {session.status === 'active' && (
                  <>
                    <button
                      onClick={isTimerRunning ? pauseSession : resumeSession}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
                      <span>{isTimerRunning ? 'Pause' : 'Resume'}</span>
                    </button>
                    <button
                      onClick={endSession}
                      className="btn-danger flex items-center space-x-2"
                    >
                      <Square size={16} />
                      <span>End Session</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Question Display */}
            <div className="card">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  Question {currentQuestionIndex + 1} of {quiz.questions.length}
                </h2>
                <div
                  className="px-3 py-1 rounded text-sm font-medium"
                  style={{
                    backgroundColor: session.status === 'waiting' ? 'var(--info-light-color, #dbeafe)' :
                      session.status === 'active' ? 'var(--success-light-color, #dcfce7)' :
                      session.status === 'paused' ? 'var(--warning-light-color, #fef3c7)' :
                      'var(--surface-color)',
                    color: session.status === 'waiting' ? 'var(--info-color, #1e40af)' :
                      session.status === 'active' ? 'var(--success-color, #166534)' :
                      session.status === 'paused' ? 'var(--warning-color, #92400e)' :
                      'var(--text-secondary-color)'
                  }}
                >
                  {session.status.toUpperCase()}
                </div>
              </div>

              {/* Timer */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">Time Remaining</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={resetTimer}
                      className="text-sm text-primary hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div
                    className="text-4xl font-bold"
                    style={{ color: timeRemaining <= 10 ? 'var(--error-color)' : 'var(--primary-color)' }}
                  >
                    {timeRemaining}s
                  </div>
                  <div className="flex-1">
                    <div
                      className="w-full rounded-full h-3"
                      style={{ backgroundColor: 'var(--border-color)' }}
                    >
                      <div
                        className="h-3 rounded-full transition-all duration-1000"
                        style={{
                          width: `${(timeRemaining / quiz.timeLimit) * 100}%`,
                          backgroundColor: timeRemaining <= 10 ? 'var(--error-color)' : 'var(--primary-color)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Content */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">{currentQuestion.questionText}</h3>
                <div className="grid gap-3">
                  {currentQuestion.options.map((option, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border"
                      style={{
                        borderColor: index === currentQuestion.correctAnswer
                          ? 'var(--success-color)'
                          : 'var(--border-color)',
                        backgroundColor: index === currentQuestion.correctAnswer
                          ? 'var(--success-light-color, #dcfce7)'
                          : 'var(--surface-color)'
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                          style={{
                            borderColor: index === currentQuestion.correctAnswer
                              ? 'var(--success-color)'
                              : 'var(--border-color)',
                            backgroundColor: index === currentQuestion.correctAnswer
                              ? 'var(--success-color)'
                              : 'transparent'
                          }}
                        >
                          {index === currentQuestion.correctAnswer && (
                            <CheckCircle size={14} style={{ color: 'white' }} />
                          )}
                        </div>
                        <span className={index === currentQuestion.correctAnswer ? 'font-medium' : ''}>
                          {option}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Question Navigation */}
              <div className="flex justify-between items-center">
                <button
                  onClick={moveToPreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous Question
                </button>

                <span className="text-sm text-text-secondary">
                  {currentQuestionIndex + 1} / {quiz.questions.length}
                </span>

                <button
                  onClick={moveToNextQuestion}
                  className="btn-primary"
                >
                  {currentQuestionIndex === quiz.questions.length - 1 ? 'End Quiz' : 'Next Question'}
                </button>
              </div>
            </div>

            {/* Session Stats */}
            <div className="card">
              <h3 className="font-semibold mb-4">Live Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{sessionStats.totalParticipants}</div>
                  <div className="text-sm text-text-secondary">Participants</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>{sessionStats.averageScore}</div>
                  <div className="text-sm text-text-secondary">Avg Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: 'var(--info-color, #2563eb)' }}>{sessionStats.completionRate}%</div>
                  <div className="text-sm text-text-secondary">Completion</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: 'var(--accent-color, #9333ea)' }}>{sessionStats.averageTime}s</div>
                  <div className="text-sm text-text-secondary">Avg Time</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="card">
              <h3 className="font-semibold mb-4 flex items-center space-x-2">
                <Users size={20} />
                <span>Participants ({participants.length})</span>
              </h3>

              {participants.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">
                  <p>No participants yet</p>
                  <p className="text-sm">Share the session code: <strong>{session.code}</strong></p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--surface-color)' }}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: participant.isReady
                              ? 'var(--success-color)'
                              : 'var(--warning-color)'
                          }}
                        />
                        <span className="font-medium">{participant.name}</span>
                      </div>
                      <div className="text-sm text-text-secondary">
                        {participant.gameState?.score || 0} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full btn-secondary text-sm">
                  <Monitor size={16} className="mr-2" />
                  Display on Projector
                </button>
                <button className="w-full btn-secondary text-sm">
                  <Smartphone size={16} className="mr-2" />
                  Send to Mobile
                </button>
                <button className="w-full btn-secondary text-sm">
                  <BarChart size={16} className="mr-2" />
                  View Analytics
                </button>
                <button className="w-full btn-secondary text-sm">
                  <Settings size={16} className="mr-2" />
                  Session Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-lg p-8 max-w-md mx-4" style={{ backgroundColor: 'var(--card-background)' }}>
            <div className="text-center">
              <h3 className="text-xl font-bold mb-4">Join Session</h3>
              <div className="p-8 rounded-lg mb-4" style={{ backgroundColor: 'var(--surface-color)' }}>
                {/* QR Code would be generated here */}
                <div
                  className="w-48 h-48 rounded mx-auto flex items-center justify-center"
                  style={{ backgroundColor: 'var(--border-color)' }}
                >
                  <QrCode size={48} style={{ color: 'var(--text-secondary-color)' }} />
                </div>
              </div>
              <p className="text-lg font-mono font-bold mb-2">{session.code}</p>
              <p className="text-sm text-text-secondary mb-4">
                Scan this QR code or go to your app and enter the code above
              </p>
              <button
                onClick={() => setShowQRCode(false)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
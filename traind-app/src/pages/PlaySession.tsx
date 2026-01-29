import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Clock, Users, Star, Zap, Target, Trophy, CheckCircle, XCircle, AlertTriangle, Loader } from 'lucide-react'
import { FirestoreService, type GameSession, type Quiz, type Question, type Participant, type Organization } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { GameDispatcher } from '../components/gameModules/GameDispatcher'
import { CountdownOverlay } from '../components/CountdownOverlay'
import { type ModuleType } from '../lib/permissions'
import { soundSystem } from '../lib/soundSystem'
import { SoundControl } from '../components/SoundControl'
import { applyOrganizationBranding } from '../lib/applyBranding'

// Session persistence key and timeout (2 hours)
const SESSION_STORAGE_KEY = 'traind_session_recovery'
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours

interface GameState {
  currentQuestionIndex: number
  timeRemaining: number
  totalQuestions: number
  score: number
  streak: number
  answers: Array<{
    questionId: string
    selectedAnswer: number
    isCorrect: boolean
    timeSpent: number
    confidence?: number
  }>
}

interface SessionState {
  participantName: string
  sessionId: string
  gameType: ModuleType
}

export const PlaySession: React.FC = () => {
  const navigate = useNavigate()
  const { sessionCode } = useParams<{ sessionCode: string }>()
  const location = useLocation()
  const sessionState = location.state as SessionState & { participantId?: string }

  const [session, setSession] = useState<GameSession | null>(null)
  const [gameData, setGameData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [participantId, setParticipantId] = useState<string | null>(sessionState?.participantId || null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [participantCount, setParticipantCount] = useState(0)

  // Session recovery - check for saved session
  useEffect(() => {
    if (!sessionState && !loading) {
      // Try to recover session from localStorage
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY)
      if (savedSession) {
        try {
          const recoveryData = JSON.parse(savedSession)
          const age = Date.now() - recoveryData.timestamp

          // Check if session is still valid (within timeout)
          if (age < SESSION_TIMEOUT_MS && recoveryData.sessionCode === sessionCode) {
            // Recover session
            setParticipantId(recoveryData.participantId)
            // Navigate with recovered state
            navigate(`/play/${sessionCode}`, {
              state: {
                participantName: recoveryData.participantName,
                sessionId: recoveryData.sessionId,
                gameType: recoveryData.gameType,
                participantId: recoveryData.participantId
              },
              replace: true
            })
            return
          } else {
            // Session expired, clear recovery data
            localStorage.removeItem(SESSION_STORAGE_KEY)
          }
        } catch (e) {
          localStorage.removeItem(SESSION_STORAGE_KEY)
        }
      }

      // No valid recovery, redirect to join
      navigate(`/join/${sessionCode}`)
      return
    }
  }, [sessionState, sessionCode, navigate, loading])

  // Redirect if no session state and no recovery
  useEffect(() => {
    if (!sessionState && !localStorage.getItem(SESSION_STORAGE_KEY)) {
      navigate(`/join/${sessionCode}`)
      return
    }
  }, [sessionState, sessionCode, navigate])

  // Load session and game data
  useEffect(() => {
    loadSessionData()
  }, [])

  // Subscribe to session status changes
  useEffect(() => {
    if (!sessionState?.sessionId) return

    const unsubscribe = FirestoreService.subscribeToSession(
      sessionState.sessionId,
      (updatedSession) => {
        if (updatedSession) {
          setSession(updatedSession)

          // If session just became active, load quiz data
          if (updatedSession.status === 'active' && !gameData) {
            loadQuizData(updatedSession)
          }
        }
      }
    )

    return () => unsubscribe()
  }, [sessionState?.sessionId])

  // Subscribe to participant count
  useEffect(() => {
    if (!sessionState?.sessionId) return

    const unsubscribe = FirestoreService.subscribeToSessionParticipants(
      sessionState.sessionId,
      (participants) => {
        setParticipantCount(participants.length)
      }
    )

    return () => unsubscribe()
  }, [sessionState?.sessionId])

  const loadSessionData = async () => {
    if (!sessionState) return

    setLoading(true)
    try {
      // Fetch real session data from Firestore
      const realSession = await FirestoreService.getSession(sessionState.sessionId)

      if (!realSession) {
        console.error('Session not found:', sessionState.sessionId)
        setLoading(false)
        return
      }

      setSession(realSession)

      // Load organization branding
      try {
        const org = await FirestoreService.getOrganization(realSession.organizationId)
        if (org) {
          setOrganization(org)
          await applyOrganizationBranding(org.branding)
        }
      } catch (error) {
        console.error('Error loading organization:', error)
      }

      // If session is active, load quiz data immediately
      if (realSession.status === 'active') {
        await loadQuizData(realSession)
      }

    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadQuizData = async (currentSession: GameSession) => {
    try {
      // Fetch real quiz data from Firestore
      const quizId = currentSession.gameData?.quizId
      if (!quizId) {
        console.error('No quiz ID found in session')
        return
      }

      const realQuiz = await FirestoreService.getQuiz(currentSession.organizationId, quizId)

      if (!realQuiz) {
        console.error('Quiz not found:', quizId)
        return
      }

      // Fetch participants for live engagement
      const participants = await FirestoreService.getSessionParticipants(currentSession.id)

      setGameData({
        quiz: realQuiz,
        participants: participants,
        timeLimit: realQuiz.timeLimit || (
          sessionState.gameType === 'speedround' ? 300 :
          sessionState.gameType === 'bingo' ? 900 :
          sessionState.gameType === 'millionaire' ? 45 :
          600 // Default 10 minutes
        )
      })

    } catch (error) {
      console.error('Error loading quiz data:', error)
    }
  }

  const handleGameComplete = async (score: number, additionalData?: any) => {
    // Fetch all participants for leaderboard
    let allParticipants: any[] = []
    if (sessionState?.sessionId) {
      try {
        allParticipants = await FirestoreService.getSessionParticipants(sessionState.sessionId)
      } catch (error) {
        console.error('Error fetching participants for leaderboard:', error)
      }
    }

    // Navigate to results with game data
    // Pass full game state and quiz data for the results page
    const isBingo = additionalData?.gameType === 'bingo'

    navigate('/results', {
      state: {
        participantName: sessionState.participantName,
        gameType: sessionState.gameType,
        score,
        sessionCode,
        organizationId: session?.organizationId,
        // Full game state for detailed results
        gameState: isBingo
          ? additionalData.gameState
          : (additionalData?.gameState || {
              score,
              streak: additionalData?.bestStreak || 0,
              answers: additionalData?.answers || [],
              totalQuestions: additionalData?.totalQuestions || 0
            }),
        // Quiz data for question review
        quiz: additionalData?.quiz || gameData?.quiz || {
          title: session?.title || 'Quiz',
          questions: [],
          settings: { passingScore: 60 }
        },
        // Leaderboard data
        allParticipants,
        participantId
      }
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color)' }}>
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4" style={{ color: 'var(--text-secondary-color)' }}>
            Loading {sessionState?.gameType || 'game'}...
          </p>
        </div>
      </div>
    )
  }

  // Countdown state - show countdown overlay before quiz starts
  if (session && session.status === 'countdown') {
    return (
      <CountdownOverlay
        onComplete={() => {
          // The session will automatically update to 'active' from the subscription
          // This callback is just for any local state updates if needed
        }}
        startFrom={3}
        organizationLogo={(organization?.branding as any)?.logoUrl}
        sessionTitle={session.title}
      />
    )
  }

  // Waiting state - show waiting room while trainer hasn't started
  if (session && session.status === 'waiting') {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          background: `linear-gradient(to bottom right, var(--primary-dark-color, #1e40af), var(--secondary-color, #1e40af), var(--primary-color, #3b82f6))`
        }}
      >
        {/* Decorative background circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: 'var(--accent-color, #f59e0b)' }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: 'var(--primary-light-color, #60a5fa)' }}
          />
        </div>

        <div
          className="p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2"
          style={{
            backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))',
            borderColor: 'var(--primary-color, #3b82f6)'
          }}
        >
          {/* Organization branding */}
          {organization?.branding?.logoUrl && (
            <img
              src={organization.branding.logoUrl}
              alt={organization.name}
              className="h-16 mx-auto mb-4 object-contain"
            />
          )}

          {/* Welcome message */}
          <div
            className="px-6 py-3 rounded-lg mb-6"
            style={{
              backgroundColor: 'var(--primary-color, #3b82f6)',
              color: 'var(--text-on-primary-color, #ffffff)'
            }}
          >
            <h1 className="text-xl font-bold">Welcome, {sessionState.participantName}!</h1>
          </div>

          {/* Session info */}
          <div
            className="p-4 rounded-xl mb-6 border"
            style={{
              backgroundColor: 'var(--background-color, #f8fafc)',
              borderColor: 'var(--border-color, #e5e7eb)'
            }}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--primary-color)' }}>
              {session.title}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              Session Code: <span className="font-mono font-bold">{session.code}</span>
            </p>
          </div>

          {/* Waiting indicator */}
          <div
            className="rounded-xl p-6 mb-6 border"
            style={{
              backgroundColor: 'var(--warning-light-color, #fef3c7)',
              borderColor: 'var(--warning-color, #f59e0b)'
            }}
          >
            <div className="flex items-center justify-center mb-4">
              <Loader
                className="animate-spin mr-2"
                size={24}
                style={{ color: 'var(--warning-color, #f59e0b)' }}
              />
              <span className="text-lg font-semibold" style={{ color: 'var(--warning-color, #f59e0b)' }}>
                Waiting for trainer...
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              The quiz will start when your trainer is ready.
              <br />Stay on this page!
            </p>
          </div>

          {/* Participant count */}
          <div
            className="flex items-center justify-center space-x-2 p-3 rounded-lg"
            style={{
              backgroundColor: 'var(--surface-color, #f8fafc)',
              color: 'var(--text-secondary-color)'
            }}
          >
            <Users size={20} style={{ color: 'var(--primary-color)' }} />
            <span className="font-medium">
              {participantCount} participant{participantCount !== 1 ? 's' : ''} waiting
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Error state - only show if session exists but is not waiting and has no game data
  if (!session || (!gameData && session?.status !== 'waiting')) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color)' }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: 'var(--text-secondary-color)' }}>
            {!session ? 'Session not found' : 'Game data not available'}
          </p>
          <button
            onClick={() => navigate('/join')}
            className="btn-primary"
          >
            Return to Join Page
          </button>
        </div>
      </div>
    )
  }

  // If session is active but game data not loaded yet
  if (session.status === 'active' && !gameData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color)' }}>
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4" style={{ color: 'var(--text-secondary-color)' }}>
            Quiz is starting...
          </p>
        </div>
      </div>
    )
  }

  // Enhanced game modules
  if (['millionaire', 'bingo', 'speedround', 'spotdifference'].includes(sessionState.gameType)) {
    return (
      <GameDispatcher
        gameType={sessionState.gameType}
        gameData={gameData}
        participantName={sessionState.participantName}
        onGameComplete={handleGameComplete}
        onKicked={() => {
          // Clear session recovery data
          localStorage.removeItem(SESSION_STORAGE_KEY)
          navigate('/join', { state: { kicked: true } })
        }}
        sessionSettings={session.settings}
        sessionId={sessionState.sessionId}
        participantId={participantId || undefined}
      />
    )
  }

  // Legacy quiz implementation for backwards compatibility
  return <LegacyQuizGame
    session={session}
    gameData={gameData}
    sessionState={sessionState}
    onGameComplete={handleGameComplete}
    participantId={participantId || ''}
  />
}

// Legacy quiz component (extracted for clarity)
const LegacyQuizGame: React.FC<{
  session: GameSession
  gameData: any
  sessionState: SessionState
  onGameComplete: (score: number, additionalData?: any) => void
  participantId: string
}> = ({ session, gameData, sessionState, onGameComplete, participantId }) => {
  const navigate = useNavigate()
  const quiz = gameData.quiz as Quiz
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(quiz.questions[0])
  const [gameState, setGameState] = useState<GameState>({
    currentQuestionIndex: 0,
    timeRemaining: quiz.timeLimit,
    totalQuestions: quiz.questions.length,
    score: 0,
    streak: 0,
    answers: []
  })

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerSubmitted, setAnswerSubmitted] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [resultCountdown, setResultCountdown] = useState(0)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [isKicked, setIsKicked] = useState(false)
  const [answerLocked, setAnswerLocked] = useState(false)

  // Live stats state
  const [participantCount, setParticipantCount] = useState(gameData.participants?.length || 0)
  const [currentRank, setCurrentRank] = useState<number | null>(null)
  const [allParticipants, setAllParticipants] = useState<Participant[]>(gameData.participants || [])

  // Refs for reliable access in callbacks (prevents stale closures)
  const selectedAnswerRef = useRef<number | null>(null)
  const answerSubmittedRef = useRef(false)
  const gameStateRef = useRef(gameState)
  const currentQuestionRef = useRef(currentQuestion)
  const sessionEndedRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => {
    selectedAnswerRef.current = selectedAnswer
  }, [selectedAnswer])

  useEffect(() => {
    answerSubmittedRef.current = answerSubmitted
  }, [answerSubmitted])

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    currentQuestionRef.current = currentQuestion
  }, [currentQuestion])

  useEffect(() => {
    sessionEndedRef.current = sessionEnded
  }, [sessionEnded])

  // Kick detection - subscribe to participant document
  useEffect(() => {
    if (!sessionState.sessionId || !participantId) return

    const unsubscribe = FirestoreService.subscribeToParticipant(
      sessionState.sessionId,
      participantId,
      (exists, participant) => {
        if (!exists) {
          // Participant was removed (kicked)
          setIsKicked(true)
          soundSystem.play('incorrect')

          // Clear session recovery data
          localStorage.removeItem(SESSION_STORAGE_KEY)

          // Redirect after showing message
          setTimeout(() => {
            navigate('/join', { state: { kicked: true } })
          }, 3000)
        }
      }
    )

    return () => unsubscribe()
  }, [sessionState.sessionId, participantId, navigate])

  // Timer sync - mirror trainer's authoritative timer
  useEffect(() => {
    if (!sessionState.sessionId || sessionEndedRef.current) return

    const unsubscribe = FirestoreService.subscribeToSession(
      sessionState.sessionId,
      (updatedSession) => {
        if (!updatedSession || sessionEndedRef.current) return

        // Sync timer from trainer's broadcast
        if (updatedSession.currentTimeRemaining !== undefined) {
          setGameState(prev => ({
            ...prev,
            timeRemaining: updatedSession.currentTimeRemaining!
          }))
        }

        // Sync question index if trainer advances
        if (updatedSession.currentQuestionIndex !== undefined &&
            updatedSession.currentQuestionIndex !== gameStateRef.current.currentQuestionIndex) {
          const newIndex = updatedSession.currentQuestionIndex
          if (newIndex < quiz.questions.length) {
            setCurrentQuestion(quiz.questions[newIndex])
            setGameState(prev => ({
              ...prev,
              currentQuestionIndex: newIndex,
              timeRemaining: quiz.timeLimit
            }))
            setSelectedAnswer(null)
            setAnswerSubmitted(false)
            setAnswerLocked(false)
            setShowResult(false)
          }
        }

        // Check if session ended
        if (updatedSession.status === 'completed' && !sessionEndedRef.current) {
          setSessionEnded(true)
          showFinalResults()
        }
      }
    )

    return () => unsubscribe()
  }, [sessionState.sessionId, quiz.questions, quiz.timeLimit])

  // Live stats - subscribe to participants for ranking
  useEffect(() => {
    if (!sessionState.sessionId) return

    const unsubscribe = FirestoreService.subscribeToSessionParticipants(
      sessionState.sessionId,
      (participants) => {
        setAllParticipants(participants)
        setParticipantCount(participants.length)

        // Calculate current rank based on score
        const sortedByScore = [...participants].sort((a, b) =>
          (b.gameState?.score || 0) - (a.gameState?.score || 0)
        )
        const myIndex = sortedByScore.findIndex(p => p.id === participantId)
        if (myIndex !== -1) {
          setCurrentRank(myIndex + 1)
        }
      }
    )

    return () => unsubscribe()
  }, [sessionState.sessionId, participantId])

  // Session persistence - save state periodically
  useEffect(() => {
    if (!sessionState.sessionId || !participantId) return

    const saveSession = () => {
      const recoveryData = {
        sessionId: sessionState.sessionId,
        participantId,
        participantName: sessionState.participantName,
        gameType: sessionState.gameType,
        sessionCode: session.code,
        timestamp: Date.now()
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(recoveryData))
    }

    // Save immediately and on interval
    saveSession()
    const saveInterval = setInterval(saveSession, 30000) // Every 30 seconds

    return () => clearInterval(saveInterval)
  }, [sessionState, participantId, session.code])

  // Timer effect with auto-submit using refs for reliability
  useEffect(() => {
    if (!answerSubmitted && !sessionEnded && gameState.timeRemaining > 0) {
      const timer = setInterval(() => {
        setGameState(prev => {
          const newTime = prev.timeRemaining - 1

          // Auto-submit when time runs out - use refs to avoid stale closure
          if (newTime <= 0 && !answerSubmittedRef.current && !sessionEndedRef.current) {
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              if (!answerSubmittedRef.current) {
                submitAnswer(selectedAnswerRef.current, true)
              }
            }, 0)
          }

          return { ...prev, timeRemaining: newTime }
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [answerSubmitted, sessionEnded])

  // Handle answer selection with locking
  const handleAnswerSelect = useCallback((index: number) => {
    if (answerSubmitted || answerLocked) return

    setSelectedAnswer(index)
    soundSystem.play('select')

    // Lock answer after 300ms delay (prevents accidental double-taps)
    setAnswerLocked(true)

    // Auto-submit after a brief lock period (1500ms for review, then submit)
    setTimeout(() => {
      if (!answerSubmittedRef.current) {
        submitAnswer(index)
      }
    }, 1500)
  }, [answerSubmitted, answerLocked])

  const submitAnswer = async (answerIndex: number | null, autoSubmit = false) => {
    // Use refs for reliable checking
    if (answerSubmittedRef.current || !currentQuestionRef.current) return

    setAnswerSubmitted(true)
    answerSubmittedRef.current = true // Update ref immediately

    const question = currentQuestionRef.current
    const state = gameStateRef.current
    const timeSpent = quiz.timeLimit - state.timeRemaining
    const isCorrect = answerIndex === question.correctAnswer

    // Play sound effect based on answer result
    if (isCorrect) {
      soundSystem.play('correct')
      // Play streak sound if on a streak
      if (state.streak >= 2) {
        setTimeout(() => soundSystem.play('streak'), 300)
      }
    } else {
      soundSystem.play('incorrect')
    }

    const answerRecord = {
      questionId: question.id,
      selectedAnswer: answerIndex ?? -1,
      isCorrect,
      timeSpent,
      confidence: undefined
    }

    const newScore = state.score + (isCorrect ? 100 : 0)
    const newStreak = isCorrect ? state.streak + 1 : 0

    // Update game state
    setGameState(prev => ({
      ...prev,
      score: newScore,
      streak: newStreak,
      answers: [...prev.answers, answerRecord]
    }))

    // Persist answer to Firestore
    try {
      await FirestoreService.submitAnswer(
        sessionState.sessionId,
        participantId,
        {
          questionId: question.id,
          questionIndex: state.currentQuestionIndex,
          selectedAnswer: answerIndex ?? -1,
          isCorrect,
          timeSpent,
          participantName: sessionState.participantName
        }
      )

      // Update participant game state
      await FirestoreService.updateParticipantGameState(
        sessionState.sessionId,
        participantId,
        {
          currentQuestionIndex: state.currentQuestionIndex,
          score: newScore,
          streak: newStreak,
          answers: [...state.answers, answerRecord]
        }
      )
    } catch (error) {
      console.error('Error persisting answer:', error)
    }

    // Show result for 3.5 seconds (extended for better readability)
    setShowResult(true)
    setResultCountdown(3)

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setResultCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    setTimeout(() => {
      clearInterval(countdownInterval)
      nextQuestion()
    }, 3500)
  }

  const nextQuestion = () => {
    if (!quiz) return

    const nextIndex = gameStateRef.current.currentQuestionIndex + 1

    if (nextIndex >= quiz.questions.length) {
      // Quiz complete
      setSessionEnded(true)
      sessionEndedRef.current = true
      showFinalResults()
      return
    }

    // Move to next question
    setCurrentQuestion(quiz.questions[nextIndex])
    setGameState(prev => ({
      ...prev,
      currentQuestionIndex: nextIndex,
      timeRemaining: quiz.timeLimit
    }))

    // Reset answer state
    setSelectedAnswer(null)
    setAnswerSubmitted(false)
    answerSubmittedRef.current = false
    setAnswerLocked(false)
    setShowResult(false)
  }

  const showFinalResults = async () => {
    const state = gameStateRef.current

    // Play celebration sound
    soundSystem.play('celebration')
    setTimeout(() => soundSystem.play('gameEnd'), 500)

    // Calculate total time spent
    const totalTime = state.answers.reduce((sum, a) => sum + a.timeSpent, 0)

    // Mark participant as completed in Firestore
    try {
      await FirestoreService.markParticipantCompleted(
        sessionState.sessionId,
        participantId,
        state.score,
        totalTime
      )
    } catch (error) {
      console.error('Error marking participant completed:', error)
    }

    // Clear session recovery data
    localStorage.removeItem(SESSION_STORAGE_KEY)

    // Calculate best streak
    const bestStreak = Math.max(0, ...state.answers.map((_, i) => {
      let streak = 0
      for (let j = i; j >= 0 && state.answers[j]?.isCorrect; j--) {
        streak++
      }
      return streak
    }))

    setTimeout(() => {
      onGameComplete(state.score, {
        totalQuestions: state.totalQuestions,
        correctAnswers: state.answers.filter(a => a.isCorrect).length,
        bestStreak,
        // Pass full game state for detailed results
        gameState: {
          score: state.score,
          streak: bestStreak,
          answers: state.answers,
          totalQuestions: state.totalQuestions
        },
        // Pass quiz data for question review
        quiz: quiz
      })
    }, 3000)
  }

  // Kicked state - show message before redirect
  if (isKicked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(to bottom right, var(--error-color), #7f1d1d, #450a0a)' }}
      >
        {/* Backdrop effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-30 animate-pulse" style={{ backgroundColor: 'var(--error-light-color)' }} />
          <div className="absolute bottom-20 right-20 w-24 h-24 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: 'white', animationDelay: '0.5s' }} />
        </div>

        <div
          className="p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'var(--error-color)' }}
        >
          <div
            className="p-3 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'var(--error-color)' }}
          >
            <AlertTriangle size={32} style={{ color: 'white' }} />
          </div>
          <div
            className="px-6 py-2 rounded-lg mb-6"
            style={{ backgroundColor: 'var(--error-color)', color: 'white' }}
          >
            <h1 className="text-xl font-bold">Removed from Session</h1>
          </div>
          <div
            className="p-6 rounded-xl mb-6 border"
            style={{ backgroundColor: 'var(--error-light-color)', borderColor: 'var(--error-color)' }}
          >
            <p className="font-medium mb-2" style={{ color: 'var(--error-color)' }}>Session Ended</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              You have been removed from the training session by the trainer.
            </p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-color)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>Redirecting...</p>
            <div className="w-2 h-2 rounded-full animate-pulse mx-auto mt-2" style={{ backgroundColor: 'var(--primary-color)' }} />
          </div>
        </div>
      </div>
    )
  }

  if (sessionEnded) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(to bottom right, var(--primary-dark-color, #1e3a8a), var(--secondary-color, #1e40af), var(--celebration-color, #7c3aed))' }}
      >
        {/* Celebration backdrop */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-30 animate-pulse" style={{ backgroundColor: 'var(--accent-color, #fbbf24)' }} />
          <div className="absolute top-20 right-20 w-24 h-24 rounded-full opacity-40 animate-pulse" style={{ backgroundColor: 'var(--success-color)', animationDelay: '0.5s' }} />
          <div className="absolute bottom-20 left-20 w-28 h-28 rounded-full opacity-35 animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '1s' }} />
          <div className="absolute bottom-10 right-10 w-36 h-36 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: 'var(--celebration-color, #ec4899)', animationDelay: '1.5s' }} />
        </div>

        {/* Floating celebration emojis */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 text-4xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎉</div>
          <div className="absolute top-1/3 left-10 text-3xl animate-bounce" style={{ animationDelay: '0.8s' }}>🏆</div>
          <div className="absolute bottom-1/4 right-10 text-4xl animate-bounce" style={{ animationDelay: '1.2s' }}>⭐</div>
          <div className="absolute top-1/4 right-1/4 text-2xl animate-bounce" style={{ animationDelay: '1.8s' }}>🎊</div>
        </div>

        <div
          className="p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'var(--primary-color)' }}
        >
          {/* Success header */}
          <div className="mb-6">
            <div
              className="p-3 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--success-color)' }}
            >
              <Trophy size={32} style={{ color: 'white' }} />
            </div>
            <div
              className="px-6 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
            >
              <h1 className="text-xl font-bold">Training Complete!</h1>
            </div>
          </div>

          {/* Participant recognition */}
          <div
            className="p-6 rounded-xl mb-6 border"
            style={{ backgroundColor: 'var(--primary-light-color)', borderColor: 'var(--primary-color)' }}
          >
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--primary-dark-color)' }}>
              {sessionState.participantName}
            </h2>
            <p className="font-medium mb-3" style={{ color: 'var(--text-color)' }}>
              Assessment Completed Successfully
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success-color)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--success-color)' }}>Submitted</span>
            </div>
          </div>

          {/* Results summary */}
          <div
            className="p-4 rounded-xl mb-6"
            style={{ backgroundColor: 'var(--surface-color)' }}
          >
            <div className="space-y-3 text-left">
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary-color)' }}>Score:</span>
                <span className="font-bold text-lg" style={{ color: 'var(--primary-color)' }}>
                  {gameState.score} points
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary-color)' }}>Correct Answers:</span>
                <span className="font-bold" style={{ color: 'var(--success-color)' }}>
                  {gameState.answers.filter(a => a.isCorrect).length}/{gameState.totalQuestions}
                </span>
              </div>
              {currentRank && (
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--text-secondary-color)' }}>Final Rank:</span>
                  <span
                    className="font-bold px-2 py-1 rounded"
                    style={{
                      backgroundColor: currentRank <= 3 ? 'var(--gold-color, #fbbf24)' : 'var(--surface-hover-color)',
                      color: currentRank <= 3 ? '#000' : 'var(--text-color)'
                    }}
                  >
                    #{currentRank} of {participantCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Processing indicator */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-color)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary-color)' }}>
              Processing results...
            </p>
            <LoadingSpinner size="sm" />
          </div>
        </div>
      </div>
    )
  }

  // Answer labels
  const answerLabels = ['A', 'B', 'C', 'D']

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color)' }}>
        <div className="text-center">
          <p style={{ color: 'var(--text-secondary-color)' }}>Question not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--background-color)' }}>
      {/* Subtle background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-5" style={{ backgroundColor: 'var(--primary-color)' }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-5" style={{ backgroundColor: 'var(--secondary-color)' }} />
      </div>

      {/* Mobile-optimized header */}
      <header
        className="relative z-10 shadow-lg border-b-2"
        style={{
          backgroundColor: 'var(--primary-dark-color, #1e3a8a)',
          borderColor: 'var(--primary-color)'
        }}
      >
        <div className="px-4 py-4">
          {/* Main row: Quiz title and Timer */}
          <div className="flex items-center justify-between">
            <h1
              className="text-lg font-bold flex-1 truncate"
              style={{ color: 'var(--text-on-primary-color, white)' }}
            >
              {session.title || 'Quiz'}
            </h1>

            {/* Clear Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono font-bold ${
                gameState.timeRemaining <= 30 ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor: gameState.timeRemaining <= 30 ? 'var(--error-color)' : 'var(--accent-color, #fbbf24)',
                color: gameState.timeRemaining <= 30 ? 'white' : 'var(--primary-dark-color, #1e3a8a)'
              }}
            >
              <Clock size={16} />
              <span>{formatTime(Math.max(0, gameState.timeRemaining))}</span>
            </div>
          </div>

          {/* Secondary info row */}
          <div className="flex items-center justify-between mt-2 text-sm" style={{ color: 'var(--text-on-primary-color, rgba(255,255,255,0.9))' }}>
            <div className="font-medium">
              {sessionState.participantName}
              {currentRank && (
                <span
                  className="ml-2 px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    backgroundColor: currentRank <= 3 ? 'var(--gold-color, #fbbf24)' : 'rgba(255,255,255,0.2)',
                    color: currentRank <= 3 ? '#000' : 'white'
                  }}
                >
                  #{currentRank}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3" style={{ color: 'var(--text-on-primary-color, rgba(255,255,255,0.8))' }}>
              <span>{participantCount} participants</span>
              {gameState.streak > 0 && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded animate-pulse"
                  style={{ backgroundColor: 'var(--streak-color, #f97316)', color: 'white' }}
                >
                  <Zap size={12} /> {gameState.streak}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-6 max-w-2xl mx-auto">
        {/* Question Progress Indicator */}
        <div
          className="rounded-xl p-4 mb-6 border shadow-sm"
          style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-lg" style={{ color: 'var(--text-color)' }}>
              Question {gameState.currentQuestionIndex + 1} of {gameState.totalQuestions}
            </span>
            <span
              className="font-bold"
              style={{ color: 'var(--primary-color)' }}
            >
              {gameState.score} pts
            </span>
          </div>
          {/* Question dots */}
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: gameState.totalQuestions }).map((_, index) => (
              <div
                key={index}
                className="min-w-[32px] h-8 rounded-lg border-2 flex items-center justify-center font-bold text-sm"
                style={{
                  borderColor: index === gameState.currentQuestionIndex
                    ? 'var(--primary-color)'
                    : index < gameState.currentQuestionIndex
                    ? 'var(--success-color)'
                    : 'var(--border-color)',
                  backgroundColor: index === gameState.currentQuestionIndex
                    ? 'var(--primary-color)'
                    : index < gameState.currentQuestionIndex
                    ? 'var(--success-light-color)'
                    : 'var(--surface-color)',
                  color: index === gameState.currentQuestionIndex
                    ? 'white'
                    : index < gameState.currentQuestionIndex
                    ? 'var(--success-color)'
                    : 'var(--text-secondary-color)'
                }}
              >
                {index < gameState.currentQuestionIndex ? '✓' : index + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Question Card */}
        <div
          className="rounded-xl shadow-lg p-6 mb-6 border"
          style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
        >
          <h2
            className="text-xl font-bold mb-6 leading-relaxed text-center"
            style={{ color: 'var(--text-color)' }}
          >
            {currentQuestion.questionText}
          </h2>

          {/* Answer Options with A/B/C/D labels */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === index
              const isCorrect = index === currentQuestion.correctAnswer
              const isWrong = isSelected && !isCorrect

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={answerSubmitted || answerLocked}
                  className="w-full min-h-[60px] p-4 text-left rounded-xl transition-all border-2"
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    borderColor: answerSubmitted
                      ? isCorrect
                        ? 'var(--success-color)'
                        : isWrong
                        ? 'var(--error-color)'
                        : 'var(--border-color)'
                      : isSelected
                      ? 'var(--primary-color)'
                      : 'var(--border-color)',
                    backgroundColor: answerSubmitted
                      ? isCorrect
                        ? 'var(--success-light-color)'
                        : isWrong
                        ? 'var(--error-light-color)'
                        : 'var(--surface-color)'
                      : isSelected
                      ? 'var(--primary-light-color)'
                      : 'var(--surface-color)',
                    opacity: answerLocked && !isSelected ? 0.5 : 1,
                    cursor: answerSubmitted || answerLocked ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div className="flex items-center">
                    {/* A/B/C/D Label */}
                    <div
                      className="min-w-[44px] h-11 rounded-lg border-2 mr-4 flex items-center justify-center font-bold"
                      style={{
                        borderColor: answerSubmitted
                          ? isCorrect
                            ? 'var(--success-color)'
                            : isWrong
                            ? 'var(--error-color)'
                            : 'var(--border-color)'
                          : isSelected
                          ? 'var(--primary-color)'
                          : 'var(--border-color)',
                        backgroundColor: answerSubmitted
                          ? isCorrect
                            ? 'var(--success-color)'
                            : isWrong
                            ? 'var(--error-color)'
                            : 'var(--surface-color)'
                          : isSelected
                          ? 'var(--primary-color)'
                          : 'var(--surface-color)',
                        color: (answerSubmitted && (isCorrect || isWrong)) || isSelected
                          ? 'white'
                          : 'var(--text-secondary-color)'
                      }}
                    >
                      {answerSubmitted && isCorrect ? '✓' : answerSubmitted && isWrong ? '✗' : answerLabels[index]}
                    </div>
                    <span
                      className="text-base font-medium leading-relaxed flex-1"
                      style={{ color: 'var(--text-color)' }}
                    >
                      {option}
                    </span>
                    {answerSubmitted && isCorrect && (
                      <span className="ml-2 text-xl">🎉</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Status Messages */}
        {!answerLocked && !answerSubmitted && (
          <div
            className="text-center p-4 rounded-xl border"
            style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
          >
            <p className="font-bold" style={{ color: 'var(--text-color)' }}>
              Select your answer to continue
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary-color)' }}>
              Quiz will automatically advance to the next question
            </p>
          </div>
        )}

        {answerLocked && !answerSubmitted && (
          <div
            className="text-center p-4 rounded-xl border"
            style={{ backgroundColor: 'var(--primary-light-color)', borderColor: 'var(--primary-color)' }}
          >
            <p className="font-bold" style={{ color: 'var(--primary-dark-color)' }}>
              Processing answer...
            </p>
          </div>
        )}

        {/* Explanation */}
        {showResult && currentQuestion.explanation && (
          <div
            className="mt-4 p-4 rounded-xl border"
            style={{ backgroundColor: 'var(--info-light-color, #dbeafe)', borderColor: 'var(--info-color, #3b82f6)' }}
          >
            <p className="text-sm" style={{ color: 'var(--info-color, #1d4ed8)' }}>
              <strong>Explanation:</strong> {currentQuestion.explanation}
            </p>
          </div>
        )}
      </main>

      {/* Full-screen answer feedback overlay */}
      {showResult && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div
            className="text-center p-8 rounded-2xl border-4 max-w-sm mx-4 animate-fade-in"
            style={{
              backgroundColor: selectedAnswer === currentQuestion.correctAnswer
                ? 'var(--success-light-color)'
                : 'var(--error-light-color)',
              borderColor: selectedAnswer === currentQuestion.correctAnswer
                ? 'var(--success-color)'
                : 'var(--error-color)'
            }}
          >
            <div className="text-6xl mb-4">
              {selectedAnswer === currentQuestion.correctAnswer ? '✓' : '✗'}
            </div>
            <h2
              className="text-3xl font-bold mb-2"
              style={{
                color: selectedAnswer === currentQuestion.correctAnswer
                  ? 'var(--success-color)'
                  : 'var(--error-color)'
              }}
            >
              {selectedAnswer === currentQuestion.correctAnswer ? 'Correct!' : 'Incorrect'}
            </h2>
            {selectedAnswer === currentQuestion.correctAnswer && gameState.streak > 0 && (
              <p
                className="text-lg font-bold flex items-center justify-center gap-2"
                style={{ color: 'var(--streak-color, #f97316)' }}
              >
                <Zap size={20} /> Streak: {gameState.streak}
              </p>
            )}
            {/* Countdown to next question */}
            <p
              className="text-sm mt-4 opacity-75"
              style={{ color: 'var(--text-secondary-color)' }}
            >
              Next question in {resultCountdown}...
            </p>
          </div>
        </div>
      )}

      {/* Floating Sound Control */}
      <SoundControl position="bottom-right" minimal={true} />
    </div>
  )
}
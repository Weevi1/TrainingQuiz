import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Clock, Users, Star, Zap, Target, Trophy, CheckCircle, XCircle } from 'lucide-react'
import { FirestoreService, type GameSession, type Quiz, type Question } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { GameDispatcher } from '../components/gameModules/GameDispatcher'
import { type ModuleType } from '../lib/permissions'

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
  const sessionState = location.state as SessionState

  const [session, setSession] = useState<GameSession | null>(null)
  const [gameData, setGameData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Redirect if no session state
  useEffect(() => {
    if (!sessionState) {
      navigate(`/join/${sessionCode}`)
      return
    }
  }, [sessionState, sessionCode, navigate])

  // Load session and game data
  useEffect(() => {
    loadSessionData()
  }, [])

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

      // Fetch real quiz data from Firestore
      const quizId = realSession.gameData?.quizId
      if (!quizId) {
        console.error('No quiz ID found in session')
        setLoading(false)
        return
      }

      const realQuiz = await FirestoreService.getQuiz(realSession.organizationId, quizId)

      if (!realQuiz) {
        console.error('Quiz not found:', quizId)
        setLoading(false)
        return
      }

      // Fetch participants for live engagement
      const participants = await FirestoreService.getSessionParticipants(sessionState.sessionId)

      setSession(realSession)
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
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGameComplete = (score: number, additionalData?: any) => {
    // Navigate to results with game data
    navigate('/results', {
      state: {
        participantName: sessionState.participantName,
        gameType: sessionState.gameType,
        score,
        additionalData,
        sessionCode
      }
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading {sessionState?.gameType || 'game'}...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (!session || !gameData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Game data not found</p>
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

  // Enhanced game modules
  if (['millionaire', 'bingo', 'speedround', 'spotdifference'].includes(sessionState.gameType)) {
    return (
      <GameDispatcher
        gameType={sessionState.gameType}
        gameData={gameData}
        participantName={sessionState.participantName}
        onGameComplete={handleGameComplete}
        sessionSettings={session.settings}
      />
    )
  }

  // Legacy quiz implementation for backwards compatibility
  return <LegacyQuizGame
    session={session}
    gameData={gameData}
    sessionState={sessionState}
    onGameComplete={handleGameComplete}
  />
}

// Legacy quiz component (extracted for clarity)
const LegacyQuizGame: React.FC<{
  session: GameSession
  gameData: any
  sessionState: SessionState
  onGameComplete: (score: number, additionalData?: any) => void
}> = ({ session, gameData, sessionState, onGameComplete }) => {
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
  const [sessionEnded, setSessionEnded] = useState(false)

  // Timer effect
  useEffect(() => {
    if (!answerSubmitted && !sessionEnded && gameState.timeRemaining > 0) {
      const timer = setInterval(() => {
        setGameState(prev => {
          const newTime = prev.timeRemaining - 1
          if (newTime <= 0 && !answerSubmitted) {
            submitAnswer(selectedAnswer, true) // Auto-submit when time runs out
          }
          return { ...prev, timeRemaining: newTime }
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [answerSubmitted, sessionEnded, gameState.timeRemaining, selectedAnswer])

  const submitAnswer = async (answerIndex: number | null, autoSubmit = false) => {
    if (answerSubmitted || !currentQuestion) return

    setAnswerSubmitted(true)

    const timeSpent = quiz.timeLimit - gameState.timeRemaining
    const isCorrect = answerIndex === currentQuestion.correctAnswer

    const answerRecord = {
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex ?? -1,
      isCorrect,
      timeSpent,
      confidence: undefined
    }

    // Update game state
    setGameState(prev => ({
      ...prev,
      score: prev.score + (isCorrect ? 100 : 0),
      streak: isCorrect ? prev.streak + 1 : 0,
      answers: [...prev.answers, answerRecord]
    }))

    // Show result for 2 seconds
    setShowResult(true)

    setTimeout(() => {
      nextQuestion()
    }, 2000)
  }

  const nextQuestion = () => {
    if (!quiz) return

    const nextIndex = gameState.currentQuestionIndex + 1

    if (nextIndex >= quiz.questions.length) {
      // Quiz complete
      setSessionEnded(true)
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

    setSelectedAnswer(null)
    setAnswerSubmitted(false)
    setShowResult(false)
  }

  const showFinalResults = () => {
    setTimeout(() => {
      onGameComplete(gameState.score, {
        totalQuestions: gameState.totalQuestions,
        correctAnswers: gameState.answers.filter(a => a.isCorrect).length,
        bestStreak: Math.max(...gameState.answers.map((_, i) => {
          let streak = 0
          for (let j = i; j >= 0 && gameState.answers[j].isCorrect; j--) {
            streak++
          }
          return streak
        }))
      })
    }, 3000)
  }

  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Trophy className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Quiz Complete!</h1>
          <p className="text-text-secondary mb-4">
            Great job! Preparing your results...
          </p>
          <div className="space-y-2 text-left">
            <div className="flex justify-between">
              <span>Score:</span>
              <span className="font-bold">{gameState.score} points</span>
            </div>
            <div className="flex justify-between">
              <span>Correct:</span>
              <span className="font-bold">
                {gameState.answers.filter(a => a.isCorrect).length}/{gameState.totalQuestions}
              </span>
            </div>
          </div>
          <LoadingSpinner size="sm" className="mt-4" />
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Question not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-sm text-text-secondary">
              {sessionState.participantName}
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <Target size={16} />
                <span>{gameState.currentQuestionIndex + 1}/{gameState.totalQuestions}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star size={16} />
                <span>{gameState.score}</span>
              </div>
              {gameState.streak > 0 && (
                <div className="flex items-center space-x-1" style={{ color: 'var(--streak-color)' }}>
                  <Zap size={16} />
                  <span>{gameState.streak}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Timer */}
        <div className="card mb-6">
          <div className="flex items-center justify-center space-x-3">
            <Clock size={20} style={{ color: gameState.timeRemaining <= 10 ? 'var(--error-color)' : 'var(--primary-color)' }} />
            <span className="text-2xl font-bold" style={{ color: gameState.timeRemaining <= 10 ? 'var(--error-color)' : 'var(--primary-color)' }}>
              {Math.max(0, gameState.timeRemaining)}
            </span>
            <span className="text-text-secondary">seconds</span>
          </div>
          <div className="w-full rounded-full h-2 mt-3" style={{ backgroundColor: 'var(--surface-color)' }}>
            <div
              className="h-2 rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(0, (gameState.timeRemaining / quiz.timeLimit) * 100)}%`,
                backgroundColor: gameState.timeRemaining <= 10 ? 'var(--error-color)' : 'var(--primary-color)'
              }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="card mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-text-secondary">
                Question {gameState.currentQuestionIndex + 1}
              </span>
              <span
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: currentQuestion.difficulty === 'easy' ? 'var(--success-light-color)' :
                    currentQuestion.difficulty === 'medium' ? 'var(--warning-light-color)' :
                    'var(--error-light-color)',
                  color: currentQuestion.difficulty === 'easy' ? 'var(--success-color)' :
                    currentQuestion.difficulty === 'medium' ? 'var(--warning-color)' :
                    'var(--error-color)'
                }}
              >
                {currentQuestion.difficulty}
              </span>
            </div>
            <h2 className="text-xl font-semibold mb-4">{currentQuestion.questionText}</h2>
          </div>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => !answerSubmitted && setSelectedAnswer(index)}
                disabled={answerSubmitted}
                className="w-full p-4 text-left rounded-lg border-2 transition-all"
                style={{
                  borderColor: answerSubmitted
                    ? index === currentQuestion.correctAnswer
                      ? 'var(--success-color)'
                      : index === selectedAnswer && selectedAnswer !== currentQuestion.correctAnswer
                      ? 'var(--error-color)'
                      : 'var(--border-color)'
                    : selectedAnswer === index
                    ? 'var(--primary-color)'
                    : 'var(--border-color)',
                  backgroundColor: answerSubmitted
                    ? index === currentQuestion.correctAnswer
                      ? 'var(--success-light-color)'
                      : index === selectedAnswer && selectedAnswer !== currentQuestion.correctAnswer
                      ? 'var(--error-light-color)'
                      : 'var(--surface-color)'
                    : selectedAnswer === index
                    ? 'var(--primary-light-color)'
                    : 'var(--surface-color)'
                }}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: answerSubmitted
                        ? index === currentQuestion.correctAnswer
                          ? 'var(--success-color)'
                          : index === selectedAnswer && selectedAnswer !== currentQuestion.correctAnswer
                          ? 'var(--error-color)'
                          : 'var(--border-color)'
                        : selectedAnswer === index
                        ? 'var(--primary-color)'
                        : 'var(--border-color)',
                      backgroundColor: answerSubmitted
                        ? index === currentQuestion.correctAnswer
                          ? 'var(--success-color)'
                          : index === selectedAnswer && selectedAnswer !== currentQuestion.correctAnswer
                          ? 'var(--error-color)'
                          : 'transparent'
                        : selectedAnswer === index
                        ? 'var(--primary-color)'
                        : 'transparent'
                    }}
                  >
                    {answerSubmitted && index === currentQuestion.correctAnswer && (
                      <CheckCircle size={14} style={{ color: 'var(--text-on-primary-color)' }} />
                    )}
                    {answerSubmitted && index === selectedAnswer && selectedAnswer !== currentQuestion.correctAnswer && (
                      <XCircle size={14} style={{ color: 'var(--text-on-primary-color)' }} />
                    )}
                    {!answerSubmitted && selectedAnswer === index && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--text-on-primary-color)' }} />
                    )}
                  </div>
                  <span className="flex-1">{option}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Submit Button */}
          {!answerSubmitted && (
            <div className="mt-6">
              <button
                onClick={() => submitAnswer(selectedAnswer)}
                disabled={selectedAnswer === null}
                className="btn-primary w-full"
              >
                Submit Answer
              </button>
            </div>
          )}

          {/* Explanation */}
          {showResult && currentQuestion.explanation && (
            <div
              className="mt-6 p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--primary-light-color)',
                borderColor: 'var(--primary-color)'
              }}
            >
              <p className="text-sm" style={{ color: 'var(--primary-dark-color)' }}>
                <strong>Explanation:</strong> {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="text-center text-sm text-text-secondary">
          <div className="w-full rounded-full h-2 mb-2" style={{ backgroundColor: 'var(--surface-color)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${((gameState.currentQuestionIndex + 1) / gameState.totalQuestions) * 100}%`,
                backgroundColor: 'var(--primary-color)'
              }}
            />
          </div>
          Progress: {gameState.currentQuestionIndex + 1} of {gameState.totalQuestions} questions
        </div>
      </div>
    </div>
  )
}
import React, { useState, useEffect, useRef } from 'react'
import { Zap, Clock, CheckCircle, XCircle, SkipForward, Flame } from 'lucide-react'
import { LoadingSpinner } from '../LoadingSpinner'
import { useGameSounds } from '../../lib/soundSystem'
import { useVisualEffects } from '../../lib/visualEffects'
import { useAchievements } from '../../lib/achievementSystem'
import { LiveEngagement } from '../LiveEngagement'
import { useGameTheme, getCorrectStyle, getIncorrectStyle } from '../../hooks/useGameTheme'

interface SpeedQuestion {
  id: string
  questionText: string
  options: string[]
  correctAnswer: number
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  category?: string
}

interface EngagementParticipant {
  id: string
  name: string
  score: number
  streak: number
  answered: boolean
  isCurrentUser?: boolean
}

interface SpeedRoundGameProps {
  questions: SpeedQuestion[]
  onGameComplete: (score: number, stats: GameStats) => void
  participantName: string
  participants?: EngagementParticipant[]
  timeLimit: number
  questionTimeLimit?: number
  enableSkip?: boolean
}

interface GameStats {
  totalQuestions: number
  correctAnswers: number
  wrongAnswers: number
  skippedQuestions: number
  averageTimePerQuestion: number
  bestStreak: number
  totalScore: number
  accuracy: number
  questionsPerMinute: number
}

interface QuestionResult {
  questionId: string
  timeSpent: number
  isCorrect: boolean
  wasSkipped: boolean
  selectedAnswer?: number
  earnedPoints: number
}

const DIFFICULTY_MULTIPLIERS = {
  easy: 1,
  medium: 1.5,
  hard: 2
}

const STREAK_BONUSES: Record<number, number> = {
  5: 50,   // 5 streak bonus
  10: 100, // 10 streak bonus
  15: 200, // 15 streak bonus
  20: 500  // 20 streak bonus
}

export const SpeedRoundGame: React.FC<SpeedRoundGameProps> = ({
  questions,
  onGameComplete,
  participantName,
  participants = [],
  timeLimit,
  questionTimeLimit = 10,
  enableSkip = true
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [gameTimeRemaining, setGameTimeRemaining] = useState(timeLimit)
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(questionTimeLimit)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [results, setResults] = useState<QuestionResult[]>([])
  const [gameComplete, setGameComplete] = useState(false)
  const [isAnswering, setIsAnswering] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [currentResult, setCurrentResult] = useState<'correct' | 'wrong' | 'skipped' | null>(null)
  const [questionsAnswered, setQuestionsAnswered] = useState(0)
  const [gameStartTime] = useState(Date.now())

  const questionStartTimeRef = useRef<number>(Date.now())
  const answerTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scoreCounterRef = useRef<HTMLDivElement>(null)
  const answerButtonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tensionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Theme hook - all colors come from CSS variables
  const { styles, colors } = useGameTheme('speedRound')

  const { playSound, playSequence, playAmbientTension } = useGameSounds(true)
  const { applyEffect, triggerScreenEffect, animateScoreCounter } = useVisualEffects()
  const { processGameCompletion } = useAchievements()

  // Use real participants from props, or fallback to current user only
  const engagementParticipants = participants.length > 0
    ? participants.map(p => p.isCurrentUser
        ? { ...p, score, streak, answered: questionsAnswered > currentQuestionIndex }
        : p
      )
    : [{ id: 'current', name: participantName, score, streak, answered: questionsAnswered > currentQuestionIndex, isCurrentUser: true }]

  const currentQuestion = questions[currentQuestionIndex]

  // Game start sound effect
  useEffect(() => {
    playSound('gameStart')
    playSequence([{ sound: 'ding', delay: 0 }, { sound: 'tick', delay: 100 }])
  }, [])

  // Game timer
  useEffect(() => {
    if (gameTimeRemaining > 0 && !gameComplete) {
      const timer = setInterval(() => {
        setGameTimeRemaining(prev => {
          if (prev === 31) {
            playSound('timeWarning')
          }
          if (prev === 11) {
            tensionIntervalRef.current = playAmbientTension(10000) as NodeJS.Timeout
            playSound('tension')
          }
          if (prev <= 1) {
            endGame()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        clearInterval(timer)
        if (tensionIntervalRef.current) {
          clearInterval(tensionIntervalRef.current)
        }
      }
    }
  }, [gameTimeRemaining, gameComplete])

  // Question timer
  useEffect(() => {
    if (questionTimeRemaining > 0 && !isAnswering && !gameComplete) {
      const timer = setInterval(() => {
        setQuestionTimeRemaining(prev => {
          if (prev === 4) {
            playSound('timeWarning')
          }
          if (prev <= 1) {
            playSound('buzz')
            // Auto-skip when time runs out
            skipQuestion(true)
            return questionTimeLimit
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [questionTimeRemaining, isAnswering, gameComplete])

  // Reset question timer when moving to next question
  useEffect(() => {
    setQuestionTimeRemaining(questionTimeLimit)
    questionStartTimeRef.current = Date.now()
    setSelectedAnswer(null)
    setShowResult(false)
    setCurrentResult(null)

    // Play transition sound for new question
    if (currentQuestionIndex > 0) {
      playSound('whoosh')
    }
  }, [currentQuestionIndex])

  const submitAnswer = (answerIndex: number) => {
    if (isAnswering || gameComplete || !currentQuestion) return

    setIsAnswering(true)
    setSelectedAnswer(answerIndex)

    const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000
    const isCorrect = answerIndex === currentQuestion.correctAnswer

    // Get the answer button for visual effects
    const answerButton = answerButtonRefs.current[answerIndex]

    // Play sound and trigger effects based on correctness
    if (isCorrect) {
      playSound('correct')
      if (answerButton) {
        applyEffect(answerButton, 'correct-pulse')
      }
      triggerScreenEffect('screen-flash', { color: colors.success })

      // Check for streak effects
      const newStreak = streak + 1
      if (newStreak >= 5) {
        playSound('streak')
        triggerScreenEffect('streak-fire')
        if (answerButton) {
          applyEffect(answerButton, 'streak-fire')
        }
      }
    } else {
      playSound('incorrect')
      if (answerButton) {
        applyEffect(answerButton, 'wrong-shake')
      }
      triggerScreenEffect('screen-flash', { color: colors.error })
    }

    // Calculate points
    let earnedPoints = 0
    if (isCorrect) {
      const basePoints = currentQuestion.points || 100
      const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[currentQuestion.difficulty]
      const timeBonus = Math.max(0, (questionTimeLimit - timeSpent) * 5) // 5 points per second saved
      earnedPoints = Math.round(basePoints * difficultyMultiplier + timeBonus)

      // Apply streak bonuses
      const newStreak = streak + 1
      if (STREAK_BONUSES[newStreak]) {
        earnedPoints += STREAK_BONUSES[newStreak]
        playSound('achievement')
      }

      setScore(prev => {
        const newScore = prev + earnedPoints
        // Animate score counter
        if (scoreCounterRef.current) {
          animateScoreCounter(scoreCounterRef.current, prev, newScore)
        }
        return newScore
      })
      setStreak(newStreak)
      setBestStreak(prev => Math.max(prev, newStreak))
    } else {
      setStreak(0)
    }

    const result: QuestionResult = {
      questionId: currentQuestion.id,
      timeSpent,
      isCorrect,
      wasSkipped: false,
      selectedAnswer: answerIndex,
      earnedPoints
    }

    setResults(prev => [...prev, result])
    setCurrentResult(isCorrect ? 'correct' : 'wrong')
    setShowResult(true)
    setQuestionsAnswered(prev => prev + 1)

    // Clear any existing timeout
    if (answerTimeoutRef.current) {
      clearTimeout(answerTimeoutRef.current)
    }

    // Move to next question after brief delay
    answerTimeoutRef.current = setTimeout(() => {
      nextQuestion()
    }, 1500)
  }

  const skipQuestion = (autoSkip = false) => {
    if (isAnswering || gameComplete) return

    playSound('click')
    const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000

    const result: QuestionResult = {
      questionId: currentQuestion.id,
      timeSpent,
      isCorrect: false,
      wasSkipped: true,
      earnedPoints: 0
    }

    setResults(prev => [...prev, result])
    setStreak(0)
    setCurrentResult('skipped')
    setShowResult(true)
    setQuestionsAnswered(prev => prev + 1)

    if (!autoSkip) {
      // Manual skip - immediate transition
      setTimeout(() => {
        nextQuestion()
      }, 800)
    } else {
      // Auto-skip - immediate transition
      nextQuestion()
    }
  }

  const nextQuestion = () => {
    setIsAnswering(false)

    if (currentQuestionIndex + 1 >= questions.length) {
      endGame()
      return
    }

    setCurrentQuestionIndex(prev => prev + 1)
  }

  const endGame = () => {
    setGameComplete(true)

    // Stop tension sounds
    if (tensionIntervalRef.current) {
      clearInterval(tensionIntervalRef.current)
    }

    // Play game end sound
    playSound('gameEnd')
    setTimeout(() => {
      playSound('fanfare')
    }, 500)

    // Celebration effects
    triggerScreenEffect('celebration-confetti')

    const totalTime = (Date.now() - gameStartTime) / 1000
    const correctAnswers = results.filter(r => r.isCorrect).length
    const wrongAnswers = results.filter(r => !r.isCorrect && !r.wasSkipped).length
    const skippedQuestions = results.filter(r => r.wasSkipped).length

    const stats: GameStats = {
      totalQuestions: questionsAnswered,
      correctAnswers,
      wrongAnswers,
      skippedQuestions,
      averageTimePerQuestion: totalTime / Math.max(questionsAnswered, 1),
      bestStreak,
      totalScore: score,
      accuracy: questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0,
      questionsPerMinute: (questionsAnswered / (totalTime / 60)) || 0
    }

    // Process achievements
    const gameStatsForAchievements = {
      score,
      accuracy: stats.accuracy,
      timeSpent: totalTime,
      streak: bestStreak,
      questionsAnswered,
      correctAnswers,
      gameType: 'speedround',
      completedAt: new Date(),
      perfectScore: correctAnswers === questionsAnswered && questionsAnswered > 0,
      speedBonus: Math.max(0, (questionTimeLimit * questionsAnswered - totalTime) * 10)
    }

    processGameCompletion(gameStatsForAchievements)

    setTimeout(() => {
      onGameComplete(score, stats)
    }, 3000)
  }

  // Get answer option style based on state
  const getAnswerStyle = (index: number): React.CSSProperties => {
    const isSelected = selectedAnswer === index
    const isCorrectAnswer = index === currentQuestion?.correctAnswer
    const showCorrect = showResult && isCorrectAnswer
    const showWrong = showResult && isSelected && !isCorrectAnswer

    if (showCorrect) {
      return { ...styles.answerOption, ...getCorrectStyle() }
    }

    if (showWrong) {
      return { ...styles.answerOption, ...getIncorrectStyle() }
    }

    if (isAnswering && !isSelected) {
      return {
        ...styles.answerOption,
        opacity: 0.5
      }
    }

    return styles.answerOption
  }

  // Get answer indicator style
  const getIndicatorStyle = (index: number): React.CSSProperties => {
    const isSelected = selectedAnswer === index
    const isCorrectAnswer = index === currentQuestion?.correctAnswer
    const showCorrect = showResult && isCorrectAnswer
    const showWrong = showResult && isSelected && !isCorrectAnswer

    const baseStyle: React.CSSProperties = {
      width: '2rem',
      height: '2rem',
      borderRadius: '50%',
      border: '2px solid',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold'
    }

    if (showCorrect) {
      return {
        ...baseStyle,
        borderColor: 'var(--success-color)',
        backgroundColor: 'var(--success-color)',
        color: 'var(--text-on-primary-color)'
      }
    }

    if (showWrong) {
      return {
        ...baseStyle,
        borderColor: 'var(--error-color)',
        backgroundColor: 'var(--error-color)',
        color: 'var(--text-on-primary-color)'
      }
    }

    if (isAnswering && !isSelected) {
      return {
        ...baseStyle,
        borderColor: 'var(--border-color)',
        color: 'var(--text-secondary-color)'
      }
    }

    return {
      ...baseStyle,
      borderColor: 'var(--game-accent-color)',
      color: 'var(--game-accent-color)'
    }
  }

  // Get difficulty badge style
  const getDifficultyStyle = (difficulty: string): React.CSSProperties => {
    switch (difficulty) {
      case 'easy':
        return { backgroundColor: 'var(--success-light-color)', color: 'var(--success-color)' }
      case 'medium':
        return { backgroundColor: 'var(--warning-light-color)', color: 'var(--warning-color)' }
      case 'hard':
        return { backgroundColor: 'var(--error-light-color)', color: 'var(--error-color)' }
      default:
        return { backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary-color)' }
    }
  }

  if (gameComplete) {
    return (
      <div style={styles.container} className="flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div
            className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--game-accent-color)' }}
          >
            <Zap style={{ color: 'var(--text-color)' }} size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2">Speed Round Complete!</h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary-color)' }}>
            Lightning fast answers!
          </p>

          <div
            className="rounded-lg p-4 mb-4"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-2xl font-bold" style={styles.accentText}>{score}</div>
                <div>Final Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>{questionsAnswered}</div>
                <div>Questions</div>
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary-light-color)' }}>{bestStreak}</div>
                <div>Best Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--celebration-color)' }}>
                  {Math.round((results.filter(r => r.isCorrect).length / Math.max(questionsAnswered, 1)) * 100)}%
                </div>
                <div>Accuracy</div>
              </div>
            </div>
          </div>

          <LoadingSpinner size="sm" />
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary-color)' }}>
            Preparing your results...
          </p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div style={styles.container} className="flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              {participantName}
            </div>
            <div className="text-xl font-bold flex items-center space-x-2" style={styles.accentText}>
              <Zap className="animate-pulse" size={24} />
              <span>SPEED ROUND</span>
              <Zap className="animate-pulse" size={24} />
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1" style={styles.accentText}>
                <Clock size={16} />
                <span className="font-mono">
                  {Math.floor(gameTimeRemaining / 60)}:{(gameTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Game Stats */}
        <div
          className="rounded-lg p-4 mb-6"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
        >
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div ref={scoreCounterRef} className="text-2xl font-bold score-counter" style={styles.accentText}>{score}</div>
              <div className="text-xs">Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>{questionsAnswered}</div>
              <div className="text-xs">Questions</div>
            </div>
            <div>
              <div
                className={`text-2xl font-bold ${streak >= 5 ? 'animate-pulse' : ''}`}
                style={{ color: streak >= 5 ? 'var(--streak-color)' : 'var(--primary-light-color)' }}
              >
                {streak}
              </div>
              <div className="text-xs">Streak</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--celebration-color)' }}>
                {Math.round((results.filter(r => r.isCorrect).length / Math.max(questionsAnswered, 1)) * 100)}%
              </div>
              <div className="text-xs">Accuracy</div>
            </div>
          </div>
        </div>

        {/* Streak Bonus Alert */}
        {streak >= 5 && STREAK_BONUSES[streak] && (
          <div
            className="rounded-lg p-3 mb-4 text-center enhance-streak"
            style={{ backgroundColor: 'var(--streak-color)', color: 'var(--text-color)' }}
          >
            <div className="flex items-center justify-center space-x-2">
              <Flame size={20} />
              <span className="font-bold">STREAK BONUS! +{STREAK_BONUSES[streak]} points!</span>
              <Flame size={20} />
            </div>
          </div>
        )}

        {/* Question Timer */}
        <div
          className={`rounded-lg p-4 mb-6 ${questionTimeRemaining <= 3 ? 'enhance-timer-warning' : ''}`}
          style={questionTimeRemaining <= 3 ? styles.timerUrgent : styles.timerArea}
        >
          <div className="flex items-center justify-center space-x-3 mb-3">
            <Clock
              size={20}
              className={questionTimeRemaining <= 3 ? 'animate-pulse' : ''}
              style={{ color: questionTimeRemaining <= 3 ? 'var(--speedround-urgent)' : 'inherit' }}
            />
            <span
              className={`text-3xl font-bold font-mono ${questionTimeRemaining <= 3 ? 'animate-pulse' : ''}`}
              style={{ color: questionTimeRemaining <= 3 ? 'var(--speedround-urgent)' : 'inherit' }}
            >
              {questionTimeRemaining}
            </span>
          </div>
          <div
            className="w-full rounded-full h-3"
            style={{ backgroundColor: 'var(--border-color)' }}
          >
            <div
              className="h-3 rounded-full transition-all duration-1000"
              style={{
                width: `${(questionTimeRemaining / questionTimeLimit) * 100}%`,
                backgroundColor: questionTimeRemaining <= 3 ? 'var(--speedround-urgent)' : 'var(--success-color)'
              }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="rounded-lg p-6 mb-6" style={styles.questionCard}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <div className="flex items-center space-x-2">
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={getDifficultyStyle(currentQuestion.difficulty)}
              >
                {currentQuestion.difficulty.toUpperCase()}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary-color)' }}>
                {currentQuestion.points || 100} pts × {DIFFICULTY_MULTIPLIERS[currentQuestion.difficulty]}
              </span>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-6">{currentQuestion.questionText}</h2>

          {/* Answer Options */}
          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                ref={el => { answerButtonRefs.current[index] = el }}
                onClick={() => !isAnswering && submitAnswer(index)}
                disabled={isAnswering}
                className="p-4 text-left transition-all transform touch-feedback answer-option"
                style={getAnswerStyle(index)}
              >
                <div className="flex items-center space-x-3">
                  <div style={getIndicatorStyle(index)}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="flex-1">{option}</span>
                  {isAnswering && selectedAnswer === index && (
                    currentResult === 'correct' ?
                      <CheckCircle style={{ color: 'var(--success-color)' }} size={20} /> :
                      <XCircle style={{ color: 'var(--error-color)' }} size={20} />
                  )}
                  {isAnswering && index === currentQuestion.correctAnswer && selectedAnswer !== index && showResult && (
                    <CheckCircle style={{ color: 'var(--success-color)' }} size={20} />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Skip Button */}
          {enableSkip && !isAnswering && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => skipQuestion()}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--surface-color)',
                  color: 'var(--text-secondary-color)'
                }}
              >
                <SkipForward size={16} />
                <span>Skip Question</span>
              </button>
            </div>
          )}
        </div>

        {/* Result Feedback */}
        {showResult && (
          <div
            className="text-center py-4 rounded-lg mb-4 enhance-celebration"
            style={{
              backgroundColor:
                currentResult === 'correct' ? 'var(--success-color)' :
                currentResult === 'wrong' ? 'var(--error-color)' :
                'var(--surface-color)',
              color: 'var(--text-on-primary-color)'
            }}
          >
            <div className="flex items-center justify-center space-x-2">
              {currentResult === 'correct' && <CheckCircle size={24} />}
              {currentResult === 'wrong' && <XCircle size={24} />}
              {currentResult === 'skipped' && <SkipForward size={24} />}
              <span className="text-lg font-bold">
                {currentResult === 'correct' && 'Correct!'}
                {currentResult === 'wrong' && 'Wrong Answer'}
                {currentResult === 'skipped' && 'Skipped'}
              </span>
            </div>
            {currentResult === 'correct' && (
              <p className="text-sm mt-1">
                +{results[results.length - 1]?.earnedPoints || 0} points
              </p>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="text-center">
          <div
            className="w-full rounded-full h-2 mb-2"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
          >
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                backgroundColor: 'var(--game-accent-color)'
              }}
            />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
            Progress: {currentQuestionIndex + 1} of {questions.length} questions
          </p>
        </div>
      </div>

      {/* Live Engagement Component */}
      <LiveEngagement
        participants={engagementParticipants}
        currentQuestion={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        showProgress={true}
        showLeaderboard={true}
        showParticipantCount={true}
        showAnswerProgress={true}
        onReaction={(reaction) => {
          playSound('click')
          console.log('Player reacted with:', reaction)
        }}
      />
    </div>
  )
}

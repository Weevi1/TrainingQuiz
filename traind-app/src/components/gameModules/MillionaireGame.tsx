import React, { useState, useEffect, useRef } from 'react'
import { Clock, DollarSign, Phone, Users, Target, Heart, AlertTriangle } from 'lucide-react'
import { LoadingSpinner } from '../LoadingSpinner'
import { useGameSounds } from '../../lib/soundSystem'
import { useVisualEffects } from '../../lib/visualEffects'
import { useAchievements } from '../../lib/achievementSystem'
import { LiveEngagement } from '../LiveEngagement'
import { useGameTheme, getCorrectStyle, getIncorrectStyle, getSelectedStyle } from '../../hooks/useGameTheme'
import { FirestoreService, type OrganizationBranding } from '../../lib/firestore'

interface MillionaireQuestion {
  id: string
  questionText: string
  options: string[]
  correctAnswer: number
  difficulty: 1 | 2 | 3 | 4 | 5
  valueAmount: number
  category?: string
}

interface Lifeline {
  type: 'fifty_fifty' | 'phone_friend' | 'ask_audience'
  used: boolean
  name: string
  icon: React.ReactNode
}

interface EngagementParticipant {
  id: string
  name: string
  score: number
  streak: number
  answered: boolean
  isCurrentUser?: boolean
}

interface MillionaireGameProps {
  questions: MillionaireQuestion[]
  onGameComplete: (score: number, winnings: number) => void
  timeLimit?: number
  participantName: string
  participants?: EngagementParticipant[]
  sessionId?: string
  participantId?: string
  reactions?: OrganizationBranding['reactions']
}

const MONEY_LADDER = [
  { level: 1, amount: 100, isSafe: false },
  { level: 2, amount: 200, isSafe: false },
  { level: 3, amount: 300, isSafe: false },
  { level: 4, amount: 500, isSafe: false },
  { level: 5, amount: 1000, isSafe: true },
  { level: 6, amount: 2000, isSafe: false },
  { level: 7, amount: 4000, isSafe: false },
  { level: 8, amount: 8000, isSafe: false },
  { level: 9, amount: 16000, isSafe: false },
  { level: 10, amount: 32000, isSafe: true },
  { level: 11, amount: 64000, isSafe: false },
  { level: 12, amount: 125000, isSafe: false },
  { level: 13, amount: 250000, isSafe: false },
  { level: 14, amount: 500000, isSafe: false },
  { level: 15, amount: 1000000, isSafe: true }
]

export const MillionaireGame: React.FC<MillionaireGameProps> = ({
  questions,
  onGameComplete,
  timeLimit = 30,
  participantName,
  participants = [],
  sessionId,
  participantId,
  reactions: _reactions
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [currentWinnings, setCurrentWinnings] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerSubmitted, setAnswerSubmitted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [isWinner, setIsWinner] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(timeLimit)
  const [lifelines, setLifelines] = useState<Lifeline[]>([
    { type: 'fifty_fifty', used: false, name: '50:50', icon: <Target size={16} /> },
    { type: 'phone_friend', used: false, name: 'Phone a Friend', icon: <Phone size={16} /> },
    { type: 'ask_audience', used: false, name: 'Ask the Audience', icon: <Users size={16} /> }
  ])
  const [removedAnswers, setRemovedAnswers] = useState<number[]>([])
  const [audienceResults, setAudienceResults] = useState<number[] | null>(null)
  const [friendAdvice, setFriendAdvice] = useState<string | null>(null)

  // Track answers for Firestore persistence
  const answersRef = useRef<Array<{ questionId: string; selectedAnswer: number; isCorrect: boolean; timeSpent: number }>>([])

  // Theme hook - all colors come from CSS variables
  const { styles, colors } = useGameTheme('millionaire')

  // Sound and visual effects
  const { playSound, playSequence, playAmbientTension } = useGameSounds(true)
  const { applyEffect, triggerScreenEffect, animateScoreCounter } = useVisualEffects()
  const { processGameCompletion } = useAchievements()

  // Refs for visual effects
  const answerButtonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const scoreCounterRef = useRef<HTMLDivElement | null>(null)
  const tensionIntervalRef = useRef<any>(null)

  // Use participants from props, with current user's data updated in real-time
  const engagementParticipants = participants.length > 0
    ? participants.map(p => p.isCurrentUser
        ? { ...p, score: currentWinnings, answered: answerSubmitted }
        : p
      )
    : [{ id: 'current', name: participantName, score: currentWinnings, streak: 0, answered: answerSubmitted, isCurrentUser: true }]

  const currentQuestion = questions[currentQuestionIndex]
  const currentLevel = Math.min(currentQuestionIndex + 1, MONEY_LADDER.length)
  const potentialWinnings = MONEY_LADDER[currentLevel - 1]?.amount || 0

  // Per-question timer - anchor-based (prevents drift)
  // Timer sounds play on presenter only (phones are quiet)
  const questionStartedAtRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!answerSubmitted && !gameOver && timeRemaining > 0) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - questionStartedAtRef.current) / 1000)
        const remaining = Math.max(0, timeLimit - elapsed)

        setTimeRemaining(remaining)

        if (remaining <= 0) {
          handleTimeUp()
        }
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [answerSubmitted, gameOver, timeRemaining])

  // No game start sounds on phone - presenter handles them
  useEffect(() => {
    // Just initialize
  }, [])

  const handleTimeUp = () => {
    // Auto-submit current selection or end game
    if (selectedAnswer !== null) {
      submitAnswer(selectedAnswer, true)
    } else {
      endGame(false)
    }
  }

  const submitAnswer = (answerIndex: number, _autoSubmit = false) => {
    if (answerSubmitted || gameOver) return

    setAnswerSubmitted(true)

    // Stop tension music if playing
    if (tensionIntervalRef.current) {
      clearInterval(tensionIntervalRef.current)
      tensionIntervalRef.current = null
    }

    const isCorrect = answerIndex === currentQuestion.correctAnswer
    const answerButton = answerButtonRefs.current[answerIndex]
    const timeSpent = timeLimit - timeRemaining

    // Track answer for Firestore
    const answerRecord = {
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex,
      isCorrect,
      timeSpent
    }
    answersRef.current = [...answersRef.current, answerRecord]

    // Persist to Firestore (fire-and-forget, don't block UI)
    if (sessionId && participantId) {
      const newScore = isCorrect ? potentialWinnings : currentWinnings
      FirestoreService.updateParticipantGameState(
        sessionId,
        participantId,
        {
          currentQuestionIndex,
          score: newScore,
          streak: isCorrect ? currentQuestionIndex + 1 : 0,
          answers: answersRef.current
        }
      ).catch(err => console.error('Error updating participant game state:', err))
    }

    // Dramatic pause then feedback (phone only gets correct/incorrect sounds)
    setTimeout(() => {
      if (isCorrect) {
        // CORRECT ANSWER
        playSound('correct')
        if (answerButton) {
          applyEffect(answerButton, 'correct-pulse')
        }
        triggerScreenEffect('screen-flash', { color: colors.success })

        // Animate score counter
        if (scoreCounterRef.current) {
          animateScoreCounter(scoreCounterRef.current, currentWinnings, potentialWinnings, 1500)
        }

        // Visual celebration for major milestones (no extra sounds on phone)
        if (currentLevel >= 5) {
          setTimeout(() => {
            triggerScreenEffect('celebration-confetti')
          }, 1000)
        }

        // Check for game completion
        setTimeout(() => {
          const newWinnings = potentialWinnings
          setCurrentWinnings(newWinnings)

          if (currentQuestionIndex + 1 >= questions.length || currentLevel >= MONEY_LADDER.length) {
            // MILLIONAIRE! Winner gets celebration sounds
            setIsWinner(true)
            playSequence([
              { sound: 'fanfare', delay: 0 },
              { sound: 'celebration', delay: 500 },
              { sound: 'achievement', delay: 1000 }
            ])
            triggerScreenEffect('achievement-burst')
            endGame(true)
          } else {
            // Next question
            setTimeout(() => {
              nextQuestion()
            }, 1000)
          }
        }, 2000)

      } else {
        // WRONG ANSWER
        playSound('incorrect')
        if (answerButton) {
          applyEffect(answerButton, 'wrong-shake')
        }
        triggerScreenEffect('screen-flash', { color: colors.error })

        // Show correct answer with glow
        const correctButton = answerButtonRefs.current[currentQuestion.correctAnswer]
        if (correctButton) {
          setTimeout(() => {
            applyEffect(correctButton, 'glow-effect')
          }, 1000)
        }

        setTimeout(() => {
          endGame(false)
        }, 3000)
      }
    }, 1500) // Dramatic pause
  }

  const nextQuestion = () => {
    questionStartedAtRef.current = Date.now()
    setCurrentQuestionIndex(prev => prev + 1)
    setSelectedAnswer(null)
    setAnswerSubmitted(false)
    setTimeRemaining(timeLimit)
    setRemovedAnswers([])
    setAudienceResults(null)
    setFriendAdvice(null)
  }

  const endGame = (won: boolean) => {
    setGameOver(true)

    // Calculate final winnings based on safe levels
    let finalWinnings = won ? currentWinnings : 0
    if (!won && currentWinnings > 0) {
      // Find the highest safe level they reached
      const safeLevels = MONEY_LADDER.filter(l => l.isSafe && l.level <= currentLevel)
      if (safeLevels.length > 0) {
        finalWinnings = safeLevels[safeLevels.length - 1].amount
      }
    }

    // Process achievements
    const gameStats = {
      score: finalWinnings,
      accuracy: (currentLevel / questions.length) * 100,
      timeSpent: (questions.length * timeLimit) - timeRemaining,
      streak: currentLevel, // Number of consecutive correct answers
      questionsAnswered: currentLevel,
      correctAnswers: currentLevel,
      gameType: 'millionaire',
      completedAt: new Date(),
      perfectScore: won && currentLevel === questions.length,
      speedBonus: Math.max(0, timeRemaining * 100)
    }

    processGameCompletion(gameStats)

    // Persist final state and mark completed in Firestore
    if (sessionId && participantId) {
      const totalTime = answersRef.current.reduce((sum, a) => sum + a.timeSpent, 0)
      const correctCount = answersRef.current.filter(a => a.isCorrect).length
      // Use correctCount * 100 as score for consistency with quiz scoring (100 points per correct answer)
      const normalizedScore = correctCount * 100

      FirestoreService.updateParticipantGameState(
        sessionId,
        participantId,
        {
          currentQuestionIndex: currentQuestionIndex,
          score: normalizedScore,
          streak: currentLevel,
          completed: true,
          answers: answersRef.current
        }
      ).catch(err => console.error('Error updating final game state:', err))

      FirestoreService.markParticipantCompleted(
        sessionId,
        participantId,
        normalizedScore,
        totalTime
      ).catch(err => console.error('Error marking participant completed:', err))
    }

    setTimeout(() => {
      onGameComplete(currentLevel, finalWinnings)
    }, 3000)
  }

  const useLifeline = (type: 'fifty_fifty' | 'phone_friend' | 'ask_audience') => {
    if (answerSubmitted || gameOver) return

    setLifelines(prev => prev.map(l =>
      l.type === type ? { ...l, used: true } : l
    ))

    switch (type) {
      case 'fifty_fifty':
        const correctAnswer = currentQuestion.correctAnswer
        const wrongAnswers = [0, 1, 2, 3].filter(i => i !== correctAnswer)
        const toRemove = wrongAnswers.slice(0, 2)
        setRemovedAnswers(toRemove)
        break

      case 'ask_audience':
        // Simulate audience voting with bias toward correct answer
        const results = [0, 0, 0, 0]
        const correctIdx = currentQuestion.correctAnswer

        // Generate realistic audience percentages
        results[correctIdx] = Math.random() * 30 + 40 // 40-70% for correct
        const remaining = 100 - results[correctIdx]

        for (let i = 0; i < 4; i++) {
          if (i !== correctIdx) {
            results[i] = Math.random() * remaining / 3
          }
        }

        // Normalize to 100%
        const total = results.reduce((a, b) => a + b, 0)
        const normalized = results.map(r => Math.round((r / total) * 100))
        setAudienceResults(normalized)
        break

      case 'phone_friend':
        // Simulate friend's advice
        const confidence = Math.random()
        if (confidence > 0.7) {
          const answerLetter = String.fromCharCode(65 + currentQuestion.correctAnswer)
          setFriendAdvice(`I'm pretty confident it's ${answerLetter}. That sounds right to me.`)
        } else if (confidence > 0.4) {
          const answerLetter = String.fromCharCode(65 + currentQuestion.correctAnswer)
          setFriendAdvice(`I think it might be ${answerLetter}, but I'm not completely sure.`)
        } else {
          setFriendAdvice("Hmm, this is tough. I really don't know this one. Sorry!")
        }
        break
    }
  }

  const walkAway = () => {
    endGame(false)
  }

  // Get answer option style based on state
  const getAnswerStyle = (index: number): React.CSSProperties => {
    const isRemoved = removedAnswers.includes(index)
    const isSelected = selectedAnswer === index
    const isCorrect = answerSubmitted && index === currentQuestion.correctAnswer
    const isWrong = answerSubmitted && isSelected && !isCorrect

    if (isRemoved) {
      return {
        ...styles.answerOption,
        opacity: 0.3,
        cursor: 'not-allowed'
      }
    }

    if (isCorrect) {
      return { ...styles.answerOption, ...getCorrectStyle() }
    }

    if (isWrong) {
      return { ...styles.answerOption, ...getIncorrectStyle() }
    }

    if (isSelected && !answerSubmitted) {
      return { ...styles.answerOption, ...getSelectedStyle() }
    }

    return styles.answerOption
  }

  // Get answer indicator style
  const getIndicatorStyle = (index: number): React.CSSProperties => {
    const isRemoved = removedAnswers.includes(index)
    const isSelected = selectedAnswer === index
    const isCorrect = answerSubmitted && index === currentQuestion.correctAnswer
    const isWrong = answerSubmitted && isSelected && !isCorrect

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

    if (isRemoved) {
      return {
        ...baseStyle,
        borderColor: 'var(--border-color)',
        color: 'var(--text-secondary-color)'
      }
    }

    if (isCorrect) {
      return {
        ...baseStyle,
        borderColor: 'var(--success-color)',
        backgroundColor: 'var(--success-color)',
        color: 'var(--text-on-primary-color)'
      }
    }

    if (isWrong) {
      return {
        ...baseStyle,
        borderColor: 'var(--error-color)',
        backgroundColor: 'var(--error-color)',
        color: 'var(--text-on-primary-color)'
      }
    }

    if (isSelected) {
      return {
        ...baseStyle,
        borderColor: 'var(--millionaire-accent)',
        backgroundColor: 'var(--millionaire-accent)',
        color: 'var(--text-color)'
      }
    }

    return {
      ...baseStyle,
      borderColor: 'var(--border-color)',
      color: 'var(--text-secondary-color)'
    }
  }

  if (gameOver) {
    return (
      <div style={styles.container} className="flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div
            className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
            style={{
              backgroundColor: isWinner ? 'var(--millionaire-accent)' : 'var(--error-color)'
            }}
          >
            {isWinner ? <DollarSign size={32} /> : <Heart size={32} />}
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isWinner ? 'CONGRATULATIONS!' : 'Game Over'}
          </h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary-color)' }}>
            {isWinner
              ? "You're a millionaire!"
              : "Thanks for playing!"
            }
          </p>
          <div
            className="p-4 rounded-lg mb-4"
            style={{
              backgroundColor: 'var(--millionaire-accent)',
              color: 'var(--text-color)'
            }}
          >
            <div className="text-2xl font-bold">
              ${currentWinnings.toLocaleString()}
            </div>
            <div className="text-sm">Final Winnings</div>
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              {participantName}
            </div>
            <div className="text-xl font-bold" style={styles.accentText}>
              WHO WANTS TO BE A MILLIONAIRE?
            </div>
            <div className="flex items-center space-x-4">
              <div
                className={`flex items-center space-x-1 transition-all duration-300 ${
                  timeRemaining <= 5 ? 'animate-pulse' : ''
                }`}
                style={{
                  color: timeRemaining <= 5
                    ? 'var(--error-color)'
                    : timeRemaining <= 10
                    ? 'var(--warning-color)'
                    : 'var(--error-color)'
                }}
              >
                <Clock size={16} className={timeRemaining <= 5 ? 'animate-bounce' : ''} />
                <span className={`font-mono text-lg ${timeRemaining <= 10 ? 'font-bold' : ''}`}>
                  {timeRemaining}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Game Area */}
          <div className="lg:col-span-3">
            {/* Question */}
            <div className="rounded-lg p-6 mb-6" style={styles.questionArea}>
              <div className="text-center mb-6">
                <div className="text-sm mb-2" style={styles.accentText}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
                <div
                  ref={scoreCounterRef}
                  className="text-3xl font-bold mb-4 score-counter transition-all duration-300"
                  style={styles.accentText}
                >
                  ${potentialWinnings.toLocaleString()}
                </div>
                <h2 className="text-xl font-semibold">{currentQuestion.questionText}</h2>
              </div>

              {/* Answer Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => {
                  const isRemoved = removedAnswers.includes(index)

                  return (
                    <button
                      key={index}
                      ref={el => { answerButtonRefs.current[index] = el }}
                      onClick={() => {
                        if (!answerSubmitted && !isRemoved) {
                          playSound('click')
                          setSelectedAnswer(index)
                        }
                      }}
                      onMouseEnter={() => !answerSubmitted && playSound('tick')}
                      disabled={answerSubmitted || isRemoved}
                      className="p-4 text-left transition-all duration-500 transform hover:scale-105 answer-option"
                      style={getAnswerStyle(index)}
                    >
                      <div className="flex items-center space-x-3">
                        <div style={getIndicatorStyle(index)}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className="flex-1">{option}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Submit/Walk Away Buttons */}
              {!answerSubmitted && (
                <div className="flex justify-center space-x-4 mt-6">
                  <button
                    onClick={() => selectedAnswer !== null && submitAnswer(selectedAnswer)}
                    disabled={selectedAnswer === null}
                    className="btn-primary px-8 py-3 text-lg font-bold disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--millionaire-accent)',
                      color: 'var(--text-color)'
                    }}
                  >
                    Final Answer
                  </button>
                  {currentWinnings > 0 && (
                    <button
                      onClick={walkAway}
                      className="px-8 py-3 text-lg font-bold border-2 rounded-lg transition-colors"
                      style={{
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-secondary-color)'
                      }}
                    >
                      Walk Away (${currentWinnings.toLocaleString()})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Lifelines */}
            <div className="rounded-lg p-4" style={styles.lifelines}>
              <h3 className="text-lg font-bold mb-4" style={styles.accentText}>Lifelines</h3>
              <div className="flex flex-wrap gap-3">
                {lifelines.map((lifeline) => (
                  <button
                    key={lifeline.type}
                    onClick={() => useLifeline(lifeline.type)}
                    disabled={lifeline.used || answerSubmitted}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: lifeline.used
                        ? 'var(--surface-color)'
                        : 'var(--primary-color)',
                      color: lifeline.used
                        ? 'var(--text-secondary-color)'
                        : 'var(--text-on-primary-color)',
                      opacity: lifeline.used ? 0.5 : 1,
                      cursor: lifeline.used || answerSubmitted ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {lifeline.icon}
                    <span className="text-sm font-medium">{lifeline.name}</span>
                  </button>
                ))}
              </div>

              {/* Lifeline Results */}
              {audienceResults && (
                <div
                  className="mt-4 rounded-lg p-4"
                  style={{ backgroundColor: 'var(--primary-dark-color)' }}
                >
                  <h4 className="font-bold mb-2" style={{ color: 'var(--primary-light-color)' }}>
                    Audience Vote Results:
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {audienceResults.map((percentage, index) => (
                      <div key={index} className="text-center">
                        <div className="text-sm font-bold">{String.fromCharCode(65 + index)}</div>
                        <div
                          className="rounded-full h-2 mb-1"
                          style={{ backgroundColor: 'var(--surface-color)' }}
                        >
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: 'var(--primary-color)'
                            }}
                          />
                        </div>
                        <div className="text-sm">{percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {friendAdvice && (
                <div
                  className="mt-4 rounded-lg p-4"
                  style={{ backgroundColor: 'var(--success-light-color)' }}
                >
                  <h4 className="font-bold mb-2" style={{ color: 'var(--success-color)' }}>
                    Friend's Advice:
                  </h4>
                  <p className="text-sm italic" style={{ color: 'var(--text-color)' }}>
                    "{friendAdvice}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Money Ladder */}
          <div className="lg:col-span-1">
            <div className="rounded-lg p-4 sticky top-8" style={styles.moneyLadder}>
              <h3 className="text-lg font-bold mb-4" style={styles.accentText}>Money Ladder</h3>
              <div className="space-y-1">
                {MONEY_LADDER.slice().reverse().map((level) => {
                  const isCurrent = level.level === currentLevel
                  const isCompleted = level.level < currentLevel

                  const getLevelStyle = (): React.CSSProperties => {
                    if (isCurrent) {
                      return {
                        borderColor: 'var(--millionaire-accent)',
                        backgroundColor: 'color-mix(in srgb, var(--millionaire-accent) 30%, transparent)',
                        color: 'var(--text-on-primary-color)'
                      }
                    }
                    if (isCompleted) {
                      return {
                        borderColor: 'var(--success-color)',
                        backgroundColor: 'var(--success-light-color)',
                        color: 'var(--success-color)'
                      }
                    }
                    if (level.isSafe) {
                      return {
                        borderColor: 'var(--warning-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--warning-color)'
                      }
                    }
                    return {
                      borderColor: 'var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary-color)'
                    }
                  }

                  return (
                    <div
                      key={level.level}
                      className="p-2 rounded text-center border"
                      style={getLevelStyle()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{level.level}</span>
                        <span className="font-bold">${level.amount.toLocaleString()}</span>
                        {level.isSafe && (
                          <AlertTriangle size={14} style={{ color: 'var(--warning-color)' }} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div
                className="mt-4 pt-4"
                style={{ borderTop: '1px solid var(--border-color)' }}
              >
                <div className="text-center">
                  <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
                    Current Winnings
                  </div>
                  <div className="text-xl font-bold" style={styles.accentText}>
                    ${currentWinnings.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
          console.log('Player reacted with:', reaction)
        }}
      />
    </div>
  )
}

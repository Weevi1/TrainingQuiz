import React, { useState, useEffect, useRef } from 'react'
import { Eye, Clock, Target, Award, AlertTriangle } from 'lucide-react'
import { LoadingSpinner } from '../LoadingSpinner'
import { useGameSounds } from '../../lib/soundSystem'
import { useVisualEffects } from '../../lib/visualEffects'
import { useAchievements } from '../../lib/achievementSystem'
import { LiveEngagement } from '../LiveEngagement'
import { useGameTheme } from '../../hooks/useGameTheme'
import { FirestoreService } from '../../lib/firestore'

interface Difference {
  id: string
  type: 'text_change' | 'missing_clause' | 'number_change' | 'date_change' | 'legal_term'
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  explanation: string
  location: {
    section: string
    line?: number
    highlight?: string
  }
}

interface DocumentPair {
  id: string
  title: string
  description: string
  documentType: 'contract' | 'policy' | 'procedure' | 'compliance' | 'safety'
  originalDocument: string
  modifiedDocument: string
  differences: Difference[]
  timeLimit: number
}

interface EngagementParticipant {
  id: string
  name: string
  score: number
  streak: number
  answered: boolean
  isCurrentUser?: boolean
}

interface SpotTheDifferenceGameProps {
  documentPairs: DocumentPair[]
  onGameComplete: (score: number, stats: GameStats) => void
  participantName: string
  participants?: EngagementParticipant[]
  timeLimit: number
  sessionId?: string
  participantId?: string
}

interface GameStats {
  totalDifferences: number
  foundDifferences: number
  missedDifferences: number
  incorrectGuesses: number
  accuracy: number
  timeSpent: number
  avgTimePerDifference: number
  severityBreakdown: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

interface FoundDifference {
  differenceId: string
  timeFound: number
  wasCorrect: boolean
}

export const SpotTheDifferenceGame: React.FC<SpotTheDifferenceGameProps> = ({
  documentPairs,
  onGameComplete,
  participantName,
  participants = [],
  timeLimit,
  sessionId,
  participantId
}) => {
  const [currentPairIndex, setCurrentPairIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(timeLimit)
  const [foundDifferences, setFoundDifferences] = useState<FoundDifference[]>([])
  const [incorrectGuesses, setIncorrectGuesses] = useState(0)
  const [gameComplete, setGameComplete] = useState(false)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [gameStartTime] = useState(Date.now())
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'correct' | 'incorrect' | 'already_found', message: string} | null>(null)

  const scoreCounterRef = useRef<HTMLDivElement>(null)
  const documentContainerRef = useRef<HTMLDivElement>(null)
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Theme hook - all colors come from CSS variables
  const { styles, colors } = useGameTheme('spotDifference')

  const { playSound, playSequence, playAmbientTension } = useGameSounds(true)
  const { applyEffect, triggerScreenEffect, animateScoreCounter } = useVisualEffects()
  const { processGameCompletion } = useAchievements()

  // Use real participants from props, or fallback to current user only
  const engagementParticipants = participants.length > 0
    ? participants.map(p => p.isCurrentUser
        ? { ...p, score, streak: 0, answered: foundDifferences.length > 0 }
        : p
      )
    : [{ id: 'current', name: participantName, score, streak: 0, answered: foundDifferences.length > 0, isCurrentUser: true }]

  const currentPair = documentPairs[currentPairIndex]
  const totalDifferences = documentPairs.reduce((sum, pair) => sum + pair.differences.length, 0)

  // No game start sounds on phone - presenter handles them
  useEffect(() => {
    // Just initialize
  }, [])

  // Timer - anchor-based (prevents drift)
  // Timer sounds play on presenter only (phones are quiet)
  const timerAnchorRef = useRef<number>(Date.now())

  useEffect(() => {
    if (timeRemaining > 0 && !gameComplete) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerAnchorRef.current) / 1000)
        const remaining = Math.max(0, (timeLimit || 300) - elapsed)

        setTimeRemaining(remaining)

        if (remaining <= 0) {
          endGame()
        }
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [timeRemaining, gameComplete])

  // Check if current document is complete
  useEffect(() => {
    if (currentPair) {
      const currentPairFound = foundDifferences.filter(fd =>
        currentPair.differences.some(diff => diff.id === fd.differenceId)
      )

      if (currentPairFound.length === currentPair.differences.length) {
        // All differences found in current document
        triggerScreenEffect('celebration-confetti')
        setTimeout(() => {
          nextDocument()
        }, 2000)
      }
    }
  }, [foundDifferences, currentPair])

  const handleTextSelection = (text: string, _documentSide: 'original' | 'modified') => {
    if (gameComplete) return

    setSelectedText(text)

    // Check if this text corresponds to a difference
    const difference = currentPair.differences.find(diff =>
      diff.location.highlight === text ||
      diff.description.toLowerCase().includes(text.toLowerCase())
    )

    if (difference && !foundDifferences.some(fd => fd.differenceId === difference.id)) {
      // Correct difference found!
      const points = getDifferencePoints(difference.severity)

      setScore(prev => {
        const newScore = prev + points
        // Animate score counter
        if (scoreCounterRef.current) {
          animateScoreCounter(scoreCounterRef.current, prev, newScore)
        }
        return newScore
      })

      setFoundDifferences(prev => {
        const newFound = [...prev, {
          differenceId: difference.id,
          timeFound: Date.now() - gameStartTime,
          wasCorrect: true
        }]
        // Persist progress to Firestore
        if (sessionId && participantId) {
          const newScore = score + points
          const firestoreAnswers = newFound.map(fd => ({
            questionId: fd.differenceId,
            selectedAnswer: fd.wasCorrect ? 1 : 0,
            isCorrect: fd.wasCorrect,
            timeSpent: Math.round(fd.timeFound / 1000)
          }))
          FirestoreService.updateParticipantGameState(
            sessionId, participantId,
            { currentQuestionIndex: currentPairIndex, score: newScore, streak: newFound.length, answers: firestoreAnswers }
          ).catch(err => console.error('Error updating participant game state:', err))
        }
        return newFound
      })

      // Phone only gets correct/incorrect sounds
      playSound('correct')
      if (difference.severity === 'critical') {
        triggerScreenEffect('screen-flash', { color: colors.success })
      }

      if (documentContainerRef.current) {
        applyEffect(documentContainerRef.current, 'correct-pulse')
      }

      showFeedback('correct', difference.explanation)
    } else if (difference && foundDifferences.some(fd => fd.differenceId === difference.id)) {
      // Already found this difference
      showFeedback('already_found', 'You already found this difference!')
    } else {
      // Incorrect guess
      setIncorrectGuesses(prev => prev + 1)
      setScore(prev => {
        const newScore = Math.max(0, prev - 10)
        if (scoreCounterRef.current) {
          animateScoreCounter(scoreCounterRef.current, prev, newScore)
        }
        return newScore
      })

      playSound('incorrect')
      if (documentContainerRef.current) {
        applyEffect(documentContainerRef.current, 'wrong-shake')
      }
      triggerScreenEffect('screen-flash', { color: colors.error })

      showFeedback('incorrect', 'That\'s not a difference. Keep looking!')
    }
  }

  const getDifferencePoints = (severity: string): number => {
    switch (severity) {
      case 'critical': return 100
      case 'high': return 75
      case 'medium': return 50
      case 'low': return 25
      default: return 25
    }
  }

  const showFeedback = (type: 'correct' | 'incorrect' | 'already_found', message: string) => {
    setFeedbackMessage({ type, message })

    // Clear existing timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current)
    }

    // Auto-hide feedback after 3 seconds
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackMessage(null)
    }, 3000)
  }

  const nextDocument = () => {
    if (currentPairIndex + 1 >= documentPairs.length) {
      endGame()
      return
    }

    setCurrentPairIndex(prev => prev + 1)
    setSelectedText(null)
    setFeedbackMessage(null) // Clear any existing feedback
  }

  const endGame = () => {
    setGameComplete(true)

    // Game end sounds play on presenter only
    // Visual celebration still shows on phone
    triggerScreenEffect('celebration-confetti')

    const timeSpent = (Date.now() - gameStartTime) / 1000
    const correctFinds = foundDifferences.filter(fd => fd.wasCorrect).length

    const severityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    foundDifferences.forEach(fd => {
      const diff = documentPairs.flatMap(dp => dp.differences).find(d => d.id === fd.differenceId)
      if (diff) {
        severityBreakdown[diff.severity]++
      }
    })

    const stats: GameStats = {
      totalDifferences,
      foundDifferences: correctFinds,
      missedDifferences: totalDifferences - correctFinds,
      incorrectGuesses,
      accuracy: totalDifferences > 0 ? (correctFinds / totalDifferences) * 100 : 0,
      timeSpent,
      avgTimePerDifference: correctFinds > 0 ? timeSpent / correctFinds : 0,
      severityBreakdown
    }

    // Process achievements
    const gameStatsForAchievements = {
      score,
      accuracy: stats.accuracy,
      timeSpent,
      streak: 0, // Not applicable for this game
      questionsAnswered: totalDifferences,
      correctAnswers: correctFinds,
      gameType: 'spotdifference',
      completedAt: new Date(),
      perfectScore: correctFinds === totalDifferences && incorrectGuesses === 0,
      speedBonus: Math.max(0, (timeLimit - timeSpent) * 5)
    }

    processGameCompletion(gameStatsForAchievements)

    // Persist final state and mark completed in Firestore
    if (sessionId && participantId) {
      const normalizedScore = correctFinds * 100
      const firestoreAnswers = foundDifferences.map(fd => ({
        questionId: fd.differenceId,
        selectedAnswer: fd.wasCorrect ? 1 : 0,
        isCorrect: fd.wasCorrect,
        timeSpent: Math.round(fd.timeFound / 1000)
      }))

      FirestoreService.updateParticipantGameState(
        sessionId, participantId,
        { currentQuestionIndex: currentPairIndex, score: normalizedScore, streak: correctFinds, completed: true, answers: firestoreAnswers }
      ).catch(err => console.error('Error updating final game state:', err))

      FirestoreService.markParticipantCompleted(
        sessionId, participantId, normalizedScore, Math.round(timeSpent)
      ).catch(err => console.error('Error marking participant completed:', err))
    }

    setTimeout(() => {
      onGameComplete(score, stats)
    }, 3000)
  }

  const renderDocumentWithHighlights = (document: string, side: 'original' | 'modified') => {
    // Split document into lines for easier processing
    const lines = document.split('\n')

    return (
      <div className="space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="leading-relaxed">
            {renderLineWithClickableText(line, side)}
          </div>
        ))}
      </div>
    )
  }

  const renderLineWithClickableText = (line: string, side: 'original' | 'modified') => {
    // Split line into words and make them clickable
    const words = line.split(' ')

    return (
      <span>
        {words.map((word, wordIndex) => {
          const isFound = currentPair.differences.some(diff =>
            foundDifferences.some(fd => fd.differenceId === diff.id) &&
            (diff.location.highlight === word || diff.description.toLowerCase().includes(word.toLowerCase()))
          )

          const getWordStyle = (): React.CSSProperties => {
            if (isFound) {
              return { ...styles.wordFound, padding: '2px 4px', borderRadius: '4px' }
            }
            if (selectedText === word) {
              return {
                backgroundColor: 'var(--primary-light-color)',
                borderRadius: '4px',
                padding: '2px 4px'
              }
            }
            return {
              cursor: 'pointer',
              borderRadius: '4px',
              padding: '2px 4px',
              transition: 'background-color 0.2s'
            }
          }

          return (
            <span key={wordIndex}>
              <span
                onClick={() => handleTextSelection(word, side)}
                className="touch-feedback"
                style={getWordStyle()}
                onMouseEnter={(e) => {
                  if (!isFound) {
                    (e.target as HTMLElement).style.backgroundColor = 'var(--spotdiff-highlight)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFound && selectedText !== word) {
                    (e.target as HTMLElement).style.backgroundColor = 'transparent'
                  }
                }}
              >
                {word}
              </span>
              {wordIndex < words.length - 1 && ' '}
            </span>
          )
        })}
      </span>
    )
  }

  // Get feedback style based on type
  const getFeedbackStyle = (): React.CSSProperties => {
    if (!feedbackMessage) return {}

    switch (feedbackMessage.type) {
      case 'correct':
        return styles.feedbackCorrect
      case 'incorrect':
        return styles.feedbackIncorrect
      default:
        return {
          backgroundColor: 'var(--warning-light-color)',
          borderColor: 'var(--warning-color)',
          color: 'var(--warning-color)',
          borderRadius: 'var(--border-radius)'
        }
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
            <Award style={{ color: 'var(--text-on-primary-color)' }} size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2">Investigation Complete!</h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary-color)' }}>
            Great detective work!
          </p>

          <div
            className="rounded-lg p-4 mb-4"
            style={{ backgroundColor: 'var(--surface-color)' }}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-2xl font-bold" style={styles.accentText}>{score}</div>
                <div>Final Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>
                  {foundDifferences.filter(fd => fd.wasCorrect).length}/{totalDifferences}
                </div>
                <div>Found/Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary-light-color)' }}>
                  {Math.round(((foundDifferences.filter(fd => fd.wasCorrect).length) / Math.max(totalDifferences, 1)) * 100)}%
                </div>
                <div>Accuracy</div>
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--celebration-color)' }}>{incorrectGuesses}</div>
                <div>Wrong Guesses</div>
              </div>
            </div>
          </div>

          <LoadingSpinner size="sm" />
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary-color)' }}>
            Preparing your detailed report...
          </p>
        </div>
      </div>
    )
  }

  if (!currentPair) {
    return (
      <div style={styles.container} className="flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4" size={48} style={{ color: 'var(--warning-color)' }} />
          <p style={{ color: 'var(--text-secondary-color)' }}>No documents available for review</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Eye style={{ color: 'var(--primary-color)' }} size={24} />
              <div>
                <h1 className="text-lg font-bold" style={{ color: 'var(--primary-color)' }}>Document Detective</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>{participantName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Target size={16} />
                <span>{foundDifferences.filter(fd => fd.wasCorrect).length}/{totalDifferences}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Award size={16} />
                <span ref={scoreCounterRef} className="score-counter">{score}</span>
              </div>
              <div
                className="flex items-center space-x-2"
                style={{ color: timeRemaining <= 30 ? 'var(--error-color)' : 'var(--text-color)' }}
              >
                <Clock size={16} />
                <span className="font-mono">
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Document Info */}
        <div
          className="rounded-lg p-4 mb-6"
          style={{
            backgroundColor: 'var(--primary-light-color)',
            border: '1px solid var(--primary-color)'
          }}
        >
          <div className="flex items-start space-x-3">
            <div
              className="rounded-full p-2"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              <Eye style={{ color: 'var(--text-on-primary-color)' }} size={16} />
            </div>
            <div className="flex-1">
              <h3 className="font-medium mb-1" style={{ color: 'var(--primary-dark-color)' }}>
                {currentPair.title}
              </h3>
              <p className="text-sm mb-2" style={{ color: 'var(--primary-color)' }}>
                {currentPair.description}
              </p>
              <div className="flex items-center space-x-4 text-sm" style={{ color: 'var(--primary-color)' }}>
                <span>Document {currentPairIndex + 1} of {documentPairs.length}</span>
                <span>-</span>
                <span>{currentPair.differences.length} differences to find</span>
                <span>-</span>
                <span className="capitalize">{currentPair.documentType} document</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {feedbackMessage && (
          <div
            className="mb-6 p-4 text-center enhance-celebration border"
            style={getFeedbackStyle()}
          >
            <p className="font-medium">{feedbackMessage.message}</p>
          </div>
        )}

        {/* Document Comparison */}
        <div ref={documentContainerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Original Document */}
          <div className="card" style={styles.documentPanel}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--success-color)' }}>
                ✓ Original Document
              </h3>
              <span className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
                Reference Version
              </span>
            </div>
            <div
              className="rounded-lg p-4 max-h-96 overflow-y-auto"
              style={{ backgroundColor: 'var(--surface-color)' }}
            >
              <div className="font-mono text-base leading-relaxed" style={{ color: 'var(--text-color)' }}>
                {renderDocumentWithHighlights(currentPair.originalDocument, 'original')}
              </div>
            </div>
          </div>

          {/* Modified Document */}
          <div className="card" style={styles.documentPanel}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--error-color)' }}>
                ⚠ Modified Document
              </h3>
              <span className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
                Review Version
              </span>
            </div>
            <div
              className="rounded-lg p-4 max-h-96 overflow-y-auto"
              style={{ backgroundColor: 'var(--surface-color)' }}
            >
              <div className="font-mono text-base leading-relaxed" style={{ color: 'var(--text-color)' }}>
                {renderDocumentWithHighlights(currentPair.modifiedDocument, 'modified')}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div
          className="mt-6 rounded-lg p-4 border"
          style={{
            backgroundColor: 'var(--warning-light-color)',
            borderColor: 'var(--warning-color)'
          }}
        >
          <h4 className="font-medium mb-2" style={{ color: 'var(--warning-color)' }}>
            Instructions:
          </h4>
          <ul className="text-sm space-y-1" style={{ color: 'var(--text-color)' }}>
            <li>• Click on any word or phrase that looks different between the documents</li>
            <li>• Found differences will be highlighted in green</li>
            <li>• Critical differences are worth more points</li>
            <li>• Wrong guesses will reduce your score</li>
            <li>• Find all differences before time runs out!</li>
          </ul>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2" style={{ color: 'var(--text-secondary-color)' }}>
            <span>Overall Progress</span>
            <span>{foundDifferences.filter(fd => fd.wasCorrect).length} of {totalDifferences} found</span>
          </div>
          <div
            className="w-full rounded-full h-2"
            style={{ backgroundColor: 'var(--border-color)' }}
          >
            <div
              className="h-2 rounded-full transition-all"
              style={{
                ...styles.progressBar,
                width: `${((foundDifferences.filter(fd => fd.wasCorrect).length) / Math.max(totalDifferences, 1)) * 100}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Live Engagement Component */}
      <LiveEngagement
        participants={engagementParticipants}
        currentQuestion={currentPairIndex + 1}
        totalQuestions={documentPairs.length}
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

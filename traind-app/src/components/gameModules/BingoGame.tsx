import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { CheckCircle, Star, Trophy, Grid, Zap, X } from 'lucide-react'
import { LoadingSpinner } from '../LoadingSpinner'
import { useGameSounds } from '../../lib/soundSystem'
import { useVisualEffects } from '../../lib/visualEffects'
import { useAchievements } from '../../lib/achievementSystem'
import { LiveEngagement } from '../LiveEngagement'
import { SoundControl } from '../SoundControl'
import { useGameTheme } from '../../hooks/useGameTheme'
import { FirestoreService, type Question, type OrganizationBranding } from '../../lib/firestore'
import { ReactionOverlay } from '../ReactionOverlay'

interface BingoItem {
  id: string
  text: string
  category?: string
  points?: number
}

// Rich game state passed to onGameComplete
export interface BingoGameState {
  gameType: 'bingo'
  score: number
  cellsMarked: number
  totalCells: number
  linesCompleted: number
  fullCardAchieved: boolean
  bestStreak: number
  timeToFirstBingo: number | null
  timeSpent: number
  winCondition: string
  gameWon: boolean
  markedCellKeys: string[]
}

interface EngagementParticipant {
  id: string
  name: string
  score: number
  streak: number
  answered: boolean
  isCurrentUser?: boolean
}

interface BingoGameProps {
  items: BingoItem[]
  questions?: Question[]
  cardSize?: 3 | 4 | 5
  onGameComplete: (score: number, bingoGameState: BingoGameState) => void
  onKicked?: () => void
  participantName: string
  participants?: EngagementParticipant[]
  timeLimit?: number
  winCondition?: 'line' | 'full_card' | 'corners' | 'any_pattern'
  sessionId?: string
  participantId?: string
  reactions?: OrganizationBranding['reactions']
}

interface CellState {
  row: number
  col: number
  marked: boolean
  item: BingoItem | null
}

const BINGO_PATTERNS = {
  line: 'Complete any row, column, or diagonal',
  full_card: 'Mark all squares on your card',
  corners: 'Mark all four corners',
  any_pattern: 'Complete any valid bingo pattern'
}

const CELEBRATION_MESSAGES = [
  "BINGO! Outstanding!",
  "Fantastic! You got BINGO!",
  "Excellent work! BINGO!",
  "Way to go! BINGO achieved!",
  "Superb! That's a BINGO!"
]

// Session recovery key
const BINGO_RECOVERY_KEY = (sessionId: string, participantId: string) =>
  `bingo_recovery_${sessionId}_${participantId}`
const RECOVERY_TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours

export const BingoGame: React.FC<BingoGameProps> = ({
  items,
  questions,
  cardSize = 5,
  onGameComplete,
  onKicked,
  participantName,
  participants = [],
  timeLimit,
  winCondition = 'line',
  sessionId,
  participantId,
  reactions
}) => {
  const [bingoCard, setBingoCard] = useState<CellState[][]>([])
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set())
  const [completedLines, setCompletedLines] = useState<number>(0)
  const [gameWon, setGameWon] = useState(false)
  const [gameComplete, setGameComplete] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0)
  const [lastMarkedCell, setLastMarkedCell] = useState<{row: number, col: number} | null>(null)
  const [celebrationMessage, setCelebrationMessage] = useState('')

  // Challenge question state
  const [challengeCell, setChallengeCell] = useState<{ row: number, col: number } | null>(null)
  const [challengeResult, setChallengeResult] = useState<'correct' | 'incorrect' | null>(null)

  // Map bingo item IDs to full quiz questions for verification challenges
  const questionMap = useMemo(() => {
    const map = new Map<string, Question>()
    if (questions) {
      questions.forEach(q => map.set(q.id, q))
    }
    return map
  }, [questions])
  const hasQuestions = questionMap.size > 0

  const scoreCounterRef = useRef<HTMLDivElement>(null)
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[][]>(Array(cardSize).fill(null).map(() => Array(cardSize).fill(null)))

  // Tracking refs
  const maxStreakRef = useRef(0)
  const firstBingoTimeRef = useRef<number | null>(null)
  const startTimeRef = useRef(Date.now())
  const firestoreDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const recoveryDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const completedLinesRef = useRef(0)
  const gameCompleteRef = useRef(false)

  // Theme hook - all colors come from CSS variables
  const { styles, colors } = useGameTheme('bingo')

  const { playSound, playSequence, playAmbientTension } = useGameSounds(true)
  const { applyEffect, triggerScreenEffect, animateScoreCounter } = useVisualEffects()
  const { processGameCompletion } = useAchievements()

  // Use real participants from props, or fallback to current user only
  const engagementParticipants = participants.length > 0
    ? participants.map(p => p.isCurrentUser
        ? { ...p, score, streak, answered: markedCells.size > 0 }
        : p
      )
    : [{ id: 'current', name: participantName, score, streak, answered: markedCells.size > 0, isCurrentUser: true }]

  // Calculate rank from participants
  const currentRank = (() => {
    if (participants.length <= 1) return null
    const sorted = [...participants].map(p =>
      p.isCurrentUser ? { ...p, score } : p
    ).sort((a, b) => b.score - a.score)
    const idx = sorted.findIndex(p => p.isCurrentUser)
    return idx >= 0 ? idx + 1 : null
  })()

  const totalCells = cardSize * cardSize

  // Initialize bingo card (with session recovery)
  useEffect(() => {
    // Try session recovery first
    if (sessionId && participantId) {
      const recoveryKey = BINGO_RECOVERY_KEY(sessionId, participantId)
      const saved = localStorage.getItem(recoveryKey)
      if (saved) {
        try {
          const recovery = JSON.parse(saved)
          const age = Date.now() - recovery.timestamp
          if (age < RECOVERY_TIMEOUT_MS && recovery.cardSize === cardSize) {
            // Restore saved state
            setBingoCard(recovery.bingoCard)
            setMarkedCells(new Set(recovery.markedCellKeys))
            setScore(recovery.score)
            setStreak(recovery.streak)
            maxStreakRef.current = recovery.bestStreak || 0
            firstBingoTimeRef.current = recovery.firstBingoTime
            startTimeRef.current = recovery.startTime || Date.now()
            if (recovery.timeRemaining !== undefined && timeLimit) {
              setTimeRemaining(recovery.timeRemaining)
            }
            if (recovery.completedLines !== undefined) {
              setCompletedLines(recovery.completedLines)
              completedLinesRef.current = recovery.completedLines
            }
            if (recovery.gameWon) {
              setGameWon(true)
            }
            return
          } else {
            localStorage.removeItem(recoveryKey)
          }
        } catch {
          localStorage.removeItem(recoveryKey)
        }
      }
    }

    generateBingoCard()
  }, [items, cardSize])

  // Game start - no sounds on phone (presenter handles game start sounds)
  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [])

  // Timer effect - anchor-based calculation (syncs with presenter, no drift)
  // Timer sounds play on presenter only (phones are quiet)
  const timerAnchorRef = useRef<number>(0)
  const timerPausedRef = useRef(false)
  const pausedRemainingRef = useRef(0)

  useEffect(() => {
    if (timeLimit && timeRemaining > 0 && !gameComplete) {
      const timer = setInterval(() => {
        // If presenter paused, hold current time
        if (timerPausedRef.current) {
          setTimeRemaining(pausedRemainingRef.current)
          return
        }

        // If we have an anchor, calculate from it (prevents drift)
        if (timerAnchorRef.current > 0) {
          const elapsed = Math.floor((Date.now() - timerAnchorRef.current) / 1000)
          const remaining = Math.max(0, (timeLimit || 0) - elapsed)

          if (remaining <= 0) {
            endGame()
            setTimeRemaining(0)
            return
          }
          setTimeRemaining(remaining)
        } else {
          // Fallback: decrement (before anchor arrives from Firestore)
          setTimeRemaining(prev => {
            if (prev <= 1) {
              endGame()
              return 0
            }
            return prev - 1
          })
        }
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [timeRemaining, gameComplete, timeLimit])

  // Session sync: timer anchor, pause/resume, and session end detection
  useEffect(() => {
    if (!sessionId || gameCompleteRef.current) return

    const unsubscribe = FirestoreService.subscribeToSession(
      sessionId,
      (updatedSession) => {
        if (!updatedSession || gameCompleteRef.current) return

        // Sync timer anchor from presenter (one-time or on resume)
        if (updatedSession.timerStartedAt && updatedSession.sessionTimeLimit) {
          timerAnchorRef.current = updatedSession.timerStartedAt
        }

        // Sync timer pause/resume from presenter
        if (updatedSession.timerPaused && !timerPausedRef.current) {
          timerPausedRef.current = true
          if (timerAnchorRef.current > 0) {
            const elapsed = Math.floor((Date.now() - timerAnchorRef.current) / 1000)
            pausedRemainingRef.current = Math.max(0, (timeLimit || 0) - elapsed)
          } else {
            pausedRemainingRef.current = updatedSession.pausedTimeRemaining || timeRemaining
          }
        } else if (!updatedSession.timerPaused && timerPausedRef.current) {
          timerPausedRef.current = false
          // Anchor updated by presenter on resume
          if (updatedSession.timerStartedAt) {
            timerAnchorRef.current = updatedSession.timerStartedAt
          }
        }

        // Check if session ended by trainer
        if (updatedSession.status === 'completed' && !gameCompleteRef.current) {
          endGame()
        }
      }
    )

    return () => unsubscribe()
  }, [sessionId])

  // Kick detection
  useEffect(() => {
    if (!sessionId || !participantId) return

    const unsubscribe = FirestoreService.subscribeToParticipant(
      sessionId,
      participantId,
      (exists) => {
        if (!exists) {
          // Clean up recovery data
          localStorage.removeItem(BINGO_RECOVERY_KEY(sessionId, participantId))
          onKicked?.()
        }
      }
    )

    return () => unsubscribe()
  }, [sessionId, participantId, onKicked])

  // Check for wins after each mark
  useEffect(() => {
    if (bingoCard.length > 0) {
      checkForWins()
    }
  }, [markedCells])

  // Cleanup debounce timers
  useEffect(() => {
    return () => {
      if (firestoreDebounceRef.current) clearTimeout(firestoreDebounceRef.current)
      if (recoveryDebounceRef.current) clearTimeout(recoveryDebounceRef.current)
    }
  }, [])

  const generateBingoCard = () => {
    const shuffledItems = [...items].sort(() => Math.random() - 0.5)
    const gridSize = cardSize
    const centerCell = Math.floor(gridSize / 2)

    const grid: CellState[][] = []

    for (let row = 0; row < gridSize; row++) {
      const rowCells: CellState[] = []
      for (let col = 0; col < gridSize; col++) {
        const cellIndex = row * gridSize + col
        const isCenterFree = gridSize === 5 && row === centerCell && col === centerCell

        rowCells.push({
          row,
          col,
          marked: isCenterFree,
          item: isCenterFree ? { id: 'free', text: 'FREE', category: 'free' } : shuffledItems[cellIndex] || null
        })
      }
      grid.push(rowCells)
    }

    setBingoCard(grid)

    // Mark center cell as already completed for 5x5 cards
    if (gridSize === 5) {
      setMarkedCells(new Set([`${centerCell}-${centerCell}`]))
    }
  }

  // Save session recovery data (debounced)
  const saveRecoveryData = useCallback(() => {
    if (!sessionId || !participantId || gameCompleteRef.current) return

    if (recoveryDebounceRef.current) clearTimeout(recoveryDebounceRef.current)
    recoveryDebounceRef.current = setTimeout(() => {
      const recoveryKey = BINGO_RECOVERY_KEY(sessionId, participantId)
      const data = {
        bingoCard,
        markedCellKeys: Array.from(markedCells),
        score,
        streak,
        bestStreak: maxStreakRef.current,
        firstBingoTime: firstBingoTimeRef.current,
        startTime: startTimeRef.current,
        timeRemaining,
        completedLines: completedLinesRef.current,
        gameWon,
        cardSize,
        timestamp: Date.now()
      }
      localStorage.setItem(recoveryKey, JSON.stringify(data))
    }, 500)
  }, [sessionId, participantId, bingoCard, markedCells, score, streak, timeRemaining, gameWon, cardSize])

  // Persist game state to Firestore (debounced)
  const persistGameState = useCallback(() => {
    if (!sessionId || !participantId || gameCompleteRef.current) return

    if (firestoreDebounceRef.current) clearTimeout(firestoreDebounceRef.current)
    firestoreDebounceRef.current = setTimeout(() => {
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000)
      FirestoreService.updateParticipantGameState(
        sessionId,
        participantId,
        {
          currentQuestionIndex: 0,
          score,
          streak,
          answers: [],
          gameType: 'bingo',
          cellsMarked: markedCells.size,
          totalCells,
          linesCompleted: completedLinesRef.current,
          fullCardAchieved: markedCells.size === totalCells,
          bestStreak: maxStreakRef.current,
          timeSpent,
          gameWon,
          markedCellKeys: Array.from(markedCells),
          timeToFirstBingo: firstBingoTimeRef.current,
          winCondition
        }
      ).catch(err => console.error('Error persisting bingo state:', err))
    }, 2000)
  }, [sessionId, participantId, score, streak, markedCells, totalCells, gameWon, winCondition])

  // Core marking logic — called directly (no quiz) or after correct challenge answer
  const markCell = useCallback((row: number, col: number) => {
    const cellKey = `${row}-${col}`
    const cell = bingoCard[row]?.[col]
    if (!cell) return

    const newMarkedCells = new Set(markedCells)
    newMarkedCells.add(cellKey)

    const newStreak = streak + 1
    setStreak(newStreak)
    if (newStreak > maxStreakRef.current) {
      maxStreakRef.current = newStreak
    }

    const pointsEarned = cell.item?.points || 10
    setScore(prev => {
      const newScore = prev + pointsEarned
      if (scoreCounterRef.current) {
        animateScoreCounter(scoreCounterRef.current, prev, newScore)
      }
      return newScore
    })
    setLastMarkedCell({ row, col })

    playSound('correct')
    const cellElement = cellRefs.current[row]?.[col]
    if (cellElement) {
      applyEffect(cellElement, 'correct-pulse')
      if (newStreak >= 5) {
        applyEffect(cellElement, 'streak-fire')
      }
    }
    if (newStreak >= 5) {
      triggerScreenEffect('screen-flash', { color: colors.success })
    }

    setMarkedCells(newMarkedCells)

    const updatedCard = bingoCard.map(cardRow =>
      cardRow.map(cardCell => ({
        ...cardCell,
        marked: cardCell.row === row && cardCell.col === col
          ? true
          : newMarkedCells.has(`${cardCell.row}-${cardCell.col}`)
      }))
    )
    setBingoCard(updatedCard)

    setTimeout(() => {
      persistGameState()
      saveRecoveryData()
    }, 0)
  }, [bingoCard, markedCells, streak, playSound, applyEffect, triggerScreenEffect, colors.success, animateScoreCounter, persistGameState, saveRecoveryData])

  const toggleCell = (row: number, col: number) => {
    if (gameComplete || !bingoCard[row] || !bingoCard[row][col]) return

    const cellKey = `${row}-${col}`
    const cell = bingoCard[row][col]

    // Can't unmark free space
    if (cell.item?.category === 'free') return

    if (markedCells.has(cellKey)) {
      // Unmarking cell — no question needed
      const newMarkedCells = new Set(markedCells)
      newMarkedCells.delete(cellKey)
      setStreak(0)

      const cellElement = cellRefs.current[row]?.[col]
      if (cellElement) {
        applyEffect(cellElement, 'wrong-shake')
      }

      setMarkedCells(newMarkedCells)

      const updatedCard = bingoCard.map(cardRow =>
        cardRow.map(cardCell => ({
          ...cardCell,
          marked: cardCell.row === row && cardCell.col === col
            ? false
            : newMarkedCells.has(`${cardCell.row}-${cardCell.col}`)
        }))
      )
      setBingoCard(updatedCard)

      setTimeout(() => {
        persistGameState()
        saveRecoveryData()
      }, 0)
    } else {
      // Marking cell — show challenge question if available
      const question = cell.item ? questionMap.get(cell.item.id) : undefined
      if (question) {
        setChallengeCell({ row, col })
        setChallengeResult(null)
      } else {
        // No quiz question — mark directly (fallback for default items)
        markCell(row, col)
      }
    }
  }

  const handleChallengeAnswer = useCallback((selectedIndex: number) => {
    if (!challengeCell) return
    const cell = bingoCard[challengeCell.row]?.[challengeCell.col]
    if (!cell?.item) return

    const question = questionMap.get(cell.item.id)
    if (!question) return

    if (selectedIndex === question.correctAnswer) {
      setChallengeResult('correct')
      setTimeout(() => {
        markCell(challengeCell.row, challengeCell.col)
        setChallengeCell(null)
        setChallengeResult(null)
      }, 800)
    } else {
      setChallengeResult('incorrect')
      playSound('incorrect')
      setTimeout(() => {
        setChallengeCell(null)
        setChallengeResult(null)
      }, 1000)
    }
  }, [challengeCell, bingoCard, questionMap, markCell, playSound])

  const checkForWins = () => {
    if (gameComplete) return

    const gridSize = cardSize
    let lineCount = 0

    // Check rows
    for (let row = 0; row < gridSize; row++) {
      const rowComplete = Array.from({ length: gridSize }, (_, col) =>
        markedCells.has(`${row}-${col}`)
      ).every(Boolean)
      if (rowComplete) lineCount++
    }

    // Check columns
    for (let col = 0; col < gridSize; col++) {
      const colComplete = Array.from({ length: gridSize }, (_, row) =>
        markedCells.has(`${row}-${col}`)
      ).every(Boolean)
      if (colComplete) lineCount++
    }

    // Check diagonals
    const diagonal1Complete = Array.from({ length: gridSize }, (_, i) =>
      markedCells.has(`${i}-${i}`)
    ).every(Boolean)
    if (diagonal1Complete) lineCount++

    const diagonal2Complete = Array.from({ length: gridSize }, (_, i) =>
      markedCells.has(`${i}-${gridSize - 1 - i}`)
    ).every(Boolean)
    if (diagonal2Complete) lineCount++

    // Check corners (for corner win condition)
    const cornersComplete = [
      markedCells.has('0-0'),
      markedCells.has(`0-${gridSize - 1}`),
      markedCells.has(`${gridSize - 1}-0`),
      markedCells.has(`${gridSize - 1}-${gridSize - 1}`)
    ].every(Boolean)

    // Check full card
    const allCellsMarked = Array.from({ length: gridSize }, (_, row) =>
      Array.from({ length: gridSize }, (_, col) =>
        markedCells.has(`${row}-${col}`)
      ).every(Boolean)
    ).every(Boolean)

    setCompletedLines(lineCount)
    completedLinesRef.current = lineCount

    // Determine if game is won based on win condition
    let hasWon = false
    if (winCondition === 'line' && lineCount > 0) {
      hasWon = true
    } else if (winCondition === 'full_card' && allCellsMarked) {
      hasWon = true
    } else if (winCondition === 'corners' && cornersComplete) {
      hasWon = true
    } else if (winCondition === 'any_pattern' && (lineCount > 0 || cornersComplete)) {
      hasWon = true
    }

    if (hasWon && !gameWon) {
      setGameWon(true)

      // Record time to first bingo
      if (!firstBingoTimeRef.current) {
        firstBingoTimeRef.current = Math.round((Date.now() - startTimeRef.current) / 1000)
      }

      setCelebrationMessage(CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)])

      // Enhanced celebration effects
      playSound('fanfare')
      setTimeout(() => {
        playSound('achievement')
      }, 500)

      triggerScreenEffect('celebration-confetti')
      if (cardContainerRef.current) {
        applyEffect(cardContainerRef.current, 'glow-effect')
      }

      // End game after celebration
      setTimeout(() => {
        endGame()
      }, 3000)
    }
  }


  const endGame = () => {
    if (gameCompleteRef.current) return
    gameCompleteRef.current = true
    setGameComplete(true)

    // Game end sound plays on presenter only

    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000)

    // Process achievements
    const gameStats = {
      score,
      accuracy: (markedCells.size / totalCells) * 100,
      timeSpent,
      streak: maxStreakRef.current,
      questionsAnswered: markedCells.size,
      correctAnswers: markedCells.size,
      gameType: 'bingo',
      completedAt: new Date(),
      perfectScore: gameWon && (winCondition === 'full_card' ? markedCells.size === totalCells : true),
      speedBonus: timeLimit ? Math.max(0, timeRemaining * 5) : 0
    }

    processGameCompletion(gameStats)

    // Build rich game state
    const bingoGameState: BingoGameState = {
      gameType: 'bingo',
      score,
      cellsMarked: markedCells.size,
      totalCells,
      linesCompleted: completedLinesRef.current,
      fullCardAchieved: markedCells.size === totalCells,
      bestStreak: maxStreakRef.current,
      timeToFirstBingo: firstBingoTimeRef.current,
      timeSpent,
      winCondition,
      gameWon,
      markedCellKeys: Array.from(markedCells)
    }

    // Mark participant completed in Firestore
    if (sessionId && participantId) {
      FirestoreService.updateParticipantGameState(
        sessionId,
        participantId,
        {
          currentQuestionIndex: 0,
          score,
          streak: maxStreakRef.current,
          completed: true,
          answers: [],
          gameType: 'bingo',
          cellsMarked: markedCells.size,
          totalCells,
          linesCompleted: completedLinesRef.current,
          fullCardAchieved: markedCells.size === totalCells,
          bestStreak: maxStreakRef.current,
          timeSpent,
          gameWon,
          markedCellKeys: Array.from(markedCells),
          timeToFirstBingo: firstBingoTimeRef.current,
          winCondition
        }
      ).catch(err => console.error('Error persisting final bingo state:', err))

      FirestoreService.markParticipantCompleted(
        sessionId,
        participantId,
        score,
        timeSpent
      ).catch(err => console.error('Error marking participant completed:', err))

      // Clear recovery data
      localStorage.removeItem(BINGO_RECOVERY_KEY(sessionId, participantId))
    }

    setTimeout(() => {
      onGameComplete(score, bingoGameState)
    }, 2000)
  }

  // Get cell style based on state
  const getCellStyle = (cell: CellState): React.CSSProperties => {
    const isFree = cell.item?.category === 'free'
    const isMarked = markedCells.has(`${cell.row}-${cell.col}`)
    const isLastMarked = lastMarkedCell?.row === cell.row && lastMarkedCell?.col === cell.col

    if (isFree) {
      return styles.cellFree
    }

    if (isMarked) {
      return {
        ...styles.cellMarked,
        ...(isLastMarked ? { transform: 'scale(1.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' } : {})
      }
    }

    return styles.cell
  }

  if (gameComplete) {
    return (
      <div
        className="min-h-screen relative overflow-hidden flex items-center justify-center"
        style={{
          background: gameWon
            ? 'linear-gradient(to bottom right, var(--primary-dark-color, #1e3a8a), var(--secondary-color, #1e40af), var(--celebration-color, #7c3aed))'
            : 'linear-gradient(to bottom right, var(--primary-color), var(--secondary-color))'
        }}
      >
        {/* Celebration backdrop */}
        {gameWon && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-30 animate-pulse" style={{ backgroundColor: 'var(--accent-color, #fbbf24)' }} />
              <div className="absolute top-20 right-20 w-24 h-24 rounded-full opacity-40 animate-pulse" style={{ backgroundColor: 'var(--success-color)', animationDelay: '0.5s' }} />
              <div className="absolute bottom-20 left-20 w-28 h-28 rounded-full opacity-35 animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '1s' }} />
              <div className="absolute bottom-10 right-10 w-36 h-36 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: 'var(--celebration-color, #ec4899)', animationDelay: '1.5s' }} />
            </div>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-20 left-1/2 text-4xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎉</div>
              <div className="absolute top-1/3 left-10 text-3xl animate-bounce" style={{ animationDelay: '0.8s' }}>🎯</div>
              <div className="absolute bottom-1/4 right-10 text-4xl animate-bounce" style={{ animationDelay: '1.2s' }}>⭐</div>
              <div className="absolute top-1/4 right-1/4 text-2xl animate-bounce" style={{ animationDelay: '1.8s' }}>🎊</div>
            </div>
          </>
        )}

        <div
          className="p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: gameWon ? 'var(--accent-color, #fbbf24)' : 'var(--primary-color)' }}
        >
          <div className="mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
              style={{
                background: gameWon
                  ? 'linear-gradient(135deg, var(--accent-color, #fbbf24), var(--celebration-color, #f59e0b))'
                  : 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                border: gameWon ? '4px solid var(--accent-color, #fbbf24)' : '4px solid var(--primary-color)'
              }}
            >
              <Trophy style={{ color: 'white' }} size={36} />
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-color)' }}>
              {gameWon ? 'BINGO ACHIEVED!' : 'Game Complete!'}
            </h1>
            <p style={{ color: 'var(--text-secondary-color)' }}>
              Great job playing Training Bingo!
            </p>
          </div>

          <div
            className="rounded-xl p-4 mb-6"
            style={{ backgroundColor: 'var(--surface-color)' }}
          >
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-light-color)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{score}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>Total Score</div>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-light-color)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>{completedLinesRef.current}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>Lines</div>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--streak-color, #f97316)' }}>{markedCells.size}/{totalCells}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>Cells Marked</div>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--warning-light-color)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--warning-color)' }}>{maxStreakRef.current} 🔥</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>Best Streak</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <LoadingSpinner size="sm" />
            <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              Preparing your results...
            </p>
          </div>
        </div>
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
              {currentRank && (
                <span
                  className="ml-2 px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    backgroundColor: currentRank <= 3 ? 'var(--gold-color, #fbbf24)' : 'rgba(255,255,255,0.2)',
                    color: currentRank <= 3 ? '#000' : 'var(--text-on-primary-color, white)'
                  }}
                >
                  #{currentRank}
                </span>
              )}
            </div>
            <div className="text-xl font-bold" style={styles.accentText}>
              TRAINING BINGO
            </div>
            <div className="flex items-center space-x-4">
              {timeLimit && (
                <div
                  className={`flex items-center space-x-1 px-2 py-1 rounded ${timeRemaining <= 30 ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: timeRemaining <= 30 ? 'var(--error-color)' : 'transparent',
                    color: timeRemaining <= 30 ? 'white' : undefined,
                    ...(timeRemaining > 30 ? styles.accentText : {})
                  }}
                >
                  <span className="font-mono">{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Game Info */}
        <div
          className="rounded-lg p-4 mb-6"
          style={{ backgroundColor: 'var(--surface-color)' }}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div
                  ref={scoreCounterRef}
                  className="text-2xl font-bold score-counter"
                  style={styles.accentText}
                >
                  {score}
                </div>
                <div className="text-sm">Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>
                  {completedLines}
                </div>
                <div className="text-sm">Lines</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--primary-light-color)' }}>
                  {streak}
                </div>
                <div className="text-sm">Streak</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold" style={{ color: 'var(--text-secondary-color)' }}>
                  {markedCells.size}/{totalCells}
                </div>
                <div className="text-sm">Marked</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm mb-1" style={{ color: 'var(--text-secondary-color)' }}>
                Goal: {BINGO_PATTERNS[winCondition]}
              </div>
              <div
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: gameWon ? 'var(--success-color)' : 'var(--surface-color)',
                  color: gameWon ? 'var(--text-on-primary-color)' : 'var(--text-secondary-color)'
                }}
              >
                {gameWon ? <CheckCircle size={16} className="mr-1" /> : <Grid size={16} className="mr-1" />}
                {gameWon ? 'BINGO!' : 'In Progress'}
              </div>
            </div>
          </div>
        </div>

        {/* Celebration Banner */}
        {gameWon && celebrationMessage && (
          <div
            className="rounded-lg p-4 mb-6 text-center enhance-celebration"
            style={styles.winBanner}
          >
            <div className="flex items-center justify-center space-x-2">
              <Star className="animate-spin" size={24} />
              <span className="text-xl font-bold">{celebrationMessage}</span>
              <Star className="animate-spin" size={24} />
            </div>
          </div>
        )}

        {/* Bingo Card */}
        <div ref={cardContainerRef} className="rounded-lg p-6" style={styles.card}>
          <div
            className={`grid gap-2 mx-auto max-w-md ${
              cardSize === 3 ? 'grid-cols-3' :
              cardSize === 4 ? 'grid-cols-4' :
              'grid-cols-5'
            }`}
          >
            {bingoCard.flat().map((cell) => {
              const isMarked = markedCells.has(`${cell.row}-${cell.col}`)
              const isFree = cell.item?.category === 'free'
              const isLastMarked = lastMarkedCell?.row === cell.row && lastMarkedCell?.col === cell.col

              return (
                <button
                  key={`${cell.row}-${cell.col}`}
                  ref={el => {
                    if (!cellRefs.current[cell.row]) cellRefs.current[cell.row] = []
                    cellRefs.current[cell.row][cell.col] = el
                  }}
                  onClick={() => toggleCell(cell.row, cell.col)}
                  disabled={gameComplete || isFree}
                  className={`
                    aspect-square p-2 text-sm font-medium transition-all duration-300
                    flex items-center justify-center text-center leading-tight touch-feedback
                    min-h-[48px]
                    ${isLastMarked ? 'animate-pulse' : ''}
                  `}
                  style={{
                    ...getCellStyle(cell),
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <div className="relative w-full h-full flex items-center justify-center">
                    {isMarked && !isFree && (
                      <CheckCircle
                        size={16}
                        className="absolute top-0 right-0 transform translate-x-1 -translate-y-1"
                        style={{ color: 'var(--text-on-primary-color)' }}
                      />
                    )}
                    <span className={`${isMarked ? 'line-through' : ''} ${isFree ? 'text-lg font-bold' : ''}`}>
                      {cell.item?.text || ''}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Instructions */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              {hasQuestions
                ? 'Tap a square and answer the question correctly to mark it.'
                : 'Tap the squares as you complete each training activity.'}
              {winCondition === 'line' && " Get a line to win!"}
              {winCondition === 'full_card' && " Mark all squares to win!"}
              {winCondition === 'corners' && " Mark all four corners to win!"}
              {winCondition === 'any_pattern' && " Complete any pattern to win!"}
            </p>
          </div>
        </div>

        {/* Power-ups or special features could go here */}
        {streak >= 5 && (
          <div className="mt-4 rounded-lg p-3 text-center enhance-streak" style={styles.streakBanner}>
            <div className="flex items-center justify-center space-x-2">
              <Zap className="animate-bounce" size={20} />
              <span className="font-bold">Hot Streak! {streak} in a row!</span>
              <Zap className="animate-bounce" size={20} />
            </div>
          </div>
        )}
      </div>

      {/* Challenge Question Modal */}
      {challengeCell && (() => {
        const cell = bingoCard[challengeCell.row]?.[challengeCell.col]
        const question = cell?.item ? questionMap.get(cell.item.id) : undefined
        if (!question) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--surface-color, #1e293b)' }}>
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ backgroundColor: 'var(--primary-color)' }}>
                <span className="text-sm font-medium"
                  style={{ color: 'var(--text-on-primary-color, white)' }}>
                  Answer to mark this square
                </span>
                <button onClick={() => { setChallengeCell(null); setChallengeResult(null) }}
                  className="p-1 rounded-full hover:opacity-80"
                  style={{ color: 'var(--text-on-primary-color, white)' }}>
                  <X size={20} />
                </button>
              </div>
              {/* Question */}
              <div className="px-5 py-4">
                <p className="text-lg font-semibold mb-4" style={{ color: 'var(--text-color, white)' }}>
                  {question.questionText}
                </p>
                {/* Options */}
                <div className="space-y-3">
                  {question.options.map((option, idx) => {
                    const isCorrectReveal = challengeResult === 'correct' && idx === question.correctAnswer
                    const isWrongReveal = challengeResult === 'incorrect' && idx === question.correctAnswer
                    const isSelected = challengeResult === 'incorrect' && idx !== question.correctAnswer

                    let optionBg = 'var(--primary-light-color, rgba(59,130,246,0.15))'
                    let optionBorder = 'transparent'
                    if (isCorrectReveal || isWrongReveal) {
                      optionBg = 'rgba(34,197,94,0.2)'
                      optionBorder = 'var(--success-color, #22c55e)'
                    } else if (isSelected) {
                      // Don't highlight wrong selections — only show the correct one
                      optionBg = 'var(--primary-light-color, rgba(59,130,246,0.15))'
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => !challengeResult && handleChallengeAnswer(idx)}
                        disabled={!!challengeResult}
                        className="w-full text-left px-4 py-3 rounded-xl transition-all duration-200 border-2"
                        style={{
                          backgroundColor: optionBg,
                          borderColor: optionBorder,
                          color: 'var(--text-color, white)',
                          opacity: challengeResult ? 0.8 : 1
                        }}
                      >
                        <span className="font-medium mr-2" style={{ color: 'var(--primary-color)' }}>
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        {option}
                      </button>
                    )
                  })}
                </div>
                {/* Feedback */}
                {challengeResult && (
                  <div className="mt-4 text-center py-2 rounded-lg font-bold text-lg"
                    style={{
                      backgroundColor: challengeResult === 'correct'
                        ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                      color: challengeResult === 'correct'
                        ? 'var(--success-color, #22c55e)' : 'var(--error-color, #ef4444)'
                    }}>
                    {challengeResult === 'correct' ? 'Correct!' : 'Incorrect — try again later'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Live Engagement Component */}
      <LiveEngagement
        participants={engagementParticipants}
        currentQuestion={1}
        totalQuestions={1}
        showProgress={false}
        showLeaderboard={true}
        showParticipantCount={true}
        showAnswerProgress={false}
        onReaction={() => {}}
      />

      {/* Floating Sound Control */}
      <SoundControl position="bottom-right" minimal={true} />
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, Star, Trophy, Grid, Zap, Volume2, VolumeX } from 'lucide-react'
import { LoadingSpinner } from '../LoadingSpinner'
import { useGameSounds } from '../../lib/soundSystem'
import { useVisualEffects } from '../../lib/visualEffects'
import { useAchievements } from '../../lib/achievementSystem'
import { LiveEngagement } from '../LiveEngagement'
import { useGameTheme } from '../../hooks/useGameTheme'

interface BingoItem {
  id: string
  text: string
  category?: string
  points?: number
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
  cardSize?: 3 | 4 | 5
  onGameComplete: (score: number, completedLines: number, completedCard: boolean) => void
  participantName: string
  participants?: EngagementParticipant[]
  timeLimit?: number
  winCondition?: 'line' | 'full_card' | 'corners' | 'any_pattern'
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

export const BingoGame: React.FC<BingoGameProps> = ({
  items,
  cardSize = 5,
  onGameComplete,
  participantName,
  participants = [],
  timeLimit,
  winCondition = 'line'
}) => {
  const [bingoCard, setBingoCard] = useState<CellState[][]>([])
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set())
  const [completedLines, setCompletedLines] = useState<number[]>([])
  const [gameWon, setGameWon] = useState(false)
  const [gameComplete, setGameComplete] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [lastMarkedCell, setLastMarkedCell] = useState<{row: number, col: number} | null>(null)
  const [celebrationMessage, setCelebrationMessage] = useState('')

  const scoreCounterRef = useRef<HTMLDivElement>(null)
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[][]>(Array(cardSize).fill(null).map(() => Array(cardSize).fill(null)))

  // Theme hook - all colors come from CSS variables
  const { styles, colors } = useGameTheme('bingo')

  const { playSound, playSequence } = useGameSounds(true)
  const { applyEffect, triggerScreenEffect, animateScoreCounter } = useVisualEffects()
  const { processGameCompletion } = useAchievements()

  // Use real participants from props, or fallback to current user only
  const engagementParticipants = participants.length > 0
    ? participants.map(p => p.isCurrentUser
        ? { ...p, score, streak, answered: markedCells.size > 0 }
        : p
      )
    : [{ id: 'current', name: participantName, score, streak, answered: markedCells.size > 0, isCurrentUser: true }]

  // Initialize bingo card
  useEffect(() => {
    generateBingoCard()
  }, [items, cardSize])

  // Game start sound effect
  useEffect(() => {
    playSound('gameStart')
    playSequence([{ sound: 'ding', delay: 0 }, { sound: 'tick', delay: 100 }])
  }, [])

  // Timer effect
  useEffect(() => {
    if (timeLimit && timeRemaining > 0 && !gameComplete) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === 31) {
            playSound('timeWarning')
          }
          if (prev === 11) {
            playSound('tension')
          }
          if (prev <= 1) {
            playSound('buzz')
            endGame()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [timeRemaining, gameComplete, timeLimit])

  // Check for wins after each mark
  useEffect(() => {
    checkForWins()
  }, [markedCells])

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
          marked: isCenterFree, // Free space in center for 5x5
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

  const toggleCell = (row: number, col: number) => {
    if (gameComplete || !bingoCard[row] || !bingoCard[row][col]) return

    const cellKey = `${row}-${col}`
    const cell = bingoCard[row][col]

    // Can't unmark free space
    if (cell.item?.category === 'free') return

    const newMarkedCells = new Set(markedCells)
    const cellElement = cellRefs.current[row]?.[col]

    if (newMarkedCells.has(cellKey)) {
      // Unmarking cell
      newMarkedCells.delete(cellKey)
      setStreak(0)
      playSound('click')

      if (cellElement) {
        applyEffect(cellElement, 'wrong-shake')
      }
    } else {
      // Marking cell
      newMarkedCells.add(cellKey)
      const newStreak = streak + 1
      setStreak(newStreak)

      const pointsEarned = cell.item?.points || 10
      setScore(prev => {
        const newScore = prev + pointsEarned
        // Animate score counter
        if (scoreCounterRef.current) {
          animateScoreCounter(scoreCounterRef.current, prev, newScore)
        }
        return newScore
      })
      setLastMarkedCell({ row, col })

      // Play sound and visual effects
      if (soundEnabled) {
        playSound('correct')
        if (newStreak >= 5) {
          playSound('streak')
        }
      }

      if (cellElement) {
        applyEffect(cellElement, 'correct-pulse')
        if (newStreak >= 5) {
          applyEffect(cellElement, 'streak-fire')
        }
      }

      // Screen effects for streaks
      if (newStreak >= 5) {
        triggerScreenEffect('screen-flash', { color: colors.success })
      }
    }

    setMarkedCells(newMarkedCells)

    // Update the card state
    const updatedCard = bingoCard.map(cardRow =>
      cardRow.map(cardCell => ({
        ...cardCell,
        marked: cardCell.row === row && cardCell.col === col
          ? newMarkedCells.has(cellKey)
          : newMarkedCells.has(`${cardCell.row}-${cardCell.col}`)
      }))
    )

    setBingoCard(updatedCard)
  }

  const checkForWins = () => {
    if (gameComplete) return

    const gridSize = cardSize
    const lines: number[][] = []

    // Check rows
    for (let row = 0; row < gridSize; row++) {
      const rowComplete = Array.from({ length: gridSize }, (_, col) =>
        markedCells.has(`${row}-${col}`)
      ).every(Boolean)

      if (rowComplete) {
        lines.push([row * gridSize + 0, row * gridSize + gridSize - 1])
      }
    }

    // Check columns
    for (let col = 0; col < gridSize; col++) {
      const colComplete = Array.from({ length: gridSize }, (_, row) =>
        markedCells.has(`${row}-${col}`)
      ).every(Boolean)

      if (colComplete) {
        lines.push([col, (gridSize - 1) * gridSize + col])
      }
    }

    // Check diagonals
    const diagonal1Complete = Array.from({ length: gridSize }, (_, i) =>
      markedCells.has(`${i}-${i}`)
    ).every(Boolean)

    if (diagonal1Complete) {
      lines.push([0, gridSize * gridSize - 1])
    }

    const diagonal2Complete = Array.from({ length: gridSize }, (_, i) =>
      markedCells.has(`${i}-${gridSize - 1 - i}`)
    ).every(Boolean)

    if (diagonal2Complete) {
      lines.push([gridSize - 1, (gridSize - 1) * gridSize])
    }

    // Check corners (for corner win condition)
    const cornersComplete = winCondition === 'corners' && [
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

    setCompletedLines(lines.map(() => lines.length - 1))

    // Determine if game is won based on win condition
    let hasWon = false
    if (winCondition === 'line' && lines.length > 0) {
      hasWon = true
    } else if (winCondition === 'full_card' && allCellsMarked) {
      hasWon = true
    } else if (winCondition === 'corners' && cornersComplete) {
      hasWon = true
    } else if (winCondition === 'any_pattern' && (lines.length > 0 || cornersComplete)) {
      hasWon = true
    }

    if (hasWon && !gameWon) {
      setGameWon(true)
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

      // Continue playing even after first bingo (unless full card required)
      if (winCondition === 'full_card' || winCondition === 'line') {
        setTimeout(() => {
          endGame()
        }, 3000)
      }
    }
  }


  const endGame = () => {
    setGameComplete(true)

    // Play game end sound
    playSound('gameEnd')

    // Process achievements
    const gameStats = {
      score,
      accuracy: (markedCells.size / (cardSize * cardSize)) * 100,
      timeSpent: timeLimit ? (timeLimit - timeRemaining) : 0,
      streak,
      questionsAnswered: markedCells.size,
      correctAnswers: markedCells.size,
      gameType: 'bingo',
      completedAt: new Date(),
      perfectScore: gameWon && (winCondition === 'full_card' ? markedCells.size === cardSize * cardSize : true),
      speedBonus: timeLimit ? Math.max(0, timeRemaining * 5) : 0
    }

    processGameCompletion(gameStats)

    setTimeout(() => {
      onGameComplete(score, completedLines.length, markedCells.size === cardSize * cardSize)
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
      <div style={styles.container} className="flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div
            className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--bingo-win-highlight)' }}
          >
            <Trophy style={{ color: 'var(--text-on-primary-color)' }} size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {gameWon ? 'BINGO ACHIEVED!' : 'Game Complete!'}
          </h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary-color)' }}>
            Great job playing Training Bingo!
          </p>

          <div
            className="rounded-lg p-4 mb-4"
            style={{ backgroundColor: 'var(--surface-color)' }}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-bold">{score}</div>
                <div>Total Score</div>
              </div>
              <div>
                <div className="font-bold">{completedLines.length}</div>
                <div>Lines Completed</div>
              </div>
              <div>
                <div className="font-bold">{markedCells.size}</div>
                <div>Squares Marked</div>
              </div>
              <div>
                <div className="font-bold">{streak}</div>
                <div>Best Streak</div>
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

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
              {participantName}
            </div>
            <div className="text-xl font-bold" style={styles.accentText}>
              TRAINING BINGO
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 transition-colors"
                style={{ color: 'var(--text-secondary-color)' }}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              {timeLimit && (
                <div className="flex items-center space-x-1" style={styles.accentText}>
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
                  {completedLines.length}
                </div>
                <div className="text-sm">Lines</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--primary-light-color)' }}>
                  {streak}
                </div>
                <div className="text-sm">Streak</div>
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
                    aspect-square p-2 text-xs font-medium transition-all duration-300
                    flex items-center justify-center text-center leading-tight touch-feedback
                    ${isLastMarked ? 'animate-pulse' : ''}
                  `}
                  style={getCellStyle(cell)}
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
              Tap the squares as you complete each training activity.
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

      {/* Live Engagement Component */}
      <LiveEngagement
        participants={engagementParticipants}
        currentQuestion={1} // Bingo is ongoing, not question-based
        totalQuestions={1}
        showProgress={false} // Don't show question progress for Bingo
        showLeaderboard={true}
        showParticipantCount={true}
        showAnswerProgress={false} // Not applicable for Bingo
        onReaction={(reaction) => {
          playSound('click')
          console.log('Player reacted with:', reaction)
        }}
      />
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Trophy, Star, Zap, Target, Clock, CheckCircle, XCircle, Award, TrendingUp, Crown, Medal, Users, Grid } from 'lucide-react'
import { FirestoreService, type Organization, type Participant } from '../lib/firestore'
import { useGameSounds } from '../lib/soundSystem'
import { useVisualEffects } from '../lib/visualEffects'
import { SoundControl } from '../components/SoundControl'
import { downloadCertificate } from '../lib/certificate'
import { applyOrganizationBranding } from '../lib/applyBranding'
import type { BingoGameState } from '../components/gameModules/BingoGame'

interface ResultsState {
  participantName: string
  gameType?: string
  gameState: {
    score: number
    streak: number
    answers: Array<{
      questionId: string
      selectedAnswer: number
      isCorrect: boolean
      timeSpent: number
    }>
    totalQuestions: number
  } | BingoGameState
  quiz: {
    title: string
    questions: Array<{
      id: string
      questionText: string
      options: string[]
      correctAnswer: number
      explanation?: string
    }>
    settings: {
      passingScore: number
    }
  }
  sessionCode: string
  organizationId?: string
  // Leaderboard data
  allParticipants?: Participant[]
  participantId?: string
}

export const ParticipantResults: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const resultsState = location.state as ResultsState
  const soundsPlayedRef = useRef(false)
  const [organization, setOrganization] = useState<Organization | null>(null)

  // Sound and visual effects hooks
  const { playSound, playSequence } = useGameSounds(true)
  const { triggerScreenEffect } = useVisualEffects()

  // Determine if this is a bingo game
  const isBingo = resultsState?.gameType === 'bingo' ||
    (resultsState?.gameState as any)?.gameType === 'bingo'

  // Load organization branding on mount
  useEffect(() => {
    const loadBranding = async () => {
      if (resultsState?.organizationId) {
        try {
          const org = await FirestoreService.getOrganization(resultsState.organizationId)
          if (org) {
            setOrganization(org)
            if (org.branding) {
              applyOrganizationBranding(org.branding)
            }
          }
        } catch (error) {
          console.error('Error loading organization branding:', error)
        }
      }
    }
    loadBranding()
  }, [resultsState?.organizationId])

  // Play celebration sounds only for award-winning participants (80%+ or bingo winners)
  // Other phones stay quiet - main sounds come through the presenter
  useEffect(() => {
    if (!resultsState || soundsPlayedRef.current) return

    soundsPlayedRef.current = true

    if (isBingo) {
      const bingoState = resultsState.gameState as BingoGameState

      if (bingoState.gameWon) {
        setTimeout(() => {
          playSequence([
            { sound: 'fanfare', delay: 0 },
            { sound: 'celebration', delay: 500 },
            { sound: 'achievement', delay: 1000 }
          ])
          triggerScreenEffect('celebration-confetti')
        }, 500)
      }
      // Non-winners: no sound
    } else {
      const quizState = resultsState.gameState as { answers: any[]; totalQuestions: number }
      const correctAnswers = quizState.answers.filter(a => a.isCorrect).length
      const percentage = Math.round((correctAnswers / quizState.totalQuestions) * 100)

      if (percentage >= 90) {
        setTimeout(() => {
          playSequence([
            { sound: 'fanfare', delay: 0 },
            { sound: 'celebration', delay: 500 },
            { sound: 'achievement', delay: 1000 }
          ])
          triggerScreenEffect('celebration-confetti')
        }, 500)
      } else if (percentage >= 80) {
        setTimeout(() => {
          playSequence([
            { sound: 'fanfare', delay: 0 },
            { sound: 'celebration', delay: 600 }
          ])
          triggerScreenEffect('screen-flash', { color: 'var(--success-color)' })
        }, 500)
      }
      // Below 80%: no sound - main celebration comes through presenter
    }
  }, [resultsState])

  if (!resultsState) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--secondary-color))' }}
      >
        <div className="text-center p-8 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}>
          <p className="text-text-secondary mb-4">No results available</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // Render bingo or quiz results
  if (isBingo) {
    return <BingoResults resultsState={resultsState} navigate={navigate} playSound={playSound} organization={organization} />
  }

  return <QuizResults resultsState={resultsState} navigate={navigate} playSound={playSound} organization={organization} />
}

// ==================== BINGO RESULTS ====================

const BingoResults: React.FC<{
  resultsState: ResultsState
  navigate: ReturnType<typeof useNavigate>
  playSound: (sound: string) => void
  organization: Organization | null
}> = ({ resultsState, navigate, playSound, organization }) => {
  const { participantName, quiz, sessionCode } = resultsState
  const bingoState = resultsState.gameState as BingoGameState

  const cellsMarked = bingoState.cellsMarked
  const totalCells = bingoState.totalCells
  const percentage = Math.round((cellsMarked / totalCells) * 100)
  const passed = bingoState.gameWon

  // Format time
  const formatTime = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  // Performance analysis
  const getPerformanceLevel = () => {
    if (passed && bingoState.fullCardAchieved) return {
      level: 'Outstanding',
      emoji: '🏆',
      style: { color: 'var(--success-color)', backgroundColor: 'var(--success-light-color)' }
    }
    if (passed) return {
      level: 'Excellent',
      emoji: '🌟',
      style: { color: 'var(--primary-color)', backgroundColor: 'var(--primary-light-color)' }
    }
    if (percentage >= 80) return {
      level: 'Good',
      emoji: '👍',
      style: { color: 'var(--secondary-color)', backgroundColor: 'var(--secondary-light-color)' }
    }
    if (percentage >= 50) return {
      level: 'Fair',
      emoji: '📚',
      style: { color: 'var(--warning-color)', backgroundColor: 'var(--warning-light-color)' }
    }
    return {
      level: 'Keep Going',
      emoji: '💪',
      style: { color: 'var(--error-color)', backgroundColor: 'var(--error-light-color)' }
    }
  }

  const performance = getPerformanceLevel()

  // Bingo-native achievements
  const getBingoAchievements = () => {
    const achievements: Array<{ name: string; emoji: string; style: React.CSSProperties; description: string }> = []

    if (passed) {
      achievements.push({
        name: 'BINGO!',
        emoji: '🎯',
        style: { color: 'var(--celebration-color, #fbbf24)', backgroundColor: 'rgba(251, 191, 36, 0.2)' },
        description: 'Won the game!'
      })
    }
    if (bingoState.fullCardAchieved) {
      achievements.push({
        name: 'Full Card',
        emoji: '🏆',
        style: { color: 'var(--success-color)', backgroundColor: 'var(--success-light-color)' },
        description: 'Marked every cell'
      })
    }
    if (bingoState.timeToFirstBingo && bingoState.timeToFirstBingo < 120) {
      achievements.push({
        name: 'Speed Bingo',
        emoji: '⚡',
        style: { color: 'var(--primary-color)', backgroundColor: 'var(--primary-light-color)' },
        description: `BINGO in ${formatTime(bingoState.timeToFirstBingo)}`
      })
    }
    if (bingoState.bestStreak >= 5) {
      achievements.push({
        name: 'Streak Star',
        emoji: '🔥',
        style: { color: 'var(--streak-color, #f97316)', backgroundColor: 'rgba(249, 115, 22, 0.2)' },
        description: `${bingoState.bestStreak} consecutive marks`
      })
    }
    if (percentage >= 80 && !bingoState.fullCardAchieved) {
      achievements.push({
        name: 'Completionist',
        emoji: '✅',
        style: { color: 'var(--secondary-color)', backgroundColor: 'var(--secondary-light-color)' },
        description: `${percentage}% of cells marked`
      })
    }

    return achievements
  }

  const achievements = getBingoAchievements()

  // Build mini bingo card from markedCellKeys
  const gridSize = Math.round(Math.sqrt(totalCells))
  const markedSet = new Set(bingoState.markedCellKeys || [])

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--secondary-color), var(--primary-color))' }}
    >
      {/* Floating celebration elements for wins */}
      {passed && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>🎉</div>
          <div className="absolute top-20 right-20 text-3xl animate-bounce" style={{ animationDelay: '0.5s' }}>🎯</div>
          <div className="absolute bottom-40 left-20 text-4xl animate-bounce" style={{ animationDelay: '1s' }}>🎊</div>
          <div className="absolute bottom-20 right-10 text-3xl animate-bounce" style={{ animationDelay: '1.5s' }}>⭐</div>
        </div>
      )}

      {/* Header */}
      <header
        className="shadow-lg"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <div className="flex items-center space-x-2">
              <Grid size={24} style={{ color: 'var(--accent-color, #fbbf24)' }} />
              <h1 className="text-xl font-bold" style={{ color: 'white' }}>Bingo Results</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Results Card */}
        <div
          className="rounded-2xl shadow-2xl border-2 p-6 mb-6 text-center"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: 'var(--accent-color, #fbbf24)',
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* Hero Section */}
          <div className="mb-6">
            {/* Big Score Display */}
            <div
              className="w-32 h-32 rounded-full flex flex-col items-center justify-center mx-auto mb-4 shadow-lg"
              style={{
                background: passed
                  ? 'linear-gradient(135deg, var(--success-color), var(--success-light-color))'
                  : 'linear-gradient(135deg, var(--warning-color), var(--warning-light-color))',
                border: '4px solid var(--accent-color, #fbbf24)'
              }}
            >
              <span className="text-4xl font-bold" style={{ color: 'white' }}>{bingoState.score}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Points</span>
            </div>

            {/* Congratulations Message */}
            <div className="mb-4">
              <span className="text-4xl">{performance.emoji}</span>
              <h2 className="text-2xl font-bold mt-2" style={{ color: 'var(--text-color)' }}>
                {passed ? 'BINGO!' : 'Good Effort!'}
              </h2>
              {passed && bingoState.fullCardAchieved && <span className="text-2xl ml-2">👑</span>}
            </div>

            <p className="text-text-secondary mb-4">
              {participantName}, here are your bingo results for <strong>"{quiz.title}"</strong>
            </p>

            {/* Performance Badge */}
            <div
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-full text-lg font-semibold shadow-md"
              style={performance.style}
            >
              <span className="text-xl">{performance.emoji}</span>
              <span>{performance.level}</span>
            </div>
          </div>

          {/* Stats Grid - Bingo Native */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--success-light-color, #dcfce7)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--success-color, #16a34a)' }}>
                {bingoState.linesCompleted}
              </div>
              <div className="text-sm text-text-secondary flex items-center justify-center space-x-1">
                <Target size={14} style={{ color: 'var(--success-color)' }} />
                <span>Lines</span>
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--primary-light-color, #dbeafe)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
                {cellsMarked}/{totalCells}
              </div>
              <div className="text-sm text-text-secondary flex items-center justify-center space-x-1">
                <CheckCircle size={14} style={{ color: 'var(--primary-color)' }} />
                <span>Cells</span>
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--streak-color, #f97316)' }}>
                {bingoState.bestStreak} 🔥
              </div>
              <div className="text-sm text-text-secondary">Best Streak</div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--warning-light-color, #fef3c7)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--warning-color)' }}>
                {formatTime(bingoState.timeToFirstBingo)}
              </div>
              <div className="text-sm text-text-secondary">Time to BINGO</div>
            </div>
          </div>

          {/* Inline Achievement Badges */}
          {achievements.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {achievements.map((achievement, index) => (
                <span
                  key={index}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: achievement.style.backgroundColor,
                    color: achievement.style.color as string
                  }}
                >
                  <span>{achievement.emoji}</span>
                  <span>{achievement.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard Section */}
        <LeaderboardSection resultsState={resultsState} />

        {/* Mini Bingo Card Display */}
        <details
          className="rounded-2xl shadow-xl border mb-6 overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: 'var(--border-color)'
          }}
        >
          <summary className="p-4 cursor-pointer font-bold flex items-center space-x-2 hover:bg-gray-50">
            <span className="text-xl">🎯</span>
            <span>Your Bingo Card ({cellsMarked}/{totalCells} marked, {bingoState.linesCompleted} lines)</span>
          </summary>
          <div className="p-4 pt-0">
            <div
              className={`grid gap-1 mx-auto max-w-xs ${
                gridSize === 3 ? 'grid-cols-3' :
                gridSize === 4 ? 'grid-cols-4' :
                'grid-cols-5'
              }`}
            >
              {Array.from({ length: totalCells }, (_, idx) => {
                const row = Math.floor(idx / gridSize)
                const col = idx % gridSize
                const cellKey = `${row}-${col}`
                const isMarked = markedSet.has(cellKey)
                const isFree = gridSize === 5 && row === 2 && col === 2

                return (
                  <div
                    key={cellKey}
                    className="aspect-square rounded flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: isFree
                        ? 'var(--accent-color, #fbbf24)'
                        : isMarked
                        ? 'var(--success-color)'
                        : 'var(--surface-color)',
                      color: isFree || isMarked ? 'white' : 'var(--text-secondary-color)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {isFree ? 'FREE' : isMarked ? '✓' : ''}
                  </div>
                )
              })}
            </div>
            <p className="text-sm text-center mt-3" style={{ color: 'var(--text-secondary-color)' }}>
              {bingoState.linesCompleted > 0 && `${bingoState.linesCompleted} line${bingoState.linesCompleted !== 1 ? 's' : ''} completed. `}
              {cellsMarked}/{totalCells} cells marked.
              {passed ? ' BINGO achieved!' : ''}
            </p>
          </div>
        </details>

        {/* Actions */}
        <div className="space-y-3 pb-6">
          <button
            onClick={() => {
              const resultsText = `
${quiz.title} - Bingo Results for ${participantName}

${performance.emoji} Score: ${bingoState.score} points
Cells Marked: ${cellsMarked}/${totalCells}
Lines Completed: ${bingoState.linesCompleted}
🔥 Best Streak: ${bingoState.bestStreak}
${passed ? '🎯 BINGO ACHIEVED!' : ''}

${achievements.length > 0 ? `🏅 Achievements: ${achievements.map(a => `${a.emoji} ${a.name}`).join(', ')}` : ''}
              `.trim()

              if (navigator.share) {
                navigator.share({
                  title: 'Bingo Results',
                  text: resultsText
                })
              } else {
                navigator.clipboard.writeText(resultsText)
                alert('Results copied to clipboard!')
              }
            }}
            className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
              color: 'white'
            }}
          >
            📤 Share Results
          </button>

          {/* Download Attendance Certificate Button */}
          {organization?.settings?.enableAttendanceCertificates && (
            <button
              onClick={async () => {
                playSound('click')
                const { downloadAttendanceCertificate } = await import('../lib/attendanceCertificate')
                await downloadAttendanceCertificate({
                  participantName,
                  sessionTitle: quiz.title,
                  completionDate: new Date(),
                  organizationName: organization?.name,
                  organizationLogo: organization?.branding?.logo,
                  sessionCode,
                  primaryColor: organization?.branding?.primaryColor,
                  secondaryColor: organization?.branding?.secondaryColor
                })
                playSound('achievement')
              }}
              className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                color: 'white'
              }}
            >
              📋 Download Attendance Certificate
            </button>
          )}

          {/* Download Certificate Button */}
          {passed && (
            <button
              onClick={() => {
                downloadCertificate({
                  participantName,
                  quizTitle: quiz.title,
                  score: bingoState.score,
                  percentage,
                  passed,
                  passingScore: 0,
                  totalQuestions: totalCells,
                  correctAnswers: cellsMarked,
                  completionDate: new Date(),
                  gameType: 'bingo',
                  achievements: achievements.map(a => `${a.emoji} ${a.name}`)
                })
                playSound('achievement')
              }}
              className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--success-color), var(--primary-color))',
                color: 'white'
              }}
            >
              📜 Download Certificate
            </button>
          )}

          <button
            onClick={() => navigate(`/join/${sessionCode}`)}
            className="w-full py-3 px-6 rounded-xl font-medium border-2 transition-transform active:scale-95"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderColor: 'var(--primary-color)',
              color: 'var(--primary-color)'
            }}
          >
            Join Another Session
          </button>
        </div>
      </div>

      {/* Floating Sound Control */}
      <SoundControl position="bottom-right" minimal={true} />
    </div>
  )
}

// ==================== QUIZ RESULTS ====================

const QuizResults: React.FC<{
  resultsState: ResultsState
  navigate: ReturnType<typeof useNavigate>
  playSound: (sound: string) => void
  organization: Organization | null
}> = ({ resultsState, navigate, playSound, organization }) => {
  const { participantName, gameState, quiz, sessionCode } = resultsState
  const quizState = gameState as { score: number; streak: number; answers: any[]; totalQuestions: number }
  const correctAnswers = quizState.answers.filter(a => a.isCorrect).length
  const percentage = Math.round((correctAnswers / quizState.totalQuestions) * 100)
  const passed = percentage >= quiz.settings.passingScore
  const averageTime = quizState.answers.length > 0
    ? Math.round(quizState.answers.reduce((acc, answer) => acc + answer.timeSpent, 0) / quizState.answers.length)
    : 0

  // Calculate best streak
  let bestStreak = 0
  let currentStreak = 0
  quizState.answers.forEach(answer => {
    if (answer.isCorrect) {
      currentStreak++
      bestStreak = Math.max(bestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  })

  // Performance analysis with emoji and styling
  const getPerformanceLevel = () => {
    if (percentage >= 90) return {
      level: 'Outstanding',
      emoji: '🏆',
      style: { color: 'var(--success-color)', backgroundColor: 'var(--success-light-color)' }
    }
    if (percentage >= 80) return {
      level: 'Excellent',
      emoji: '🌟',
      style: { color: 'var(--primary-color)', backgroundColor: 'var(--primary-light-color)' }
    }
    if (percentage >= 70) return {
      level: 'Good',
      emoji: '👍',
      style: { color: 'var(--secondary-color)', backgroundColor: 'var(--secondary-light-color)' }
    }
    if (percentage >= 60) return {
      level: 'Fair',
      emoji: '📚',
      style: { color: 'var(--warning-color)', backgroundColor: 'var(--warning-light-color)' }
    }
    return {
      level: 'Keep Learning',
      emoji: '💪',
      style: { color: 'var(--error-color)', backgroundColor: 'var(--error-light-color)' }
    }
  }

  const performance = getPerformanceLevel()

  const getAchievements = () => {
    const achievements: Array<{ name: string; emoji: string; icon: typeof Trophy; style: React.CSSProperties; description: string }> = []

    if (percentage === 100) {
      achievements.push({
        name: 'Perfect Score',
        emoji: '🏆',
        icon: Trophy,
        style: { color: 'var(--celebration-color, #fbbf24)', backgroundColor: 'rgba(251, 191, 36, 0.2)' },
        description: '100% correct answers'
      })
    }
    if (bestStreak >= 5) {
      achievements.push({
        name: 'Streak Master',
        emoji: '🔥',
        icon: Zap,
        style: { color: 'var(--streak-color, #f97316)', backgroundColor: 'rgba(249, 115, 22, 0.2)' },
        description: `${bestStreak} correct in a row`
      })
    }
    if (averageTime <= 15) {
      achievements.push({
        name: 'Speed Demon',
        emoji: '⚡',
        icon: Clock,
        style: { color: 'var(--primary-color)', backgroundColor: 'var(--primary-light-color)' },
        description: `${averageTime}s average response`
      })
    }
    if (correctAnswers >= quizState.totalQuestions * 0.8 && percentage < 100) {
      achievements.push({
        name: 'Knowledge Expert',
        emoji: '🎯',
        icon: Star,
        style: { color: 'var(--secondary-color)', backgroundColor: 'var(--secondary-light-color)' },
        description: '80%+ accuracy'
      })
    }
    if (passed) {
      achievements.push({
        name: 'Certified',
        emoji: '✅',
        icon: Award,
        style: { color: 'var(--success-color)', backgroundColor: 'var(--success-light-color)' },
        description: 'Passed the quiz'
      })
    }

    return achievements
  }

  const achievements = getAchievements()

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--secondary-color), var(--primary-color))' }}
    >
      {/* Floating celebration elements for high scores */}
      {percentage >= 80 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>🎉</div>
          <div className="absolute top-20 right-20 text-3xl animate-bounce" style={{ animationDelay: '0.5s' }}>⭐</div>
          <div className="absolute bottom-40 left-20 text-4xl animate-bounce" style={{ animationDelay: '1s' }}>🎊</div>
          <div className="absolute bottom-20 right-10 text-3xl animate-bounce" style={{ animationDelay: '1.5s' }}>✨</div>
        </div>
      )}

      {/* Header */}
      <header
        className="shadow-lg"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <div className="flex items-center space-x-2">
              <Trophy size={24} style={{ color: 'var(--accent-color, #fbbf24)' }} />
              <h1 className="text-xl font-bold" style={{ color: 'white' }}>Your Results</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Results Card */}
        <div
          className="rounded-2xl shadow-2xl border-2 p-6 mb-6 text-center"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: 'var(--accent-color, #fbbf24)',
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* Hero Section */}
          <div className="mb-6">
            {/* Big Score Display */}
            <div
              className="w-32 h-32 rounded-full flex flex-col items-center justify-center mx-auto mb-4 shadow-lg"
              style={{
                background: passed
                  ? 'linear-gradient(135deg, var(--success-color), var(--success-light-color))'
                  : 'linear-gradient(135deg, var(--warning-color), var(--warning-light-color))',
                border: '4px solid var(--accent-color, #fbbf24)'
              }}
            >
              <span className="text-4xl font-bold" style={{ color: 'white' }}>{percentage}%</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Score</span>
            </div>

            {/* Congratulations Message */}
            <div className="mb-4">
              <span className="text-4xl">{performance.emoji}</span>
              <h2 className="text-2xl font-bold mt-2" style={{ color: 'var(--text-color)' }}>
                {passed ? 'Congratulations!' : 'Good Effort!'}
              </h2>
              {percentage >= 90 && <span className="text-2xl ml-2">👑</span>}
            </div>

            <p className="text-text-secondary mb-4">
              {participantName}, here are your results for <strong>"{quiz.title}"</strong>
            </p>

            {/* Performance Badge */}
            <div
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-full text-lg font-semibold shadow-md"
              style={performance.style}
            >
              <span className="text-xl">{performance.emoji}</span>
              <span>{performance.level}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--success-light-color, #dcfce7)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--success-color, #16a34a)' }}>
                {correctAnswers}
              </div>
              <div className="text-sm text-text-secondary flex items-center justify-center space-x-1">
                <CheckCircle size={14} style={{ color: 'var(--success-color)' }} />
                <span>Correct</span>
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--error-light-color, #fee2e2)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--error-color, #dc2626)' }}>
                {quizState.totalQuestions - correctAnswers}
              </div>
              <div className="text-sm text-text-secondary flex items-center justify-center space-x-1">
                <XCircle size={14} style={{ color: 'var(--error-color)' }} />
                <span>Incorrect</span>
              </div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--streak-color, #f97316)' }}>
                {bestStreak} 🔥
              </div>
              <div className="text-sm text-text-secondary">Best Streak</div>
            </div>
            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--primary-light-color, #dbeafe)' }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
                {averageTime}s ⚡
              </div>
              <div className="text-sm text-text-secondary">Avg Time</div>
            </div>
          </div>

          {/* Inline Achievement Badges */}
          {achievements.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {achievements.map((achievement, index) => (
                <span
                  key={index}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: achievement.style.backgroundColor,
                    color: achievement.style.color as string
                  }}
                >
                  <span>{achievement.emoji}</span>
                  <span>{achievement.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard Section */}
        <LeaderboardSection resultsState={resultsState} />

        {/* Question Breakdown - Collapsible for mobile */}
        <details
          className="rounded-2xl shadow-xl border mb-6 overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: 'var(--border-color)'
          }}
        >
          <summary className="p-4 cursor-pointer font-bold flex items-center space-x-2 hover:bg-gray-50">
            <span className="text-xl">📋</span>
            <span>Question Breakdown ({correctAnswers}/{quizState.totalQuestions} correct)</span>
          </summary>
          <div className="p-4 pt-0 space-y-3">
            {quizState.answers.map((answer, index) => {
              const question = quiz.questions.find(q => q.id === answer.questionId)
              if (!question) return null

              return (
                <div
                  key={answer.questionId}
                  className="p-4 rounded-xl border-2"
                  style={{
                    borderColor: answer.isCorrect ? 'var(--success-color)' : 'var(--error-color)',
                    backgroundColor: answer.isCorrect ? 'var(--success-light-color)' : 'var(--error-light-color)'
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {answer.isCorrect ? (
                        <span className="text-xl">✅</span>
                      ) : (
                        <span className="text-xl">❌</span>
                      )}
                      <span className="font-medium">Question {index + 1}</span>
                    </div>
                    <div className="text-sm text-text-secondary flex items-center space-x-1">
                      <Clock size={14} />
                      <span>{answer.timeSpent}s</span>
                    </div>
                  </div>

                  <p className="text-sm mb-2 font-medium">{question.questionText}</p>

                  <div className="text-sm space-y-1">
                    <div
                      className="flex items-center space-x-1"
                      style={{ color: answer.isCorrect ? 'var(--success-color)' : 'var(--error-color)' }}
                    >
                      <span className="font-medium">Your answer:</span>
                      <span>{question.options[answer.selectedAnswer] || 'No answer'}</span>
                    </div>
                    {!answer.isCorrect && (
                      <div className="flex items-center space-x-1" style={{ color: 'var(--success-color)' }}>
                        <span className="font-medium">Correct:</span>
                        <span>{question.options[question.correctAnswer]}</span>
                      </div>
                    )}
                    {question.explanation && (
                      <div className="text-text-secondary italic mt-2 p-2 rounded bg-white/50">
                        💡 {question.explanation}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </details>

        {/* Actions */}
        <div className="space-y-3 pb-6">
          <button
            onClick={() => {
              const resultsText = `
${quiz.title} - Results for ${participantName}

${performance.emoji} Score: ${percentage}% (${correctAnswers}/${quizState.totalQuestions})
Performance: ${performance.level}
🔥 Best Streak: ${bestStreak}
⚡ Average Time: ${averageTime}s

${achievements.length > 0 ? `🏅 Achievements: ${achievements.map(a => `${a.emoji} ${a.name}`).join(', ')}` : ''}
              `.trim()

              if (navigator.share) {
                navigator.share({
                  title: 'Quiz Results',
                  text: resultsText
                })
              } else {
                navigator.clipboard.writeText(resultsText)
                alert('Results copied to clipboard!')
              }
            }}
            className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
              color: 'white'
            }}
          >
            📤 Share Results
          </button>

          {/* Download Attendance Certificate Button */}
          {organization?.settings?.enableAttendanceCertificates && (
            <button
              onClick={async () => {
                playSound('click')
                const { downloadAttendanceCertificate } = await import('../lib/attendanceCertificate')
                await downloadAttendanceCertificate({
                  participantName,
                  sessionTitle: quiz.title,
                  completionDate: new Date(),
                  organizationName: organization?.name,
                  organizationLogo: organization?.branding?.logo,
                  sessionCode,
                  primaryColor: organization?.branding?.primaryColor,
                  secondaryColor: organization?.branding?.secondaryColor
                })
                playSound('achievement')
              }}
              className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                color: 'white'
              }}
            >
              📋 Download Attendance Certificate
            </button>
          )}

          {/* Download Certificate Button */}
          {passed && (
            <button
              onClick={() => {
                downloadCertificate({
                  participantName,
                  quizTitle: quiz.title,
                  score: quizState.score,
                  percentage,
                  passed,
                  passingScore: quiz.settings.passingScore,
                  totalQuestions: quizState.totalQuestions,
                  correctAnswers,
                  completionDate: new Date(),
                  achievements: achievements.map(a => `${a.emoji} ${a.name}`)
                })
                playSound('achievement')
              }}
              className="w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--success-color), var(--primary-color))',
                color: 'white'
              }}
            >
              📜 Download Certificate
            </button>
          )}

          <button
            onClick={() => navigate(`/join/${sessionCode}`)}
            className="w-full py-3 px-6 rounded-xl font-medium border-2 transition-transform active:scale-95"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderColor: 'var(--primary-color)',
              color: 'var(--primary-color)'
            }}
          >
            Join Another Session
          </button>
        </div>
      </div>

      {/* Floating Sound Control */}
      <SoundControl position="bottom-right" minimal={true} />
    </div>
  )
}

// ==================== SHARED LEADERBOARD ====================

const LeaderboardSection: React.FC<{ resultsState: ResultsState }> = ({ resultsState }) => {
  const { participantName, gameState } = resultsState

  if (!resultsState.allParticipants || resultsState.allParticipants.length <= 1) {
    return null
  }

  const sortedParticipants = [...resultsState.allParticipants].sort(
    (a, b) => (b.gameState?.score || b.finalScore || 0) - (a.gameState?.score || a.finalScore || 0)
  )
  const myRank = sortedParticipants.findIndex(p => p.id === resultsState.participantId) + 1
  const totalParticipants = sortedParticipants.length
  const beatPercentage = myRank > 0
    ? Math.round(((totalParticipants - myRank) / totalParticipants) * 100)
    : 0
  const top5 = sortedParticipants.slice(0, 5)

  const getMedalStyle = (rank: number): { emoji: string; bgColor: string; textColor: string } => {
    switch (rank) {
      case 1:
        return { emoji: '🥇', bgColor: 'rgba(251, 191, 36, 0.3)', textColor: '#92400e' }
      case 2:
        return { emoji: '🥈', bgColor: 'rgba(156, 163, 175, 0.3)', textColor: '#374151' }
      case 3:
        return { emoji: '🥉', bgColor: 'rgba(217, 119, 6, 0.3)', textColor: '#92400e' }
      default:
        return { emoji: '', bgColor: '#f9fafb', textColor: '#1f2937' }
    }
  }

  return (
    <div
      className="rounded-2xl shadow-xl border p-6 mb-6"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'var(--accent-color, rgba(251, 191, 36, 0.5))'
      }}
    >
      <h3 className="font-bold text-lg mb-4 flex items-center space-x-2">
        <span className="text-2xl">🏆</span>
        <span>Leaderboard</span>
      </h3>

      {/* Your Rank Highlight */}
      {myRank > 0 && (
        <div
          className="p-4 rounded-xl mb-4 text-center border-2"
          style={{
            backgroundColor: myRank <= 3 ? getMedalStyle(myRank).bgColor : '#dbeafe',
            borderColor: myRank <= 3 ? getMedalStyle(myRank).textColor : '#3b82f6'
          }}
        >
          <div className="text-3xl font-bold mb-1" style={{ color: myRank <= 3 ? getMedalStyle(myRank).textColor : '#1e40af' }}>
            {myRank <= 3 ? getMedalStyle(myRank).emoji : ''} #{myRank}
          </div>
          <p className="text-sm" style={{ color: '#4b5563' }}>
            out of {totalParticipants} participants
          </p>
          {beatPercentage > 0 && (
            <p className="text-sm font-medium mt-1" style={{ color: '#166534' }}>
              You beat {beatPercentage}% of participants!
            </p>
          )}
        </div>
      )}

      {/* Top 5 List */}
      <div className="space-y-2">
        {top5.map((participant, index) => {
          const rank = index + 1
          const isMe = participant.id === resultsState.participantId
          const score = participant.gameState?.score || participant.finalScore || 0
          const medal = getMedalStyle(rank)

          return (
            <div
              key={participant.id}
              className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                isMe ? 'ring-2 ring-offset-1' : ''
              }`}
              style={{
                backgroundColor: medal.bgColor,
                ringColor: isMe ? 'var(--primary-color)' : 'transparent'
              }}
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{
                    backgroundColor: rank <= 3 ? medal.textColor : 'var(--border-color)',
                    color: rank <= 3 ? 'white' : 'var(--text-secondary-color)'
                  }}
                >
                  {rank <= 3 ? medal.emoji : rank}
                </div>
                <span className={`font-medium ${isMe ? 'text-primary' : ''}`}>
                  {participant.name} {isMe && '(You)'}
                </span>
              </div>
              <span className="font-bold" style={{ color: medal.textColor }}>
                {score} pts
              </span>
            </div>
          )
        })}

        {/* Show current user if not in top 5 */}
        {myRank > 5 && (
          <>
            <div className="text-center py-2" style={{ color: '#6b7280' }}>• • •</div>
            <div
              className="flex items-center justify-between p-3 rounded-xl ring-2 ring-offset-1"
              style={{
                backgroundColor: '#dbeafe',
                ringColor: '#3b82f6'
              }}
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: '#3b82f6', color: 'white' }}
                >
                  {myRank}
                </div>
                <span className="font-medium" style={{ color: '#1e40af' }}>
                  {participantName} (You)
                </span>
              </div>
              <span className="font-bold" style={{ color: '#1e40af' }}>
                {gameState.score} pts
              </span>
            </div>
          </>
        )}
      </div>

      {/* Total Participants */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-center space-x-2 text-sm text-text-secondary">
        <Users size={16} />
        <span>{totalParticipants} total participants</span>
      </div>
    </div>
  )
}

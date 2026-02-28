import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Trophy, Star, Zap, Target, Clock, CheckCircle, XCircle, Award, TrendingUp, Crown, Medal, Users, Grid } from 'lucide-react'
import { FirestoreService, type Organization, type Participant } from '../lib/firestore'
import { useVisualEffects } from '../lib/visualEffects'
import { applyOrganizationBranding } from '../lib/applyBranding'
import { ReactionOverlay } from '../components/ReactionOverlay'
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
  sessionId?: string
  // Leaderboard data
  allParticipants?: Participant[]
  participantId?: string
}

export const ParticipantResults: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const resultsState = location.state as ResultsState
  const [organization, setOrganization] = useState<Organization | null>(null)

  // Visual effects hook
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

  // Celebration reaction overlay state
  const [showCelebration, setShowCelebration] = useState(false)

  // Visual celebration effects only - all sounds come through the presenter
  useEffect(() => {
    if (!resultsState) return

    if (isBingo) {
      const bingoState = resultsState.gameState as BingoGameState
      if (bingoState.gameWon) {
        setTimeout(() => triggerScreenEffect('celebration-confetti'), 500)
      }
    } else {
      const quizState = resultsState.gameState as { answers: any[]; totalQuestions: number }
      const correctAnswers = quizState.answers.filter(a => a.isCorrect).length
      const percentage = Math.round((correctAnswers / quizState.totalQuestions) * 100)

      if (percentage >= 90) {
        setTimeout(() => triggerScreenEffect('celebration-confetti'), 500)
      } else if (percentage >= 80) {
        setTimeout(() => triggerScreenEffect('screen-flash', { color: 'var(--success-color)' }), 500)
      }
    }
  }, [resultsState])

  // Show celebration overlay for high scorers (built-in animation or custom reaction video)
  useEffect(() => {
    if (!resultsState) return

    let qualifies = false
    if (isBingo) {
      qualifies = (resultsState.gameState as BingoGameState).gameWon
    } else {
      const quizState = resultsState.gameState as { answers: any[]; totalQuestions: number }
      const correctAnswers = quizState.answers.filter(a => a.isCorrect).length
      const percentage = quizState.totalQuestions > 0 ? Math.round((correctAnswers / quizState.totalQuestions) * 100) : 0
      qualifies = percentage >= 80
    }

    if (qualifies) {
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 3000)
    }
  }, [organization, resultsState])

  // Deferred leaderboard: subscribe to session status
  // Personal stats show immediately; leaderboard waits until session ends
  const [sessionCompleted, setSessionCompleted] = useState(!resultsState?.sessionId)
  const [liveParticipants, setLiveParticipants] = useState<Participant[] | null>(null)
  const [refreshingLeaderboard, setRefreshingLeaderboard] = useState(false)

  const leaderboardFetchedRef = useRef(false)

  useEffect(() => {
    if (!resultsState?.sessionId) return
    leaderboardFetchedRef.current = false

    const unsubscribe = FirestoreService.subscribeToSession(
      resultsState.sessionId,
      async (session) => {
        if (session?.status === 'completed' && !leaderboardFetchedRef.current) {
          leaderboardFetchedRef.current = true
          // Show loading indicator only if fetch takes >500ms
          const showTimeout = setTimeout(() => setRefreshingLeaderboard(true), 500)
          try {
            const fresh = await FirestoreService.getSessionParticipants(resultsState.sessionId!)
            setLiveParticipants(fresh)
          } catch (e) {
            console.error('Error refreshing participants:', e)
          } finally {
            clearTimeout(showTimeout)
            setRefreshingLeaderboard(false)
          }
          setSessionCompleted(true)
        }
      }
    )

    return () => unsubscribe()
  }, [resultsState?.sessionId])

  if (!resultsState) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--secondary-color))' }}
      >
        <div className="text-center p-8 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}>
          <p style={{ color: '#6b7280' }} className="mb-4">No results available</p>
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

  // Render bingo or quiz results (with optional celebration overlay)
  const resultsContent = isBingo
    ? <BingoResults resultsState={resultsState} navigate={navigate} organization={organization} sessionCompleted={sessionCompleted} liveParticipants={liveParticipants} refreshingLeaderboard={refreshingLeaderboard} />
    : <QuizResults resultsState={resultsState} navigate={navigate} organization={organization} sessionCompleted={sessionCompleted} liveParticipants={liveParticipants} refreshingLeaderboard={refreshingLeaderboard} />

  return (
    <>
      {resultsContent}
      <ReactionOverlay
        type="celebration"
        reactions={organization?.branding?.reactions}
        visible={showCelebration}
      />
    </>
  )
}

// ==================== BINGO RESULTS ====================

const BingoResults: React.FC<{
  resultsState: ResultsState
  navigate: ReturnType<typeof useNavigate>
  organization: Organization | null
  sessionCompleted: boolean
  liveParticipants: Participant[] | null
  refreshingLeaderboard: boolean
}> = ({ resultsState, navigate, organization, sessionCompleted, liveParticipants, refreshingLeaderboard }) => {
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
  // Hardcoded accessible colors for use inside white result cards
  const getPerformanceLevel = () => {
    if (passed && bingoState.fullCardAchieved) return {
      level: 'Outstanding',
      emoji: '🏆',
      style: { color: '#166534', backgroundColor: '#dcfce7' }
    }
    if (passed) return {
      level: 'Excellent',
      emoji: '🌟',
      style: { color: '#1d4ed8', backgroundColor: '#dbeafe' }
    }
    if (percentage >= 80) return {
      level: 'Good',
      emoji: '👍',
      style: { color: '#7c3aed', backgroundColor: '#ede9fe' }
    }
    if (percentage >= 50) return {
      level: 'Fair',
      emoji: '📚',
      style: { color: '#d97706', backgroundColor: '#fef3c7' }
    }
    return {
      level: 'Keep Going',
      emoji: '💪',
      style: { color: '#dc2626', backgroundColor: '#fee2e2' }
    }
  }

  const performance = getPerformanceLevel()

  // Bingo-native achievements (hardcoded colors for white card backgrounds)
  const getBingoAchievements = () => {
    const achievements: Array<{ name: string; emoji: string; style: React.CSSProperties; description: string }> = []

    if (passed) {
      achievements.push({
        name: 'BINGO!',
        emoji: '🎯',
        style: { color: '#b45309', backgroundColor: 'rgba(251, 191, 36, 0.2)' },
        description: 'Won the game!'
      })
    }
    if (bingoState.fullCardAchieved) {
      achievements.push({
        name: 'Full Card',
        emoji: '🏆',
        style: { color: '#166534', backgroundColor: '#dcfce7' },
        description: 'Marked every cell'
      })
    }
    if (bingoState.timeToFirstBingo && bingoState.timeToFirstBingo < 120) {
      achievements.push({
        name: 'Speed Bingo',
        emoji: '⚡',
        style: { color: '#1d4ed8', backgroundColor: '#dbeafe' },
        description: `BINGO in ${formatTime(bingoState.timeToFirstBingo)}`
      })
    }
    if (bingoState.bestStreak >= 5) {
      achievements.push({
        name: 'Streak Star',
        emoji: '🔥',
        style: { color: '#ea580c', backgroundColor: 'rgba(249, 115, 22, 0.15)' },
        description: `${bingoState.bestStreak} consecutive marks`
      })
    }
    if (percentage >= 80 && !bingoState.fullCardAchieved) {
      achievements.push({
        name: 'Completionist',
        emoji: '✅',
        style: { color: '#7c3aed', backgroundColor: '#ede9fe' },
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
            <div className="flex items-center space-x-3">
              {organization?.branding?.logo ? (
                <img src={organization.branding.logo} alt={organization.name} className="h-8 object-contain" style={{ borderRadius: 'var(--logo-border-radius, 0)' }} />
              ) : (
                <Grid size={24} style={{ color: 'var(--accent-color, #fbbf24)' }} />
              )}
              <h1 className="text-xl font-bold" style={{ color: 'white' }}>Bingo Results</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Results Card */}
        <div
          className="rounded-2xl shadow-2xl border-2 p-5 sm:p-8 mb-6 text-center"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#fbbf24',
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* Hero Section */}
          <div className="mb-8">
            {/* Big Score Display */}
            <div
              className="w-36 h-36 rounded-full flex flex-col items-center justify-center mx-auto mb-5 shadow-lg"
              style={{
                background: passed
                  ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                  : 'linear-gradient(135deg, #d97706, #f59e0b)',
                border: '4px solid #fbbf24'
              }}
            >
              <span className="text-5xl font-bold" style={{ color: 'white' }}>{bingoState.score}</span>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.9)' }}>Points</span>
            </div>

            {/* Congratulations Message */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold" style={{ color: '#1f2937' }}>
                {passed ? 'BINGO!' : 'Good Effort!'} {performance.emoji}
              </h2>
              {passed && bingoState.fullCardAchieved && <span className="text-2xl ml-1">👑</span>}
            </div>

            <p style={{ color: '#4b5563' }} className="text-base mb-5">
              {participantName}, here are your bingo results for <strong style={{ color: '#1f2937' }}>"{quiz.title}"</strong>
            </p>

            {/* Performance Badge */}
            <div
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-full text-lg font-bold shadow-md"
              style={performance.style}
            >
              <span className="text-xl">{performance.emoji}</span>
              <span>{performance.level}</span>
            </div>
          </div>

          {/* Stats Grid - Bingo Native (hardcoded accessible colors for white cards) */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div
              className="p-5 rounded-xl"
              style={{ backgroundColor: '#dcfce7' }}
            >
              <div className="text-3xl font-bold" style={{ color: '#166534' }}>
                {bingoState.linesCompleted}
              </div>
              <div className="text-sm font-medium flex items-center justify-center space-x-1 mt-1" style={{ color: '#166534' }}>
                <Target size={16} style={{ color: '#166534' }} />
                <span>Lines</span>
              </div>
            </div>
            <div
              className="p-5 rounded-xl"
              style={{ backgroundColor: '#dbeafe' }}
            >
              <div className="text-3xl font-bold" style={{ color: '#2563eb' }}>
                {cellsMarked}/{totalCells}
              </div>
              <div className="text-sm font-medium flex items-center justify-center space-x-1 mt-1" style={{ color: '#2563eb' }}>
                <CheckCircle size={16} style={{ color: '#2563eb' }} />
                <span>Cells</span>
              </div>
            </div>
            <div
              className="p-5 rounded-xl"
              style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)' }}
            >
              <div className="text-3xl font-bold" style={{ color: '#ea580c' }}>
                {bingoState.bestStreak} 🔥
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: '#ea580c' }}>Best Streak</div>
            </div>
            <div
              className="p-5 rounded-xl"
              style={{ backgroundColor: '#fef3c7' }}
            >
              <div className="text-3xl font-bold" style={{ color: '#d97706' }}>
                {formatTime(bingoState.timeToFirstBingo)}
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: '#d97706' }}>Time to BINGO</div>
            </div>
          </div>

          {/* Achievement Badges */}
          {achievements.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {achievements.map((achievement, index) => (
                <span
                  key={index}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-base font-semibold"
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

        {/* Leaderboard Section (deferred until session ends) */}
        <LeaderboardSection resultsState={resultsState} sessionCompleted={sessionCompleted} liveParticipants={liveParticipants} refreshing={refreshingLeaderboard} />

        {/* Mini Bingo Card Display */}
        <details
          className="rounded-2xl shadow-xl border mb-6 overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: 'var(--border-color)'
          }}
        >
          <summary className="p-4 cursor-pointer font-bold flex items-center space-x-2" style={{ color: '#1f2937' }}>
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
                    className="aspect-square rounded flex items-center justify-center text-sm font-medium"
                    style={{
                      backgroundColor: isFree
                        ? '#fbbf24'
                        : isMarked
                        ? '#22c55e'
                        : '#f3f4f6',
                      color: isFree || isMarked ? 'white' : '#9ca3af',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    {isFree ? 'FREE' : isMarked ? '✓' : ''}
                  </div>
                )
              })}
            </div>
            <p className="text-base text-center mt-3" style={{ color: '#6b7280' }}>
              {bingoState.linesCompleted > 0 && `${bingoState.linesCompleted} line${bingoState.linesCompleted !== 1 ? 's' : ''} completed. `}
              {cellsMarked}/{totalCells} cells marked.
              {passed ? ' BINGO achieved!' : ''}
            </p>
          </div>
        </details>

        {/* Actions */}
        <div className="space-y-3 pb-6">
          <button
            onClick={async () => {
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
                try {
                  await navigator.clipboard.writeText(resultsText)
                  alert('Results copied to clipboard!')
                } catch {
                  alert('Unable to copy to clipboard. Please copy your results manually.')
                }
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
                try {
                  const { downloadAttendanceCertificate } = await import('../lib/attendanceCertificate')
                  await downloadAttendanceCertificate({
                    participantName,
                    sessionTitle: quiz.title,
                    completionDate: new Date(),
                    organizationName: organization?.name,
                    organizationLogo: organization?.branding?.logo || (organization?.branding as any)?.logoUrl,
                    sessionCode,
                    primaryColor: organization?.branding?.primaryColor,
                    secondaryColor: organization?.branding?.secondaryColor,
                    signatureImage: organization?.branding?.signatureUrl,
                    signerName: organization?.branding?.signerName,
                    signerTitle: organization?.branding?.signerTitle,
                    ...(quiz.settings.cpdEnabled ? {
                      cpdPoints: quiz.settings.cpdPoints,
                      cpdRequiresPass: quiz.settings.cpdRequiresPass,
                      cpdEarned: quiz.settings.cpdRequiresPass ? passed : true
                    } : {}),
                  })
                } catch (error) {
                  console.error('Error generating certificate:', error)
                  alert('Failed to generate certificate. Please try again.')
                }
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

    </div>
  )
}

// ==================== QUIZ RESULTS ====================

// Generate fun facts from individual participant data (zero Firestore reads)
const generateFunFacts = (answers: Array<{ questionId: string; selectedAnswer: number; isCorrect: boolean; timeSpent: number }>, totalQuestions: number, bestStreak: number): string[] => {
  if (answers.length === 0) return []
  const facts: string[] = []

  // Fastest answer
  const fastestAnswer = answers.reduce((min, a) => a.timeSpent < min.timeSpent ? a : min, answers[0])
  const fastestIndex = answers.indexOf(fastestAnswer) + 1
  if (fastestAnswer.timeSpent <= 5) {
    facts.push(`Lightning reflexes! You answered Question ${fastestIndex} in just ${fastestAnswer.timeSpent}s`)
  }

  // Hot streak
  if (bestStreak >= 3) {
    facts.push(`On fire with a ${bestStreak}-question correct streak!`)
  }

  // Completed all questions
  if (answers.length === totalQuestions) {
    facts.push(`Completed all ${totalQuestions} questions — no timeouts!`)
  }

  // Tough question nailed (slowest answer that was correct)
  const correctAnswers = answers.filter(a => a.isCorrect)
  if (correctAnswers.length > 0) {
    const slowestCorrect = correctAnswers.reduce((max, a) => a.timeSpent > max.timeSpent ? a : max, correctAnswers[0])
    if (slowestCorrect.timeSpent >= 15) {
      const slowestIndex = answers.indexOf(slowestCorrect) + 1
      facts.push(`Question ${slowestIndex} made you think, but you got it right!`)
    }
  }

  return facts.slice(0, 2) // Max 2 fun facts
}

type ResultsPhase = 'score-reveal' | 'fun-facts' | 'achievements' | 'full-results'

const QuizResults: React.FC<{
  resultsState: ResultsState
  navigate: ReturnType<typeof useNavigate>
  organization: Organization | null
  sessionCompleted: boolean
  liveParticipants: Participant[] | null
  refreshingLeaderboard: boolean
}> = ({ resultsState, navigate, organization, sessionCompleted, liveParticipants, refreshingLeaderboard }) => {
  const { participantName, gameState, quiz, sessionCode } = resultsState
  const quizState = gameState as { score: number; streak: number; answers: any[]; totalQuestions: number }
  const correctAnswers = quizState.answers.filter(a => a.isCorrect).length
  const percentage = quizState.totalQuestions > 0 ? Math.round((correctAnswers / quizState.totalQuestions) * 100) : 0
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

  // Animated reveal state
  const [phase, setPhase] = useState<ResultsPhase>('score-reveal')
  const [animatedScore, setAnimatedScore] = useState(0)
  const leaderboardRef = useRef<HTMLDivElement>(null)

  // Fun facts from individual data
  const funFacts = generateFunFacts(quizState.answers, quizState.totalQuestions, bestStreak)

  // Animated score counter + phase progression
  useEffect(() => {
    // Animate score count-up
    const target = percentage
    const duration = 1500
    const start = Date.now()
    const animate = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setAnimatedScore(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)

    // Phase progression timers
    const t1 = setTimeout(() => setPhase('fun-facts'), 2000)
    const t2 = setTimeout(() => setPhase('achievements'), 3500)
    const t3 = setTimeout(() => setPhase('full-results'), 5000)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Auto-scroll to leaderboard when it appears
  useEffect(() => {
    if (sessionCompleted && phase === 'full-results' && leaderboardRef.current) {
      setTimeout(() => {
        leaderboardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 500)
    }
  }, [sessionCompleted, phase])

  // Performance analysis with emoji and styling (hardcoded for white card readability)
  const getPerformanceLevel = () => {
    if (percentage >= 90) return {
      level: 'Outstanding',
      emoji: '🏆',
      style: { color: '#166534', backgroundColor: '#dcfce7' }
    }
    if (percentage >= 80) return {
      level: 'Excellent',
      emoji: '🌟',
      style: { color: '#1d4ed8', backgroundColor: '#dbeafe' }
    }
    if (percentage >= 70) return {
      level: 'Good',
      emoji: '👍',
      style: { color: '#7c3aed', backgroundColor: '#ede9fe' }
    }
    if (percentage >= 60) return {
      level: 'Fair',
      emoji: '📚',
      style: { color: '#d97706', backgroundColor: '#fef3c7' }
    }
    return {
      level: 'Keep Learning',
      emoji: '💪',
      style: { color: '#dc2626', backgroundColor: '#fee2e2' }
    }
  }

  const performance = getPerformanceLevel()

  // Achievements with hardcoded colors for white card readability
  const getAchievements = () => {
    const achievements: Array<{ name: string; emoji: string; icon: typeof Trophy; style: React.CSSProperties; description: string }> = []

    if (percentage === 100) {
      achievements.push({
        name: 'Perfect Score',
        emoji: '🏆',
        icon: Trophy,
        style: { color: '#b45309', backgroundColor: 'rgba(251, 191, 36, 0.2)' },
        description: '100% correct answers'
      })
    }
    if (bestStreak >= 5) {
      achievements.push({
        name: 'Streak Master',
        emoji: '🔥',
        icon: Zap,
        style: { color: '#ea580c', backgroundColor: 'rgba(249, 115, 22, 0.15)' },
        description: `${bestStreak} correct in a row`
      })
    }
    if (averageTime <= 15) {
      achievements.push({
        name: 'Speed Demon',
        emoji: '⚡',
        icon: Clock,
        style: { color: '#1d4ed8', backgroundColor: '#dbeafe' },
        description: `${averageTime}s average response`
      })
    }
    if (correctAnswers >= quizState.totalQuestions * 0.8 && percentage < 100) {
      achievements.push({
        name: 'Knowledge Expert',
        emoji: '🎯',
        icon: Star,
        style: { color: '#7c3aed', backgroundColor: '#ede9fe' },
        description: '80%+ accuracy'
      })
    }
    if (passed) {
      achievements.push({
        name: 'Certified',
        emoji: '✅',
        icon: Award,
        style: { color: '#166534', backgroundColor: '#dcfce7' },
        description: 'Passed the quiz'
      })
    }

    return achievements
  }

  const achievements = getAchievements()

  // Phase visibility helpers
  const phaseOrder: ResultsPhase[] = ['score-reveal', 'fun-facts', 'achievements', 'full-results']
  const phaseReached = (target: ResultsPhase) => phaseOrder.indexOf(phase) >= phaseOrder.indexOf(target)

  // Certificate download handler
  const handleCertificateDownload = async () => {
    try {
      const { downloadAttendanceCertificate } = await import('../lib/attendanceCertificate')
      await downloadAttendanceCertificate({
        participantName,
        sessionTitle: quiz.title,
        completionDate: new Date(),
        organizationName: organization?.name,
        organizationLogo: organization?.branding?.logo || (organization?.branding as any)?.logoUrl,
        sessionCode,
        primaryColor: organization?.branding?.primaryColor,
        secondaryColor: organization?.branding?.secondaryColor,
        signatureImage: organization?.branding?.signatureUrl,
        signerName: organization?.branding?.signerName,
        signerTitle: organization?.branding?.signerTitle,
        ...(quiz.settings.cpdEnabled ? {
          cpdPoints: quiz.settings.cpdPoints,
          cpdRequiresPass: quiz.settings.cpdRequiresPass,
          cpdEarned: quiz.settings.cpdRequiresPass ? passed : true
        } : {}),
      })
    } catch (error) {
      console.error('Error generating certificate:', error)
      alert('Failed to generate certificate. Please try again.')
    }
  }

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
            <div className="flex items-center space-x-3">
              {organization?.branding?.logo ? (
                <img src={organization.branding.logo} alt={organization.name} className="h-8 object-contain" style={{ borderRadius: 'var(--logo-border-radius, 0)' }} />
              ) : (
                <Trophy size={24} style={{ color: 'var(--accent-color, #fbbf24)' }} />
              )}
              <h1 className="text-xl font-bold" style={{ color: 'white' }}>Your Results</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Results Card */}
        <div
          className="rounded-2xl shadow-2xl border-2 p-5 sm:p-8 mb-6 text-center"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#fbbf24',
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* ===== PHASE 1: Score Reveal (always visible) ===== */}
          <div className="mb-6">
            {/* Animated Score Display */}
            <div
              className="w-36 h-36 rounded-full flex flex-col items-center justify-center mx-auto mb-5 shadow-lg transition-transform duration-700"
              style={{
                background: passed
                  ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                  : 'linear-gradient(135deg, #d97706, #f59e0b)',
                border: '4px solid #fbbf24',
                transform: phase === 'score-reveal' ? 'scale(1.1)' : 'scale(1)'
              }}
            >
              <span className="text-5xl font-bold" style={{ color: 'white' }}>{animatedScore}%</span>
              <span className="text-base" style={{ color: 'rgba(255,255,255,0.9)' }}>Score</span>
            </div>

            {/* Congratulations Message */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold" style={{ color: '#1f2937' }}>
                {passed ? 'Congratulations!' : 'Good Effort!'} {performance.emoji}
              </h2>
              {percentage >= 90 && <span className="text-2xl ml-1">👑</span>}
            </div>

            <p style={{ color: '#4b5563' }} className="text-base mb-5">
              {participantName}, here are your results for <strong style={{ color: '#1f2937' }}>"{quiz.title}"</strong>
            </p>

            {/* Performance Badge */}
            <div
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-full text-lg font-bold shadow-md"
              style={performance.style}
            >
              <span className="text-xl">{performance.emoji}</span>
              <span>{performance.level}</span>
            </div>
          </div>

          {/* ===== PHASE 2: Fun Facts (fade in) ===== */}
          {funFacts.length > 0 && (
            <div
              className="mb-6 transition-all duration-500"
              style={{
                opacity: phaseReached('fun-facts') ? 1 : 0,
                transform: phaseReached('fun-facts') ? 'translateY(0)' : 'translateY(20px)'
              }}
            >
              <div className="space-y-2">
                {funFacts.map((fact, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-xl text-base font-medium transition-all duration-500"
                    style={{
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      opacity: phaseReached('fun-facts') ? 1 : 0,
                      transform: phaseReached('fun-facts') ? 'translateY(0)' : 'translateY(10px)',
                      transitionDelay: `${index * 300}ms`
                    }}
                  >
                    💡 {fact}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== Stats Grid (fade in with fun facts) ===== */}
          <div
            className="grid grid-cols-2 gap-3 text-center transition-all duration-500"
            style={{
              opacity: phaseReached('fun-facts') ? 1 : 0,
              transform: phaseReached('fun-facts') ? 'translateY(0)' : 'translateY(20px)'
            }}
          >
            <div className="p-5 rounded-xl" style={{ backgroundColor: '#dcfce7' }}>
              <div className="text-3xl font-bold" style={{ color: '#166534' }}>
                {correctAnswers}
              </div>
              <div className="text-sm font-medium flex items-center justify-center space-x-1 mt-1" style={{ color: '#166534' }}>
                <CheckCircle size={16} style={{ color: '#166534' }} />
                <span>Correct</span>
              </div>
            </div>
            <div className="p-5 rounded-xl" style={{ backgroundColor: '#fee2e2' }}>
              <div className="text-3xl font-bold" style={{ color: '#dc2626' }}>
                {quizState.totalQuestions - correctAnswers}
              </div>
              <div className="text-sm font-medium flex items-center justify-center space-x-1 mt-1" style={{ color: '#dc2626' }}>
                <XCircle size={16} style={{ color: '#dc2626' }} />
                <span>Incorrect</span>
              </div>
            </div>
            <div className="p-5 rounded-xl" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)' }}>
              <div className="text-3xl font-bold" style={{ color: '#ea580c' }}>
                {bestStreak} 🔥
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: '#ea580c' }}>Best Streak</div>
            </div>
            <div className="p-5 rounded-xl" style={{ backgroundColor: '#dbeafe' }}>
              <div className="text-3xl font-bold" style={{ color: '#2563eb' }}>
                {averageTime}s ⚡
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: '#2563eb' }}>Avg Time</div>
            </div>
          </div>

          {/* ===== PHASE 3: Achievement Badges (pop in one by one) ===== */}
          {achievements.length > 0 && (
            <div
              className="flex flex-wrap justify-center gap-2 mt-5 transition-all duration-500"
              style={{
                opacity: phaseReached('achievements') ? 1 : 0,
                transform: phaseReached('achievements') ? 'translateY(0)' : 'translateY(20px)'
              }}
            >
              {achievements.map((achievement, index) => (
                <span
                  key={index}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full text-base font-semibold transition-all duration-500"
                  style={{
                    backgroundColor: achievement.style.backgroundColor,
                    color: achievement.style.color as string,
                    opacity: phaseReached('achievements') ? 1 : 0,
                    transform: phaseReached('achievements') ? 'scale(1)' : 'scale(0.5)',
                    transitionDelay: `${index * 200}ms`
                  }}
                >
                  <span>{achievement.emoji}</span>
                  <span>{achievement.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ===== PHASE 4: Full Results (question breakdown, leaderboard, actions) ===== */}
        <div
          className="transition-all duration-700"
          style={{
            opacity: phaseReached('full-results') ? 1 : 0,
            transform: phaseReached('full-results') ? 'translateY(0)' : 'translateY(30px)'
          }}
        >
          {/* Leaderboard Section (deferred until session ends) */}
          <div ref={leaderboardRef}>
            <LeaderboardSection resultsState={resultsState} sessionCompleted={sessionCompleted} liveParticipants={liveParticipants} refreshing={refreshingLeaderboard} />
          </div>

          {/* Question Breakdown - Collapsible for mobile */}
          <details
            className="rounded-2xl shadow-xl border mb-6 overflow-hidden"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderColor: 'var(--border-color)'
            }}
          >
            <summary className="p-4 cursor-pointer font-bold flex items-center space-x-2" style={{ color: '#1f2937' }}>
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
                      borderColor: answer.isCorrect ? '#22c55e' : '#ef4444',
                      backgroundColor: answer.isCorrect ? '#dcfce7' : '#fee2e2'
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {answer.isCorrect ? (
                          <span className="text-xl">✅</span>
                        ) : (
                          <span className="text-xl">❌</span>
                        )}
                        <span className="font-medium" style={{ color: '#1f2937' }}>Question {index + 1}</span>
                      </div>
                      <div className="text-base flex items-center space-x-1" style={{ color: '#6b7280' }}>
                        <Clock size={16} />
                        <span>{answer.timeSpent}s</span>
                      </div>
                    </div>

                    <p className="text-base mb-2 font-medium" style={{ color: '#1f2937' }}>{question.questionText}</p>

                    <div className="text-base space-y-1">
                      <div
                        className="flex items-center space-x-1"
                        style={{ color: answer.isCorrect ? '#166534' : '#dc2626' }}
                      >
                        <span className="font-medium">Your answer:</span>
                        <span>{question.options[answer.selectedAnswer] || 'No answer'}</span>
                      </div>
                      {!answer.isCorrect && (
                        <div className="flex items-center space-x-1" style={{ color: '#166534' }}>
                          <span className="font-medium">Correct:</span>
                          <span>{question.options[question.correctAnswer]}</span>
                        </div>
                      )}
                      {question.explanation && (
                        <div className="italic mt-2 p-2 rounded" style={{ color: '#6b7280', backgroundColor: 'rgba(255,255,255,0.5)' }}>
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
          <div className="space-y-3 pb-24">
            <button
              onClick={async () => {
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
                  try {
                    await navigator.clipboard.writeText(resultsText)
                    alert('Results copied to clipboard!')
                  } catch {
                    alert('Unable to copy to clipboard. Please copy your results manually.')
                  }
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
      </div>

      {/* Floating Certificate Download Button */}
      {organization?.settings?.enableAttendanceCertificates && phaseReached('full-results') && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500"
          style={{
            opacity: phaseReached('full-results') ? 1 : 0,
            transform: `translateX(-50%) ${phaseReached('full-results') ? 'translateY(0)' : 'translateY(20px)'}`
          }}
        >
          <button
            onClick={handleCertificateDownload}
            className="flex items-center gap-2 py-3 px-6 rounded-full font-bold text-base shadow-2xl transition-transform active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
          >
            📋 Download Certificate
          </button>
        </div>
      )}
    </div>
  )
}

// ==================== SHARED LEADERBOARD ====================

const LeaderboardSection: React.FC<{
  resultsState: ResultsState
  sessionCompleted: boolean
  liveParticipants: Participant[] | null
  refreshing?: boolean
}> = ({ resultsState, sessionCompleted, liveParticipants, refreshing }) => {
  const { participantName, gameState } = resultsState
  const [leaderboardRevealed, setLeaderboardRevealed] = useState(false)
  const [showRevealBanner, setShowRevealBanner] = useState(false)

  // Reveal animation when session completes
  useEffect(() => {
    if (sessionCompleted && !refreshing && !leaderboardRevealed) {
      setShowRevealBanner(true)
      const timer = setTimeout(() => {
        setShowRevealBanner(false)
        setLeaderboardRevealed(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [sessionCompleted, refreshing])

  // Show waiting placeholder while session is still active
  if (!sessionCompleted) {
    return (
      <div
        className="rounded-2xl shadow-xl border p-6 mb-6 text-center"
        style={{
          backgroundColor: 'var(--surface-color)',
          borderColor: 'var(--accent-color)'
        }}
      >
        <div className="text-4xl mb-3 animate-bounce">⏳</div>
        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-color)' }}>
          Waiting for Final Rankings
        </h3>
        <p className="text-base" style={{ color: 'var(--text-secondary-color)' }}>
          The leaderboard will appear when the session ends.
          <br />Other participants may still be answering!
        </p>
        <div className="mt-4 flex justify-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)' }} />
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '0.3s' }} />
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '0.6s' }} />
        </div>
      </div>
    )
  }

  // Show "Results are in!" reveal banner
  if (showRevealBanner || refreshing) {
    return (
      <div
        className="rounded-2xl shadow-xl border p-6 mb-6 text-center"
        style={{
          backgroundColor: 'var(--surface-color)',
          borderColor: 'var(--accent-color)'
        }}
      >
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-color)' }}>
          {refreshing ? 'Refreshing Final Results...' : 'The results are in!'}
        </h3>
        <div className="mt-4 flex justify-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)' }} />
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '0.3s' }} />
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '0.6s' }} />
        </div>
      </div>
    )
  }

  // Use fresh participants if available (re-fetched when session ended), fall back to initial data
  const participants = liveParticipants || resultsState.allParticipants

  if (!participants || participants.length <= 1) {
    return null
  }

  const sortedParticipants = [...participants].sort(
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
        return { emoji: '🥇', bgColor: 'var(--warning-light-color)', textColor: 'var(--warning-color)' }
      case 2:
        return { emoji: '🥈', bgColor: 'var(--surface-hover-color)', textColor: 'var(--text-secondary-color)' }
      case 3:
        return { emoji: '🥉', bgColor: 'var(--warning-light-color)', textColor: 'var(--warning-color)' }
      default:
        return { emoji: '', bgColor: 'var(--surface-color)', textColor: 'var(--text-color)' }
    }
  }

  return (
    <div
      className="rounded-2xl shadow-xl border p-6 mb-6"
      style={{
        backgroundColor: 'var(--surface-color)',
        borderColor: 'var(--accent-color)'
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
            backgroundColor: myRank <= 3 ? getMedalStyle(myRank).bgColor : 'var(--primary-light-color)',
            borderColor: myRank <= 3 ? getMedalStyle(myRank).textColor : 'var(--primary-color)'
          }}
        >
          <div className="text-3xl font-bold mb-1" style={{ color: myRank <= 3 ? getMedalStyle(myRank).textColor : 'var(--primary-dark-color)' }}>
            {myRank <= 3 ? getMedalStyle(myRank).emoji : ''} #{myRank}
          </div>
          <p className="text-base" style={{ color: 'var(--text-secondary-color)' }}>
            out of {totalParticipants} participants
          </p>
          {beatPercentage > 0 && (
            <p className="text-base font-medium mt-1" style={{ color: 'var(--success-color)' }}>
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
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
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
            <div className="text-center py-2" style={{ color: 'var(--text-secondary-color)' }}>• • •</div>
            <div
              className="flex items-center justify-between p-3 rounded-xl ring-2 ring-offset-1"
              style={{
                backgroundColor: 'var(--primary-light-color)',
                ringColor: 'var(--primary-color)'
              }}
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)' }}
                >
                  {myRank}
                </div>
                <span className="font-medium" style={{ color: 'var(--primary-dark-color)' }}>
                  {participantName} (You)
                </span>
              </div>
              <span className="font-bold" style={{ color: 'var(--primary-dark-color)' }}>
                {gameState.score} pts
              </span>
            </div>
          </>
        )}
      </div>

      {/* Total Participants */}
      <div className="mt-4 pt-4 flex items-center justify-center space-x-2 text-base text-text-secondary" style={{ borderTop: '1px solid var(--border-color)' }}>
        <Users size={18} />
        <span>{totalParticipants} total participants</span>
      </div>
    </div>
  )
}

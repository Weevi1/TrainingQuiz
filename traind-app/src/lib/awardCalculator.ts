// Award calculation system for session results
// Calculates performance-based awards across all participants

import type { Participant } from './firestore'

export interface Award {
  id: string
  name: string
  description: string
  icon: 'trophy' | 'zap' | 'clock' | 'target' | 'star' | 'medal'
  recipients: AwardRecipient[]
  color: string
}

export interface AwardRecipient {
  participantId: string
  participantName: string
  value: number | string
  rank?: number
}

export interface AwardResults {
  awards: Award[]
  topPerformers: AwardRecipient[]
}

// Calculate all awards for a completed session
export function calculateSessionAwards(
  participants: Participant[],
  totalQuestions: number
): AwardResults {
  const awards: Award[] = []

  // Filter to participants who have game state with answers
  const validParticipants = participants.filter(
    p => p.gameState && p.gameState.answers && p.gameState.answers.length > 0
  )

  if (validParticipants.length === 0) {
    return { awards: [], topPerformers: [] }
  }

  // Calculate stats for each participant
  const participantStats = validParticipants.map(p => {
    const answers = p.gameState!.answers
    const correctAnswers = answers.filter(a => a.isCorrect).length
    const accuracy = (correctAnswers / answers.length) * 100
    const totalTime = answers.reduce((sum, a) => sum + a.timeSpent, 0)
    const avgTime = totalTime / answers.length

    // Calculate best streak
    let bestStreak = 0
    let currentStreak = 0
    for (const answer of answers) {
      if (answer.isCorrect) {
        currentStreak++
        bestStreak = Math.max(bestStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }

    // Calculate time consistency (standard deviation of response times)
    const times = answers.map(a => a.timeSpent)
    const meanTime = times.reduce((a, b) => a + b, 0) / times.length
    const variance = times.reduce((sum, t) => sum + Math.pow(t - meanTime, 2), 0) / times.length
    const timeStdDev = Math.sqrt(variance)

    return {
      id: p.id,
      name: p.name,
      score: p.gameState!.score || p.finalScore || 0,
      correctAnswers,
      accuracy,
      avgTime,
      totalTime,
      bestStreak,
      timeStdDev,
      answersCount: answers.length
    }
  })

  // Sort by score for top performers
  const sortedByScore = [...participantStats].sort((a, b) => b.score - a.score)

  // 1. Perfect Score Award - 100% accuracy
  const perfectScorers = participantStats.filter(p => p.accuracy === 100)
  if (perfectScorers.length > 0) {
    awards.push({
      id: 'perfect-score',
      name: 'Perfect Score',
      description: 'Answered every question correctly',
      icon: 'trophy',
      color: 'var(--gold-color, #fbbf24)',
      recipients: perfectScorers.map(p => ({
        participantId: p.id,
        participantName: p.name,
        value: '100%'
      }))
    })
  }

  // 2. Speed Demon Award - Fastest average response time (min 80% accuracy)
  const fastParticipants = participantStats.filter(p => p.accuracy >= 80)
  if (fastParticipants.length > 0) {
    const fastest = [...fastParticipants].sort((a, b) => a.avgTime - b.avgTime)[0]
    awards.push({
      id: 'speed-demon',
      name: 'Speed Demon',
      description: 'Fastest average response time with 80%+ accuracy',
      icon: 'clock',
      color: 'var(--primary-color, #3b82f6)',
      recipients: [{
        participantId: fastest.id,
        participantName: fastest.name,
        value: `${fastest.avgTime.toFixed(1)}s avg`
      }]
    })
  }

  // 3. Streak Master Award - Longest streak of correct answers
  const longestStreak = Math.max(...participantStats.map(p => p.bestStreak))
  if (longestStreak >= 3) {
    const streakMasters = participantStats.filter(p => p.bestStreak === longestStreak)
    awards.push({
      id: 'streak-master',
      name: 'Streak Master',
      description: 'Longest streak of consecutive correct answers',
      icon: 'zap',
      color: 'var(--streak-color, #f97316)',
      recipients: streakMasters.map(p => ({
        participantId: p.id,
        participantName: p.name,
        value: `${p.bestStreak} streak`
      }))
    })
  }

  // 4. Photo Finish Award - Closest competition (small score difference at top)
  if (sortedByScore.length >= 2) {
    const scoreDiff = sortedByScore[0].score - sortedByScore[1].score
    // Award if difference is 100 points or less (1 question)
    if (scoreDiff <= 100 && scoreDiff > 0) {
      awards.push({
        id: 'photo-finish',
        name: 'Photo Finish',
        description: 'Won by the narrowest margin',
        icon: 'target',
        color: 'var(--celebration-color, #8b5cf6)',
        recipients: [{
          participantId: sortedByScore[0].id,
          participantName: sortedByScore[0].name,
          value: `Won by ${scoreDiff} pts`
        }]
      })
    }
  }

  // 5. Consistent Performer Award - Most consistent response times (lowest std dev, min 5 answers)
  const consistentCandidates = participantStats.filter(p => p.answersCount >= 5 && p.accuracy >= 60)
  if (consistentCandidates.length > 0) {
    const mostConsistent = [...consistentCandidates].sort((a, b) => a.timeStdDev - b.timeStdDev)[0]
    if (mostConsistent.timeStdDev < 10) { // Only award if reasonably consistent
      awards.push({
        id: 'consistent-performer',
        name: 'Consistent Performer',
        description: 'Most consistent response timing',
        icon: 'star',
        color: 'var(--secondary-color, #1e40af)',
        recipients: [{
          participantId: mostConsistent.id,
          participantName: mostConsistent.name,
          value: `±${mostConsistent.timeStdDev.toFixed(1)}s`
        }]
      })
    }
  }

  // 6. Knowledge Expert - High accuracy (90%+) but not perfect
  const experts = participantStats.filter(p => p.accuracy >= 90 && p.accuracy < 100)
  if (experts.length > 0) {
    awards.push({
      id: 'knowledge-expert',
      name: 'Knowledge Expert',
      description: 'Achieved 90%+ accuracy',
      icon: 'medal',
      color: 'var(--success-color, #10b981)',
      recipients: experts.map(p => ({
        participantId: p.id,
        participantName: p.name,
        value: `${p.accuracy.toFixed(0)}%`
      }))
    })
  }

  // 7. Most Improved - Placeholder for future implementation with historical data
  // Would compare to previous sessions

  // Build top performers list (top 3)
  const topPerformers: AwardRecipient[] = sortedByScore.slice(0, 3).map((p, index) => ({
    participantId: p.id,
    participantName: p.name,
    value: p.score,
    rank: index + 1
  }))

  return { awards, topPerformers }
}

// Calculate bingo-specific awards for a completed session
export function calculateBingoAwards(
  participants: Participant[]
): AwardResults {
  const awards: Award[] = []

  // Filter to participants who have bingo game state
  const validParticipants = participants.filter(
    p => p.gameState && p.gameState.gameType === 'bingo'
  )

  if (validParticipants.length === 0) {
    return { awards: [], topPerformers: [] }
  }

  // Extract bingo stats for each participant
  const participantStats = validParticipants.map(p => ({
    id: p.id,
    name: p.name,
    score: p.gameState!.score || p.finalScore || 0,
    cellsMarked: p.gameState!.cellsMarked || 0,
    totalCells: p.gameState!.totalCells || 25,
    linesCompleted: p.gameState!.linesCompleted || 0,
    fullCardAchieved: p.gameState!.fullCardAchieved || false,
    bestStreak: p.gameState!.bestStreak || 0,
    timeToFirstBingo: p.gameState!.timeToFirstBingo ?? null,
    timeSpent: p.gameState!.timeSpent || 0,
    gameWon: p.gameState!.gameWon || false
  }))

  // Sort by score for top performers
  const sortedByScore = [...participantStats].sort((a, b) => b.score - a.score)

  // 1. BINGO Champion - Highest score among winners
  const winners = participantStats.filter(p => p.gameWon)
  if (winners.length > 0) {
    const champion = [...winners].sort((a, b) => b.score - a.score)[0]
    awards.push({
      id: 'bingo-champion',
      name: 'BINGO Champion',
      description: 'Highest score among bingo winners',
      icon: 'trophy',
      color: 'var(--gold-color, #fbbf24)',
      recipients: [{
        participantId: champion.id,
        participantName: champion.name,
        value: `${champion.score} pts`
      }]
    })
  }

  // 2. Speed Bingo - Fastest to first bingo
  const withBingoTime = participantStats.filter(p => p.timeToFirstBingo !== null && p.timeToFirstBingo > 0)
  if (withBingoTime.length > 0) {
    const fastest = [...withBingoTime].sort((a, b) => a.timeToFirstBingo! - b.timeToFirstBingo!)[0]
    const minutes = Math.floor(fastest.timeToFirstBingo! / 60)
    const seconds = fastest.timeToFirstBingo! % 60
    awards.push({
      id: 'speed-bingo',
      name: 'Speed Bingo',
      description: 'Fastest to achieve BINGO',
      icon: 'clock',
      color: 'var(--primary-color, #3b82f6)',
      recipients: [{
        participantId: fastest.id,
        participantName: fastest.name,
        value: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
      }]
    })
  }

  // 3. Full Card - Marked all cells
  const fullCardAchievers = participantStats.filter(p => p.fullCardAchieved)
  if (fullCardAchievers.length > 0) {
    awards.push({
      id: 'full-card',
      name: 'Full Card',
      description: 'Marked every cell on the bingo card',
      icon: 'target',
      color: 'var(--celebration-color, #8b5cf6)',
      recipients: fullCardAchievers.map(p => ({
        participantId: p.id,
        participantName: p.name,
        value: `${p.totalCells}/${p.totalCells} cells`
      }))
    })
  }

  // 4. Pattern Master - Most lines completed
  const maxLines = Math.max(...participantStats.map(p => p.linesCompleted))
  if (maxLines >= 1) {
    const patternMasters = participantStats.filter(p => p.linesCompleted === maxLines)
    awards.push({
      id: 'pattern-master',
      name: 'Pattern Master',
      description: 'Most bingo lines completed',
      icon: 'star',
      color: 'var(--streak-color, #f97316)',
      recipients: patternMasters.map(p => ({
        participantId: p.id,
        participantName: p.name,
        value: `${p.linesCompleted} line${p.linesCompleted !== 1 ? 's' : ''}`
      }))
    })
  }

  // 5. Streak Star - Longest marking streak
  const maxStreak = Math.max(...participantStats.map(p => p.bestStreak))
  if (maxStreak >= 3) {
    const streakStars = participantStats.filter(p => p.bestStreak === maxStreak)
    awards.push({
      id: 'streak-star',
      name: 'Streak Star',
      description: 'Longest consecutive marking streak',
      icon: 'zap',
      color: 'var(--success-color, #10b981)',
      recipients: streakStars.map(p => ({
        participantId: p.id,
        participantName: p.name,
        value: `${p.bestStreak} streak`
      }))
    })
  }

  // Build top performers list (top 3 by score)
  const topPerformers: AwardRecipient[] = sortedByScore.slice(0, 3).map((p, index) => ({
    participantId: p.id,
    participantName: p.name,
    value: p.score,
    rank: index + 1
  }))

  return { awards, topPerformers }
}

// Get icon component name for an award
export function getAwardIconColor(awardId: string): string {
  const colors: Record<string, string> = {
    'perfect-score': 'var(--gold-color, #fbbf24)',
    'speed-demon': 'var(--primary-color, #3b82f6)',
    'streak-master': 'var(--streak-color, #f97316)',
    'photo-finish': 'var(--celebration-color, #8b5cf6)',
    'consistent-performer': 'var(--secondary-color, #1e40af)',
    'knowledge-expert': 'var(--success-color, #10b981)',
    // Bingo awards
    'bingo-champion': 'var(--gold-color, #fbbf24)',
    'speed-bingo': 'var(--primary-color, #3b82f6)',
    'full-card': 'var(--celebration-color, #8b5cf6)',
    'pattern-master': 'var(--streak-color, #f97316)',
    'streak-star': 'var(--success-color, #10b981)'
  }
  return colors[awardId] || 'var(--text-secondary-color)'
}

// Format award value for display
export function formatAwardValue(value: number | string): string {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return value
}

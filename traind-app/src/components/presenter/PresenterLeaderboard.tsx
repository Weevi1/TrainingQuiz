import React from 'react'
import { Users } from 'lucide-react'
import type { Participant, Quiz } from '../../lib/firestore'
import { AvatarDisplay } from '../AvatarDisplay'

interface PresenterLeaderboardProps {
  participants: Participant[]
  quiz: Quiz | null
  isBingoSession: boolean
  animate?: boolean
}

interface LeaderboardEntry {
  participant: Participant
  rank: number
  pct: number
  avgTime: number
  bestStreak: number
  answeredCount: number
  correctCount: number
  totalQ: number
  isCompleted: boolean
  medal: string
}

function buildLeaderboard(
  participants: Participant[],
  quiz: Quiz | null,
  isBingoSession: boolean
): LeaderboardEntry[] {
  const totalQ = quiz?.questions.length || 1

  const sorted = participants.slice().sort((a, b) => {
    const scoreA = a.gameState?.score || a.finalScore || 0
    const scoreB = b.gameState?.score || b.finalScore || 0
    if (scoreB !== scoreA) return scoreB - scoreA

    const answersA = a.gameState?.answers || []
    const answersB = b.gameState?.answers || []
    const avgTimeA =
      answersA.length > 0
        ? answersA.reduce((s, ans) => s + (ans.timeSpent || 0), 0) / answersA.length
        : 999
    const avgTimeB =
      answersB.length > 0
        ? answersB.reduce((s, ans) => s + (ans.timeSpent || 0), 0) / answersB.length
        : 999

    return avgTimeA - avgTimeB
  })

  return sorted.map((participant, index) => {
    const rank = index + 1
    const answeredCount = participant.gameState?.answers?.length || 0
    const correctCount =
      participant.gameState?.answers?.filter((a) => a.isCorrect).length || 0

    const pct =
      answeredCount > 0
        ? Math.round((correctCount / totalQ) * 100)
        : 0

    const avgTime =
      answeredCount > 0
        ? Math.round(
            (participant.gameState?.answers?.reduce(
              (sum, a) => sum + (a.timeSpent || 0),
              0
            ) || 0) / answeredCount
          )
        : 0

    let bestStreak = 0
    let curStreak = 0
    ;(participant.gameState?.answers || []).forEach((a) => {
      if (a.isCorrect) {
        curStreak++
        bestStreak = Math.max(bestStreak, curStreak)
      } else {
        curStreak = 0
      }
    })

    const medal = rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : rank === 3 ? '\u{1F949}' : ''

    const isCompleted =
      participant.completed ||
      participant.gameState?.completed ||
      answeredCount >= totalQ ||
      (isBingoSession && (participant.gameState?.gameWon || participant.gameState?.fullCardAchieved || false))

    return {
      participant,
      rank,
      pct,
      avgTime,
      bestStreak,
      answeredCount,
      correctCount,
      totalQ,
      isCompleted,
      medal,
    }
  })
}

function getRankBackground(rank: number): string {
  switch (rank) {
    case 1: return 'rgba(251, 191, 36, 0.15)'
    case 2: return 'rgba(156, 163, 175, 0.15)'
    case 3: return 'rgba(217, 119, 6, 0.15)'
    default: return 'var(--surface-color)'
  }
}

export const PresenterLeaderboard: React.FC<PresenterLeaderboardProps> = ({
  participants,
  quiz,
  isBingoSession,
}) => {
  const entries = buildLeaderboard(participants, quiz, isBingoSession)

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center space-x-4 mb-4">
        <div
          className="p-2.5 rounded-xl"
          style={{ backgroundColor: 'var(--primary-color)' }}
        >
          <Users
            size={28}
            style={{ color: 'var(--text-on-primary-color, white)' }}
          />
        </div>
        <h2
          className="text-3xl font-bold"
          style={{ color: 'var(--text-color)' }}
        >
          Final Leaderboard
        </h2>
      </div>

      {/* Leaderboard rows — sized for projector readability */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.participant.id}
            className="flex items-center justify-between px-5 py-3 rounded-xl"
            style={{ backgroundColor: getRankBackground(entry.rank) }}
          >
            {/* Left: rank + avatar + name */}
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-12 text-center text-2xl font-bold flex-shrink-0">
                {entry.medal || entry.rank}
              </div>
              <AvatarDisplay avatar={(entry.participant as any).avatar} size="lg" className="flex-shrink-0" />
              <span
                className="text-2xl font-medium truncate"
                style={{ color: 'var(--text-color)' }}
              >
                {entry.participant.name}
              </span>
              {entry.isCompleted && (
                <span
                  className="text-base px-2.5 py-1 rounded-lg font-medium flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--success-light-color, #dcfce7)',
                    color: 'var(--success-color, #166534)',
                  }}
                >
                  Done
                </span>
              )}
            </div>

            {/* Right: score + avg time + streak — fixed-width columns for alignment */}
            <div className="flex items-center flex-shrink-0">
              <div className="w-[100px] text-right">
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: 'var(--primary-color)' }}
                >
                  {entry.pct}%
                </span>
              </div>
              <div className="w-[80px] text-right">
                <span
                  className="text-xl font-medium tabular-nums"
                  style={{ color: 'var(--text-secondary-color)' }}
                >
                  {entry.avgTime}s
                </span>
              </div>
              <div className="w-[80px] text-right">
                {entry.bestStreak >= 3 ? (
                  <span
                    className="text-xl"
                    style={{ color: 'var(--streak-color, #f97316)' }}
                  >
                    {'\u{1F525}'}{entry.bestStreak}
                  </span>
                ) : (
                  <span
                    className="text-xl"
                    style={{ color: 'var(--text-secondary-color)' }}
                  >
                    —
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {participants.length === 0 && (
          <p
            className="text-center py-6 text-xl"
            style={{ color: 'var(--text-secondary-color)' }}
          >
            No participants
          </p>
        )}
      </div>
    </div>
  )
}

export default PresenterLeaderboard

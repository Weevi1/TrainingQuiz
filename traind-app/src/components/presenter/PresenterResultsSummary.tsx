// PresenterResultsSummary — Cinematic single-frame results for projector
// Fills 1920×1080 canvas. Staged reveal: everything stays visible once shown.
// Layout: Full-width podium top → awards strip → leaderboard table bottom

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Trophy, Medal, Users } from 'lucide-react'
import type { Participant, Quiz } from '../../lib/firestore'
import type { Award, AwardRecipient, AwardResults } from '../../lib/awardCalculator'
import { AvatarDisplay } from '../AvatarDisplay'

type RevealStage = 'title' | 'podium' | 'awards' | 'leaderboard' | 'done'

interface Props {
  participants: Participant[]
  quiz: Quiz | null
  isBingoSession: boolean
  awardResults: AwardResults
  sessionStats: {
    totalParticipants: number
    averageScore: number
    completionRate: number
    averageTime: number
    completedCount: number
  }
  scoreFormatter: (value: number | string) => string
  timeFormatter: (seconds: number) => string
  getAwardIcon: (iconType: string, size?: number) => React.ReactNode
  orgLogo?: string
  orgName?: string
  onPhaseChange?: (phase: string) => void
}

// --- Animated counter ---
function useCountUp(target: number, durationMs: number, active: boolean): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) { setValue(0); return }
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, active])
  return value
}

// --- Leaderboard entry builder ---
function buildLeaderboard(participants: Participant[], totalQ: number) {
  return participants.slice().sort((a, b) => {
    const sA = a.gameState?.score || a.finalScore || 0
    const sB = b.gameState?.score || b.finalScore || 0
    if (sB !== sA) return sB - sA
    const avgA = a.gameState?.answers?.length ? a.gameState.answers.reduce((s, x) => s + (x.timeSpent || 0), 0) / a.gameState.answers.length : 999
    const avgB = b.gameState?.answers?.length ? b.gameState.answers.reduce((s, x) => s + (x.timeSpent || 0), 0) / b.gameState.answers.length : 999
    return avgA - avgB
  }).map((p, i) => {
    const rank = i + 1
    const answered = p.gameState?.answers?.length || 0
    const correct = p.gameState?.answers?.filter(a => a.isCorrect).length || 0
    const pct = answered > 0 ? Math.round((correct / totalQ) * 100) : 0
    const avgTime = answered > 0 ? Math.round((p.gameState?.answers?.reduce((s, a) => s + (a.timeSpent || 0), 0) || 0) / answered) : 0
    let best = 0, cur = 0
    ;(p.gameState?.answers || []).forEach(a => { if (a.isCorrect) { cur++; best = Math.max(best, cur) } else cur = 0 })
    return { participant: p, rank, pct, avgTime, bestStreak: best }
  })
}

// --- Main component ---

export const PresenterResultsSummary: React.FC<Props> = ({
  participants, quiz, isBingoSession, awardResults, sessionStats,
  scoreFormatter, timeFormatter, getAwardIcon, orgLogo, orgName, onPhaseChange,
}) => {
  const [stage, setStage] = useState<RevealStage>('title')
  const [podiumRevealed, setPodiumRevealed] = useState<Set<number>>(new Set())
  const [awardsRevealed, setAwardsRevealed] = useState(0)
  const [leaderboardRevealed, setLeaderboardRevealed] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const hasAwards = awardResults.awards.length > 0
  const hasPodium = entries.length > 0
  const bingoWinners = participants.filter(p => p.gameState?.gameWon).length

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []
  }, [])

  const totalQ = quiz?.questions.length || 1
  const entries = useMemo(() => buildLeaderboard(participants, totalQ), [participants, totalQ])

  // Animated stats
  const animAvg = useCountUp(sessionStats.averageScore, 1500, true)
  const animCompletion = useCountUp(sessionStats.completionRate, 1500, true)
  const animPlayers = useCountUp(sessionStats.totalParticipants, 800, true)

  // Timeline orchestration
  useEffect(() => {
    clearTimers()
    const t = (fn: () => void, ms: number) => { timersRef.current.push(setTimeout(fn, ms)) }

    onPhaseChange?.('splash')

    let cursor = 1200
    if (hasPodium) {
      t(() => { setStage('podium'); onPhaseChange?.('podium') }, cursor)
      t(() => setPodiumRevealed(new Set([3])), cursor + 100)
      t(() => setPodiumRevealed(new Set([3, 2])), cursor + 700)
      t(() => setPodiumRevealed(new Set([3, 2, 1])), cursor + 1400)
      cursor += 2400
    }

    if (hasAwards) {
      t(() => { setStage('awards'); onPhaseChange?.('awards') }, cursor)
      for (let i = 0; i < awardResults.awards.length; i++) {
        t(() => setAwardsRevealed(i + 1), cursor + 200 + i * 600)
      }
      cursor += 200 + awardResults.awards.length * 600 + 400
    }

    t(() => { setStage('leaderboard'); setLeaderboardRevealed(true); onPhaseChange?.('leaderboard') }, cursor)
    t(() => { setStage('done'); onPhaseChange?.('stats') }, cursor + 1200)

    return clearTimers
  }, [hasPodium, hasAwards, awardResults.awards.length])

  const skipToEnd = () => {
    clearTimers()
    setPodiumRevealed(new Set([1, 2, 3]))
    setAwardsRevealed(awardResults.awards.length)
    setLeaderboardRevealed(true)
    setStage('done')
    onPhaseChange?.('stats')
  }

  // --- Podium layout helpers ---
  // Derive podium from the same sorted `entries` as the leaderboard table,
  // so podium and table rankings are always consistent (same sort, same data snapshot).
  const podiumPerformers: AwardRecipient[] = useMemo(() =>
    entries.slice(0, 3).map(e => ({
      participantId: e.participant.id,
      participantName: e.participant.name,
      value: e.participant.gameState?.score || e.participant.finalScore || 0,
      rank: e.rank,
    })),
    [entries]
  )
  const first = podiumPerformers[0]
  const second = podiumPerformers[1]
  const third = podiumPerformers[2]

  // Adaptive sizing: more participants = more space for leaderboard
  const manyParticipants = entries.length > 8
  const podiumHeight = manyParticipants ? 220 : 280

  const rankMedal = (r: number) => r === 1 ? '\u{1F947}' : r === 2 ? '\u{1F948}' : r === 3 ? '\u{1F949}' : String(r)
  const rankBg = (r: number) => r === 1 ? 'rgba(251,191,36,0.12)' : r === 2 ? 'rgba(156,163,175,0.1)' : r === 3 ? 'rgba(217,119,6,0.1)' : 'transparent'

  // Row sizing for leaderboard
  const rowH = entries.length > 15 ? 36 : entries.length > 10 ? 42 : entries.length > 6 ? 48 : 56
  const nameSize = entries.length > 12 ? 'text-lg' : entries.length > 8 ? 'text-xl' : 'text-2xl'
  const scoreTextSize = entries.length > 12 ? 'text-lg' : entries.length > 8 ? 'text-xl' : 'text-2xl'

  return (
    <div
      className="relative flex flex-col h-full overflow-hidden"
      onClick={stage !== 'done' ? skipToEnd : undefined}
      style={{ cursor: stage !== 'done' ? 'pointer' : 'default' }}
    >
      {/* ═══ BACKGROUND GRADIENT ═══ */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top center, rgba(251,191,36,0.08) 0%, transparent 60%)',
        }}
      />

      {/* ═══ HEADER BAR ═══ */}
      <div
        className="relative flex items-center px-8 py-4 flex-shrink-0"
        style={{ animation: 'rsFadeDown 700ms ease-out both' }}
      >
        {orgLogo && (
          <img
            src={orgLogo}
            alt={orgName || ''}
            className="h-10 object-contain mr-5 flex-shrink-0"
            style={{ borderRadius: 'var(--logo-border-radius, 0)' }}
          />
        )}
        <Trophy size={32} style={{ color: 'var(--gold-color, #fbbf24)' }} className="mr-3 flex-shrink-0" />
        <h1 className="text-3xl font-bold flex-shrink-0" style={{ color: 'var(--text-color)' }}>
          Session Complete!
        </h1>

        <div className="flex-1" />

        {/* Stat counters — large and glowing */}
        <div className="flex items-center gap-5">
          {[
            { val: String(animPlayers), label: 'Players', color: 'var(--primary-color)' },
            { val: `${animAvg}%`, label: 'Avg Score', color: 'var(--success-color)' },
            isBingoSession
              ? { val: String(bingoWinners), label: 'BINGOs', color: 'var(--gold-color, #fbbf24)' }
              : { val: `${animCompletion}%`, label: 'Completion', color: 'var(--info-color, #2563eb)' },
            { val: timeFormatter(sessionStats.averageTime), label: 'Avg Time', color: 'var(--accent-color, #9333ea)' },
          ].map((s, i) => (
            <div
              key={s.label}
              className="text-center"
              style={{ animation: `rsFadeDown 600ms ease-out ${200 + i * 100}ms both` }}
            >
              <div className="text-3xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
              <div className="text-xs font-medium uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-secondary-color)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PODIUM — Full-width, dramatic ═══ */}
      {hasPodium && (
        <div
          className="relative flex-shrink-0 px-8"
          style={{
            height: podiumHeight,
            opacity: stage === 'title' ? 0 : 1,
            transition: 'opacity 500ms ease-out',
          }}
        >
          <div className="flex items-end justify-center h-full gap-6" style={{ paddingBottom: 8 }}>
            {/* 2nd place */}
            {second && (
              <PodiumColumn
                performer={second}
                rank={2}
                visible={podiumRevealed.has(2)}
                scoreFormatter={scoreFormatter}
                maxHeight={podiumHeight}
                compact={manyParticipants}
              />
            )}
            {/* 1st place */}
            {first && (
              <PodiumColumn
                performer={first}
                rank={1}
                visible={podiumRevealed.has(1)}
                scoreFormatter={scoreFormatter}
                maxHeight={podiumHeight}
                compact={manyParticipants}
              />
            )}
            {/* 3rd place */}
            {third && (
              <PodiumColumn
                performer={third}
                rank={3}
                visible={podiumRevealed.has(3)}
                scoreFormatter={scoreFormatter}
                maxHeight={podiumHeight}
                compact={manyParticipants}
              />
            )}
          </div>

          {/* Podium floor line */}
          <div
            className="absolute bottom-0 left-8 right-8 h-[2px]"
            style={{
              background: 'linear-gradient(to right, transparent, var(--border-color), transparent)',
            }}
          />
        </div>
      )}

      {/* ═══ AWARDS STRIP — Full-width horizontal ═══ */}
      {hasAwards && (
        <div
          className="relative flex-shrink-0 px-8 py-3"
          style={{
            opacity: awardsRevealed > 0 || stage === 'done' ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Medal size={20} style={{ color: 'var(--gold-color, #fbbf24)' }} />
            <span className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>Awards</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {awardResults.awards.map((award, i) => {
              const primary = award.recipients[0]
              const extra = award.recipients.length > 1 ? ` +${award.recipients.length - 1}` : ''
              const vis = i < awardsRevealed
              return (
                <div
                  key={award.id}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--surface-color)',
                    border: `2px solid ${vis ? award.color : 'transparent'}`,
                    opacity: vis ? 1 : 0,
                    transform: vis ? 'scale(1)' : 'scale(0.8)',
                    transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    minWidth: 200,
                  }}
                >
                  <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${award.color}15, transparent)` }} />
                  <div
                    className="relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: award.color, color: 'white', boxShadow: `0 0 12px ${award.color}40` }}
                  >
                    {getAwardIcon(award.icon, 20)}
                  </div>
                  <div className="relative min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-color)' }}>{award.name}</p>
                    <p className="text-base font-bold truncate" style={{ color: award.color }}>{primary.participantName}{extra}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ LEADERBOARD — Fills remaining space ═══ */}
      <div
        className="relative flex-1 min-h-0 px-8 pb-4 flex flex-col"
        style={{
          opacity: leaderboardRevealed || stage === 'done' ? 1 : 0.15,
          transition: 'opacity 600ms ease-out',
        }}
      >
        <div className="flex items-center gap-3 mb-2 flex-shrink-0">
          <Users size={22} style={{ color: 'var(--primary-color)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-color)' }}>Final Leaderboard</h2>
        </div>

        {/* Leaderboard rows — auto-sized to fill space */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {entries.map((e, i) => {
            // Score bar width (visual indicator)
            const barWidth = Math.max(e.pct, 2)

            return (
              <div
                key={e.participant.id}
                className="flex items-center rounded-xl px-4 relative overflow-hidden"
                style={{
                  height: rowH,
                  backgroundColor: rankBg(e.rank),
                  opacity: leaderboardRevealed ? 1 : 0,
                  transform: leaderboardRevealed ? 'translateX(0)' : 'translateX(30px)',
                  transition: `all 500ms ease-out ${i * 60}ms`,
                }}
              >
                {/* Score bar background */}
                <div
                  className="absolute inset-y-0 left-0 pointer-events-none"
                  style={{
                    width: `${barWidth}%`,
                    background: e.rank <= 3
                      ? `linear-gradient(to right, var(--primary-color)08, var(--primary-color)15)`
                      : 'linear-gradient(to right, var(--primary-color)05, var(--primary-color)08)',
                    transition: leaderboardRevealed ? `width 800ms ease-out ${400 + i * 60}ms` : 'none',
                    borderRadius: 'inherit',
                  }}
                />

                {/* Rank */}
                <div className="relative w-12 text-center flex-shrink-0">
                  <span className={`${e.rank <= 3 ? 'text-2xl' : `${nameSize} font-bold`}`}>
                    {rankMedal(e.rank)}
                  </span>
                </div>

                {/* Avatar + Name */}
                <div className="relative flex items-center gap-3 flex-1 min-w-0">
                  <AvatarDisplay avatar={(e.participant as any).avatar} size="sm" className="flex-shrink-0" />
                  <span
                    className={`${nameSize} font-semibold truncate`}
                    style={{ color: 'var(--text-color)' }}
                  >
                    {e.participant.name}
                  </span>
                </div>

                {/* Score — prominent */}
                <div className="relative w-24 text-right flex-shrink-0">
                  <span
                    className={`${scoreTextSize} font-bold tabular-nums`}
                    style={{ color: e.rank === 1 ? 'var(--gold-color, #fbbf24)' : 'var(--primary-color)' }}
                  >
                    {e.pct}%
                  </span>
                </div>

                {/* Time */}
                <div className="relative w-16 text-right flex-shrink-0">
                  <span className="text-base tabular-nums" style={{ color: 'var(--text-secondary-color)' }}>
                    {e.avgTime}s
                  </span>
                </div>

                {/* Streak */}
                <div className="relative w-14 text-right flex-shrink-0">
                  {e.bestStreak >= 3 ? (
                    <span className="text-base" style={{ color: 'var(--streak-color, #f97316)' }}>
                      {'\u{1F525}'}{e.bestStreak}
                    </span>
                  ) : (
                    <span className="text-base" style={{ color: 'var(--text-secondary-color)' }}>—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Skip hint */}
      {stage !== 'done' && (
        <div
          className="absolute bottom-4 right-8 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: 'rgba(0,0,0,0.25)',
            color: 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(6px)',
            animation: 'rsFadeDown 600ms ease-out 3s both',
          }}
        >
          Click to skip &rarr;
        </div>
      )}

      <style>{`
        @keyframes rsFadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rsGlowPulse {
          0%, 100% { filter: drop-shadow(0 0 6px var(--gold-color, #fbbf24)); }
          50% { filter: drop-shadow(0 0 16px var(--gold-color, #fbbf24)); }
        }
      `}</style>
    </div>
  )
}

// --- Podium column (full-width style) ---

const PodiumColumn: React.FC<{
  performer: AwardRecipient
  rank: number
  visible: boolean
  scoreFormatter: (v: number | string) => string
  maxHeight: number
  compact: boolean
}> = ({ performer, rank, visible, scoreFormatter, maxHeight, compact }) => {
  const heightFractions: Record<number, number> = { 1: 0.78, 2: 0.55, 3: 0.4 }
  const blockH = Math.round(maxHeight * heightFractions[rank])
  const colW = rank === 1 ? (compact ? 180 : 220) : (compact ? 150 : 180)

  const gradients: Record<number, string> = {
    1: 'linear-gradient(to top, #b8860b, var(--gold-color, #fbbf24), #fde68a)',
    2: 'linear-gradient(to top, #6b7280, var(--silver-color, #9ca3af), #e5e7eb)',
    3: 'linear-gradient(to top, #92400e, var(--bronze-color, #d97706), #fbbf24)',
  }

  const glows: Record<number, string> = {
    1: '0 -6px 40px rgba(251, 191, 36, 0.4), 0 0 60px rgba(251, 191, 36, 0.15)',
    2: '0 -4px 25px rgba(156, 163, 175, 0.25)',
    3: '0 -4px 25px rgba(217, 119, 6, 0.25)',
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{
        width: colW,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(80px)',
        transition: 'all 800ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* Trophy for #1 */}
      {rank === 1 && (
        <div style={{ animation: visible ? 'rsGlowPulse 2s ease-in-out infinite' : 'none' }} className="mb-1">
          <Trophy size={compact ? 32 : 40} style={{ color: 'var(--gold-color, #fbbf24)' }} />
        </div>
      )}

      {/* Name + score above block */}
      <p
        className={`${compact ? 'text-lg' : 'text-xl'} font-bold truncate w-full text-center mb-1`}
        style={{ color: 'var(--text-color)' }}
        title={performer.participantName}
      >
        {performer.participantName}
      </p>
      <p
        className={`${compact ? 'text-base' : 'text-lg'} font-bold mb-2`}
        style={{ color: rank === 1 ? 'var(--gold-color, #fbbf24)' : 'var(--primary-color)' }}
      >
        {scoreFormatter(performer.value)}
      </p>

      {/* Podium block */}
      <div
        className="w-full rounded-t-2xl flex items-center justify-center"
        style={{
          height: blockH,
          background: gradients[rank],
          boxShadow: glows[rank],
        }}
      >
        <span className={`${compact ? 'text-4xl' : 'text-5xl'} font-bold text-white/90 drop-shadow-lg`}>
          {rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : '\u{1F949}'}
        </span>
      </div>
    </div>
  )
}

export default PresenterResultsSummary

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RevealPhase = 'splash' | 'podium' | 'awards' | 'leaderboard' | 'stats'

const PHASE_ORDER: RevealPhase[] = ['splash', 'podium', 'awards', 'leaderboard', 'stats']

/** Duration each phase holds before auto-advancing (ms). */
const PHASE_DURATIONS: Partial<Record<RevealPhase, number>> = {
  splash: 4000,
  podium: 8000,
  // awards: dynamic — calculated from awardsCount (see getAwardsDuration)
  // leaderboard holds — no auto-advance (final resting slide)
  // stats is not a separate slide — it's combined with leaderboard
}

/** Awards reveal at 1500ms intervals. Hold 3s after the last one finishes. */
const AWARDS_REVEAL_INTERVAL = 1500
const AWARDS_HOLD_AFTER = 3000

function getAwardsDuration(count: number): number {
  if (count <= 0) return 2000
  return (count * AWARDS_REVEAL_INTERVAL) + AWARDS_HOLD_AFTER
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface RevealContextValue {
  phase: RevealPhase
  phaseIndex: number
}

const RevealContext = createContext<RevealContextValue | undefined>(undefined)

export function useRevealPhase(): RevealContextValue {
  const ctx = useContext(RevealContext)
  if (ctx === undefined) {
    throw new Error('useRevealPhase must be used within a <StagedReveal> component')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// RevealSlot — slideshow-style: only the CURRENT phase is visible
// ---------------------------------------------------------------------------

interface RevealSlotProps {
  phase: RevealPhase
  children: ReactNode
  className?: string
}

/**
 * Slideshow mode: only renders when this slot's phase is the CURRENT phase.
 * Each phase takes the full viewport — no accumulation, no scrolling.
 *
 * Exception: 'stats' phase is always shown alongside 'leaderboard'
 * (they share the final resting slide).
 */
export const RevealSlot: React.FC<RevealSlotProps> = ({ phase, children, className = '' }) => {
  const { phase: currentPhase, phaseIndex } = useRevealPhase()
  const slotPhaseIndex = PHASE_ORDER.indexOf(phase)

  // Stats is combined with leaderboard on the final slide
  const isStatsSlot = phase === 'stats'
  const isLeaderboardSlot = phase === 'leaderboard'
  const currentIsLeaderboardOrStats = currentPhase === 'leaderboard' || currentPhase === 'stats'

  // Show this slot if:
  // - It's the current phase, OR
  // - It's leaderboard/stats and we're on the final combined slide
  const isActive =
    currentPhase === phase ||
    ((isStatsSlot || isLeaderboardSlot) && currentIsLeaderboardOrStats)

  if (!isActive && phaseIndex < slotPhaseIndex) {
    // Not yet reached — don't render at all
    return null
  }

  if (!isActive) {
    // Phase has passed — hidden but keep in DOM briefly for fade-out
    return null
  }

  return (
    <div
      className={`staged-reveal-slot ${className}`}
      style={{
        animation: 'staged-reveal-enter 600ms ease-out both',
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StagedReveal — slideshow orchestration container
// ---------------------------------------------------------------------------

interface StagedRevealProps {
  children: ReactNode
  onPhaseChange?: (phase: RevealPhase) => void
  enabled?: boolean
  /** Number of awards — used to calculate dynamic awards slide duration */
  awardsCount?: number
}

export const StagedReveal: React.FC<StagedRevealProps> = ({
  children,
  onPhaseChange,
  enabled = true,
  awardsCount = 0
}) => {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasStarted = useRef(false)
  const onPhaseChangeRef = useRef(onPhaseChange)

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange
  }, [onPhaseChange])

  const currentPhase = PHASE_ORDER[phaseIndex]

  // Final slide reached (leaderboard is the last interactive phase)
  const isOnFinalSlide = phaseIndex >= PHASE_ORDER.indexOf('leaderboard')

  const clearPhaseTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const advance = useCallback(() => {
    setPhaseIndex(prev => Math.min(prev + 1, PHASE_ORDER.length - 1))
  }, [])

  // Kick off from splash when enabled
  useEffect(() => {
    if (!enabled || hasStarted.current) return
    hasStarted.current = true
    setPhaseIndex(0)
    onPhaseChangeRef.current?.(PHASE_ORDER[0])
  }, [enabled])

  // Auto-advance timer
  useEffect(() => {
    if (!enabled || !hasStarted.current) return

    clearPhaseTimer()

    const phase = PHASE_ORDER[phaseIndex]
    const duration = phase === 'awards'
      ? getAwardsDuration(awardsCount)
      : PHASE_DURATIONS[phase]

    onPhaseChangeRef.current?.(phase)

    if (duration !== undefined && phaseIndex < PHASE_ORDER.length - 1) {
      timerRef.current = setTimeout(advance, duration)
    }

    // When reaching leaderboard, auto-advance to stats after a beat
    // (stats renders alongside leaderboard on the same slide)
    if (phase === 'leaderboard') {
      timerRef.current = setTimeout(() => {
        setPhaseIndex(PHASE_ORDER.indexOf('stats'))
        onPhaseChangeRef.current?.('stats')
      }, 1200)
    }

    return clearPhaseTimer
  }, [phaseIndex, enabled, advance, clearPhaseTimer])

  // If not enabled, render everything immediately (no animation)
  if (!enabled) {
    return (
      <RevealContext.Provider value={{ phase: 'stats', phaseIndex: PHASE_ORDER.length - 1 }}>
        <div className="staged-reveal-container relative w-full h-full">
          {children}
        </div>
      </RevealContext.Provider>
    )
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('input')) return
    if (!isOnFinalSlide) {
      clearPhaseTimer()
      advance()
    }
  }

  return (
    <RevealContext.Provider value={{ phase: currentPhase, phaseIndex }}>
      <div
        className="staged-reveal-container relative w-full h-full cursor-pointer flex-1 flex flex-col"
        onClick={handleContainerClick}
      >
        {children}

        {/* Skip button — bottom-right */}
        {!isOnFinalSlide && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              clearPhaseTimer()
              advance()
            }}
            className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg text-sm font-medium
                       transition-opacity duration-300 hover:opacity-90 focus:outline-none
                       focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              color: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
            aria-label="Skip to next phase"
          >
            Skip &#9654;
          </button>
        )}

        <style>{`
          @keyframes staged-reveal-enter {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </RevealContext.Provider>
  )
}

export default StagedReveal

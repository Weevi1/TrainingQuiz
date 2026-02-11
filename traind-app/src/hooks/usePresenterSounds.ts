// usePresenterSounds - Synchronizes presenter celebration sounds with staged reveal phases.
//
// When the presenter results screen reveals content in sequence
// (splash -> podium -> awards -> leaderboard -> stats), this hook triggers
// the appropriate sound at each transition moment.

import { useEffect, useRef } from 'react'
import { soundSystem } from '../lib/soundSystem'

// Must match the RevealPhase type exported from ../components/presenter/StagedReveal
type RevealPhase = 'splash' | 'podium' | 'awards' | 'leaderboard' | 'stats'

interface UsePresenterSoundsOptions {
  /** Only play sounds if enabled (not muted). Defaults to true. */
  enabled?: boolean
  /** Number of awards to time individual achievement sounds for. Defaults to 0. */
  awardsCount?: number
}

/**
 * Triggers presenter sounds synchronized with the staged reveal phases.
 *
 * Sound mapping:
 *   splash      -> gameEnd (immediate)
 *   podium      -> fanfare (300ms delay)
 *   awards      -> achievement every 1500ms for each award
 *   leaderboard -> celebration (200ms delay)
 *   stats       -> (silent)
 *
 * Guarantees:
 *   - Each phase's sound plays at most once (tracked via a Set ref)
 *   - Does not play on initial render if the phase is already set
 *     (e.g., when staged reveal is disabled and phase starts past splash)
 *   - All pending timeouts and intervals are cleaned up on unmount or phase change
 */
export function usePresenterSounds(
  currentPhase: RevealPhase,
  options?: UsePresenterSoundsOptions
): void {
  const { enabled = true, awardsCount = 0 } = options ?? {}

  // Track the previous phase to detect actual transitions
  const prevPhaseRef = useRef<RevealPhase | null>(null)

  // Track which phases have already had their sounds played (prevents double-play)
  const playedPhasesRef = useRef<Set<RevealPhase>>(new Set())

  // Store active timeout/interval IDs for cleanup
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const awardsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Helper: schedule a timeout and track it for cleanup
  const scheduleTimeout = (fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay)
    timeoutsRef.current.push(id)
    return id
  }

  // Helper: clear all pending timeouts and the awards interval
  const clearAllTimers = () => {
    timeoutsRef.current.forEach(id => clearTimeout(id))
    timeoutsRef.current = []
    if (awardsIntervalRef.current !== null) {
      clearInterval(awardsIntervalRef.current)
      awardsIntervalRef.current = null
    }
  }

  useEffect(() => {
    // On the very first render, record the starting phase but don't play sounds.
    // This prevents sounds from firing if the component mounts with a phase
    // already past splash (e.g., staged reveal is disabled).
    if (prevPhaseRef.current === null) {
      prevPhaseRef.current = currentPhase
      return
    }

    // No change in phase — nothing to do
    if (currentPhase === prevPhaseRef.current) {
      return
    }

    // Phase changed — clear any timers from the previous phase
    clearAllTimers()

    // Update the previous phase ref
    prevPhaseRef.current = currentPhase

    // Don't play anything if sounds are disabled
    if (!enabled) {
      return
    }

    // Don't play a sound for a phase that already played (prevents double-play)
    if (playedPhasesRef.current.has(currentPhase)) {
      return
    }

    // Mark this phase as played
    playedPhasesRef.current.add(currentPhase)

    // Trigger the appropriate sound for this phase
    switch (currentPhase) {
      case 'splash':
        // Session complete fanfare — immediate
        soundSystem.play('gameEnd')
        break

      case 'podium':
        // Podium reveal fanfare — slight delay for visual sync
        scheduleTimeout(() => {
          soundSystem.play('fanfare')
        }, 300)
        break

      case 'awards': {
        // Play achievement sound immediately for the first award,
        // then repeat every 1500ms for each subsequent award
        if (awardsCount <= 0) break

        // First award sound — immediate
        soundSystem.play('achievement')
        let played = 1

        if (awardsCount > 1) {
          awardsIntervalRef.current = setInterval(() => {
            played++
            soundSystem.play('achievement')

            // Stop the interval once all awards have been announced
            if (played >= awardsCount) {
              if (awardsIntervalRef.current !== null) {
                clearInterval(awardsIntervalRef.current)
                awardsIntervalRef.current = null
              }
            }
          }, 1500)
        }
        break
      }

      case 'leaderboard':
        // Final celebration moment — small delay for visual sync
        scheduleTimeout(() => {
          soundSystem.play('celebration')
        }, 200)
        break

      case 'stats':
        // Stats appear silently — no sound
        break
    }
  }, [currentPhase, enabled, awardsCount])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export default usePresenterSounds

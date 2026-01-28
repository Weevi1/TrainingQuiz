// useGameTheme hook - Provides themed styles for game modules
import { useMemo } from 'react'
import { useBranding } from '../contexts/BrandingContext'
import type { GameThemeOverrides, ThemeColors } from '../lib/themePresets'

type GameType = 'millionaire' | 'bingo' | 'speedRound' | 'spotDifference'

// Style object types for each game
interface MillionaireStyles {
  container: React.CSSProperties
  header: React.CSSProperties
  questionArea: React.CSSProperties
  moneyLadder: React.CSSProperties
  lifelines: React.CSSProperties
  answerOption: React.CSSProperties
  answerOptionSelected: React.CSSProperties
  answerOptionCorrect: React.CSSProperties
  answerOptionWrong: React.CSSProperties
  accentText: React.CSSProperties
  accentBg: React.CSSProperties
}

interface BingoStyles {
  container: React.CSSProperties
  header: React.CSSProperties
  card: React.CSSProperties
  cell: React.CSSProperties
  cellMarked: React.CSSProperties
  cellFree: React.CSSProperties
  winBanner: React.CSSProperties
  streakBanner: React.CSSProperties
  accentText: React.CSSProperties
}

interface SpeedRoundStyles {
  container: React.CSSProperties
  header: React.CSSProperties
  timerArea: React.CSSProperties
  timerUrgent: React.CSSProperties
  questionCard: React.CSSProperties
  answerOption: React.CSSProperties
  answerOptionCorrect: React.CSSProperties
  answerOptionWrong: React.CSSProperties
  progressBar: React.CSSProperties
  streakBanner: React.CSSProperties
  accentText: React.CSSProperties
}

interface SpotDifferenceStyles {
  container: React.CSSProperties
  header: React.CSSProperties
  documentPanel: React.CSSProperties
  wordHighlight: React.CSSProperties
  wordFound: React.CSSProperties
  feedbackCorrect: React.CSSProperties
  feedbackIncorrect: React.CSSProperties
  progressBar: React.CSSProperties
  accentText: React.CSSProperties
}

// Return type based on game type
type GameStyles<T extends GameType> = T extends 'millionaire'
  ? MillionaireStyles
  : T extends 'bingo'
  ? BingoStyles
  : T extends 'speedRound'
  ? SpeedRoundStyles
  : T extends 'spotDifference'
  ? SpotDifferenceStyles
  : never

/**
 * Hook to get themed styles for game modules
 * All colors come from CSS variables, making games fully themeable
 */
export function useGameTheme<T extends GameType>(gameType: T): {
  styles: GameStyles<T>
  colors: ThemeColors
  gameTheme: GameThemeOverrides[T] | undefined
  // Utility classes using CSS variables
  classes: {
    correct: string
    incorrect: string
    selected: string
    streak: string
    celebration: string
  }
} {
  const { getColors, getGameTheme } = useBranding()
  const colors = getColors()
  const gameTheme = getGameTheme(gameType)

  const classes = useMemo(
    () => ({
      correct: 'answer-correct',
      incorrect: 'answer-wrong',
      selected: 'answer-selected',
      streak: 'enhance-streak',
      celebration: 'enhance-celebration'
    }),
    []
  )

  const styles = useMemo(() => {
    switch (gameType) {
      case 'millionaire':
        return {
          container: {
            background: 'var(--millionaire-container-gradient)',
            minHeight: '100vh',
            color: 'var(--text-on-primary-color)'
          },
          header: {
            borderBottom: '1px solid var(--primary-light-color)',
            backgroundColor: 'transparent'
          },
          questionArea: {
            background: 'var(--millionaire-question-bg)',
            borderRadius: 'var(--border-radius)'
          },
          moneyLadder: {
            backgroundColor: 'var(--millionaire-money-ladder-bg)',
            borderRadius: 'var(--border-radius)'
          },
          lifelines: {
            backgroundColor: 'var(--millionaire-lifeline-bg)',
            borderRadius: 'var(--border-radius)'
          },
          answerOption: {
            border: '2px solid var(--border-color)',
            backgroundColor: 'var(--surface-color)',
            borderRadius: 'var(--border-radius)',
            transition: 'all 0.3s ease'
          },
          answerOptionSelected: {
            borderColor: 'var(--millionaire-accent)',
            backgroundColor: 'color-mix(in srgb, var(--millionaire-accent) 20%, var(--surface-color))',
            boxShadow: '0 0 10px var(--millionaire-accent)'
          },
          answerOptionCorrect: {
            borderColor: 'var(--success-color)',
            backgroundColor: 'var(--success-light-color)',
            boxShadow: '0 0 15px var(--success-color)'
          },
          answerOptionWrong: {
            borderColor: 'var(--error-color)',
            backgroundColor: 'var(--error-light-color)',
            boxShadow: '0 0 15px var(--error-color)'
          },
          accentText: {
            color: 'var(--millionaire-accent)'
          },
          accentBg: {
            backgroundColor: 'var(--millionaire-accent)',
            color: 'var(--text-color)'
          }
        } as MillionaireStyles

      case 'bingo':
        return {
          container: {
            background: 'var(--bingo-container-gradient)',
            minHeight: '100vh',
            color: 'var(--text-on-primary-color)'
          },
          header: {
            borderBottom: '1px solid var(--primary-light-color)',
            backgroundColor: 'transparent'
          },
          card: {
            background: 'var(--bingo-card-bg)',
            borderRadius: 'var(--border-radius)'
          },
          cell: {
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            color: 'var(--text-color)',
            transition: 'all 0.3s ease'
          },
          cellMarked: {
            backgroundColor: 'var(--bingo-marked-cell)',
            borderColor: 'var(--success-color)',
            color: 'var(--text-on-primary-color)'
          },
          cellFree: {
            backgroundColor: 'var(--bingo-win-highlight)',
            borderColor: 'var(--warning-color)',
            color: 'var(--text-color)'
          },
          winBanner: {
            backgroundColor: 'var(--bingo-win-highlight)',
            color: 'var(--text-color)',
            borderRadius: 'var(--border-radius)'
          },
          streakBanner: {
            backgroundColor: 'var(--streak-color)',
            color: 'var(--text-on-primary-color)',
            borderRadius: 'var(--border-radius)'
          },
          accentText: {
            color: 'var(--bingo-win-highlight)'
          }
        } as BingoStyles

      case 'speedRound':
        return {
          container: {
            background: 'var(--speedround-container-gradient)',
            minHeight: '100vh',
            color: 'var(--text-on-primary-color)'
          },
          header: {
            borderBottom: '1px solid var(--primary-light-color)',
            backgroundColor: 'transparent'
          },
          timerArea: {
            background: 'var(--speedround-timer-bg)',
            borderRadius: 'var(--border-radius)'
          },
          timerUrgent: {
            backgroundColor: 'var(--error-light-color)',
            borderColor: 'var(--speedround-urgent)',
            color: 'var(--speedround-urgent)'
          },
          questionCard: {
            background: 'var(--speedround-question-bg)',
            borderRadius: 'var(--border-radius)',
            color: 'var(--text-color)'
          },
          answerOption: {
            border: '2px solid var(--border-color)',
            backgroundColor: 'var(--surface-color)',
            borderRadius: 'var(--border-radius)',
            color: 'var(--text-color)',
            transition: 'all 0.3s ease'
          },
          answerOptionCorrect: {
            borderColor: 'var(--success-color)',
            backgroundColor: 'var(--success-light-color)'
          },
          answerOptionWrong: {
            borderColor: 'var(--error-color)',
            backgroundColor: 'var(--error-light-color)'
          },
          progressBar: {
            backgroundColor: 'var(--primary-color)',
            height: '100%',
            borderRadius: 'var(--border-radius)',
            transition: 'width 0.3s ease'
          },
          streakBanner: {
            backgroundColor: 'var(--streak-color)',
            color: 'var(--text-on-primary-color)',
            borderRadius: 'var(--border-radius)'
          },
          accentText: {
            color: 'var(--game-accent-color)'
          }
        } as SpeedRoundStyles

      case 'spotDifference':
        return {
          container: {
            backgroundColor: 'var(--spotdiff-container-bg)',
            minHeight: '100vh',
            color: 'var(--text-color)'
          },
          header: {
            backgroundColor: 'var(--surface-color)',
            borderBottom: '1px solid var(--border-color)'
          },
          documentPanel: {
            backgroundColor: 'var(--spotdiff-document-bg)',
            borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)'
          },
          wordHighlight: {
            backgroundColor: 'var(--spotdiff-highlight)',
            borderRadius: '2px',
            cursor: 'pointer',
            padding: '0 2px'
          },
          wordFound: {
            backgroundColor: 'var(--spotdiff-found)',
            color: 'var(--success-color)'
          },
          feedbackCorrect: {
            backgroundColor: 'var(--success-light-color)',
            borderColor: 'var(--success-color)',
            color: 'var(--success-color)',
            borderRadius: 'var(--border-radius)'
          },
          feedbackIncorrect: {
            backgroundColor: 'var(--error-light-color)',
            borderColor: 'var(--error-color)',
            color: 'var(--error-color)',
            borderRadius: 'var(--border-radius)'
          },
          progressBar: {
            backgroundColor: 'var(--primary-color)',
            height: '100%',
            borderRadius: 'var(--border-radius)',
            transition: 'width 0.3s ease'
          },
          accentText: {
            color: 'var(--primary-color)'
          }
        } as SpotDifferenceStyles

      default:
        throw new Error(`Unknown game type: ${gameType}`)
    }
  }, [gameType])

  return {
    styles: styles as GameStyles<T>,
    colors,
    gameTheme: gameTheme as GameThemeOverrides[T] | undefined,
    classes
  }
}

/**
 * Utility hook to get just the feedback colors for answer states
 */
export function useFeedbackColors() {
  const { getColors } = useBranding()
  const colors = getColors()

  return useMemo(
    () => ({
      success: colors.success,
      successLight: colors.successLight,
      error: colors.error,
      errorLight: colors.errorLight,
      warning: colors.warning,
      warningLight: colors.warningLight,
      // CSS class names for states
      correctClass: 'answer-correct',
      incorrectClass: 'answer-wrong',
      selectedClass: 'answer-selected'
    }),
    [colors]
  )
}

/**
 * Get inline style for correct answer feedback
 */
export function getCorrectStyle(): React.CSSProperties {
  return {
    borderColor: 'var(--success-color)',
    backgroundColor: 'var(--success-light-color)',
    boxShadow: '0 0 10px var(--success-color)'
  }
}

/**
 * Get inline style for incorrect answer feedback
 */
export function getIncorrectStyle(): React.CSSProperties {
  return {
    borderColor: 'var(--error-color)',
    backgroundColor: 'var(--error-light-color)',
    boxShadow: '0 0 10px var(--error-color)'
  }
}

/**
 * Get inline style for selected answer
 */
export function getSelectedStyle(): React.CSSProperties {
  return {
    borderColor: 'var(--game-accent-color)',
    backgroundColor: 'color-mix(in srgb, var(--game-accent-color) 20%, transparent)',
    boxShadow: '0 0 8px var(--game-accent-color)'
  }
}

export default useGameTheme

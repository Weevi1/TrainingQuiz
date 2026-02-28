// Interstitial animation presets and templates
// Used by QuizBuilder (configuration) and InterstitialOverlay (rendering)

// Curated sound options suitable for interstitials
export const INTERSTITIAL_SOUND_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'ding', label: 'Ding' },
  { value: 'whoosh', label: 'Whoosh' },
  { value: 'fanfare', label: 'Fanfare' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'streak', label: 'Streak' },
  { value: 'gameStart', label: 'Game Start' },
]

// Pre-built templates for auto-add (uses built-in animation IDs)
// atFraction: position as fraction of total questions (-1 = before last)
export interface InterstitialTemplate {
  text: string
  animationId: string       // Built-in animation ID from builtInAnimations.ts
  animationType: 'builtin'
  atFraction: number
}

export const INTERSTITIAL_TEMPLATES: InterstitialTemplate[] = [
  { text: 'Let\'s go!', animationId: 'rocket-launch', animationType: 'builtin', atFraction: 0 },
  { text: 'You\'re doing great!', animationId: 'flame-fire', animationType: 'builtin', atFraction: 0.25 },
  { text: 'Halfway there!', animationId: 'star-burst', animationType: 'builtin', atFraction: 0.5 },
  { text: 'Almost done!', animationId: 'lightning-bolt', animationType: 'builtin', atFraction: 0.75 },
  { text: 'Final question!', animationId: 'trophy', animationType: 'builtin', atFraction: -1 },
]

/**
 * Calculate interstitial positions from templates for a given question count.
 * Only uses animations that are enabled for the tenant.
 * Returns beforeQuestionIndex values.
 */
export const calculateTemplatePositions = (
  totalQuestions: number,
  enabledAnimationIds?: string[]
): { template: InterstitialTemplate; beforeIndex: number }[] => {
  if (totalQuestions < 3) return [] // Too few questions for interstitials

  const templates = enabledAnimationIds
    ? INTERSTITIAL_TEMPLATES.filter(t =>
        t.animationType === 'builtin' && enabledAnimationIds.includes(t.animationId)
      )
    : INTERSTITIAL_TEMPLATES

  return templates
    .map(template => {
      let beforeIndex: number
      if (template.atFraction === 0) {
        beforeIndex = 0
      } else if (template.atFraction === -1) {
        beforeIndex = totalQuestions - 1
      } else {
        beforeIndex = Math.round(template.atFraction * totalQuestions)
      }
      // Clamp to valid range
      beforeIndex = Math.max(0, Math.min(totalQuestions - 1, beforeIndex))
      return { template, beforeIndex }
    })
    // Deduplicate: if two templates map to the same index, keep the first
    .filter((item, i, arr) => arr.findIndex(x => x.beforeIndex === item.beforeIndex) === i)
}

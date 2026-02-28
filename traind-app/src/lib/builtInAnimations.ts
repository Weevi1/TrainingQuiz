// Built-in Lottie animation registry for interstitial breaks
// Platform admin curates which of these are available per tenant in BrandingEditor

export type AnimationCategory = 'celebration' | 'motivational' | 'transition' | 'milestone'

export interface BuiltInAnimation {
  id: string
  label: string
  category: AnimationCategory
  filename: string                // .lottie file in /animations/
  defaultSound: string            // SoundType from soundSystem
  defaultDurationMs: number       // How long to show
}

export const BUILT_IN_ANIMATIONS: BuiltInAnimation[] = [
  // Celebration
  { id: 'confetti-burst', label: 'Confetti Burst', category: 'celebration', filename: 'confetti-burst.lottie', defaultSound: 'celebration', defaultDurationMs: 3000 },
  { id: 'fireworks', label: 'Fireworks', category: 'celebration', filename: 'fireworks.lottie', defaultSound: 'fanfare', defaultDurationMs: 3500 },
  { id: 'party-popper', label: 'Party Popper', category: 'celebration', filename: 'party-popper.lottie', defaultSound: 'celebration', defaultDurationMs: 2500 },

  // Motivational
  { id: 'thumbs-up', label: 'Thumbs Up', category: 'motivational', filename: 'thumbs-up.lottie', defaultSound: 'achievement', defaultDurationMs: 2500 },
  { id: 'star-burst', label: 'Star Burst', category: 'motivational', filename: 'star-burst.lottie', defaultSound: 'streak', defaultDurationMs: 2500 },
  { id: 'flame-fire', label: 'On Fire', category: 'motivational', filename: 'flame-fire.lottie', defaultSound: 'streak', defaultDurationMs: 2500 },

  // Transition
  { id: 'rocket-launch', label: 'Rocket Launch', category: 'transition', filename: 'rocket-launch.lottie', defaultSound: 'whoosh', defaultDurationMs: 3000 },
  { id: 'lightning-bolt', label: 'Lightning Bolt', category: 'transition', filename: 'lightning-bolt.lottie', defaultSound: 'whoosh', defaultDurationMs: 2000 },
  { id: 'countdown-timer', label: 'Countdown', category: 'transition', filename: 'countdown-timer.lottie', defaultSound: 'ding', defaultDurationMs: 3000 },

  // Milestone
  { id: 'trophy', label: 'Trophy', category: 'milestone', filename: 'trophy.lottie', defaultSound: 'fanfare', defaultDurationMs: 3000 },
  { id: 'checkmark-success', label: 'Checkmark', category: 'milestone', filename: 'checkmark-success.lottie', defaultSound: 'achievement', defaultDurationMs: 2000 },
  { id: 'clapping-hands', label: 'Clapping Hands', category: 'milestone', filename: 'clapping-hands.lottie', defaultSound: 'celebration', defaultDurationMs: 3000 },
]

export const ANIMATION_CATEGORIES: { value: AnimationCategory; label: string }[] = [
  { value: 'celebration', label: 'Celebration' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'transition', label: 'Transition' },
  { value: 'milestone', label: 'Milestone' },
]

/** Get a built-in animation by ID */
export function getBuiltInAnimation(id: string): BuiltInAnimation | undefined {
  return BUILT_IN_ANIMATIONS.find(a => a.id === id)
}

/** Get the URL for a built-in animation's .lottie file (served from /animations/) */
export function getBuiltInAnimationUrl(id: string): string {
  const anim = getBuiltInAnimation(id)
  return anim ? `/animations/${anim.filename}` : ''
}

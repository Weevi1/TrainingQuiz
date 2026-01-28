// Enhanced visual effects and animation system for training games

export type EffectType =
  | 'correct-pulse'
  | 'wrong-shake'
  | 'celebration-confetti'
  | 'streak-fire'
  | 'achievement-burst'
  | 'timer-warning'
  | 'score-count-up'
  | 'screen-flash'
  | 'particle-explosion'
  | 'glow-effect'

interface ParticleOptions {
  count: number
  colors: string[]
  duration: number
  spread: number
  gravity: boolean
}

interface AnimationOptions {
  duration: number
  easing: string
  delay: number
}

class VisualEffectsSystem {
  private particleContainer: HTMLElement | null = null

  constructor() {
    this.createParticleContainer()
  }

  private createParticleContainer() {
    this.particleContainer = document.createElement('div')
    this.particleContainer.id = 'visual-effects-container'
    this.particleContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `
    document.body.appendChild(this.particleContainer)
  }

  // Apply visual effect to specific element
  applyEffect(element: HTMLElement, effectType: EffectType, options?: Partial<AnimationOptions>) {
    switch (effectType) {
      case 'correct-pulse':
        this.correctPulse(element, options)
        break
      case 'wrong-shake':
        this.wrongShake(element, options)
        break
      case 'streak-fire':
        this.streakFire(element, options)
        break
      case 'timer-warning':
        this.timerWarning(element, options)
        break
      case 'glow-effect':
        this.glowEffect(element, options)
        break
      default:
        console.warn('Unknown effect type:', effectType)
    }
  }

  // Screen-wide effects
  triggerScreenEffect(effectType: EffectType, options?: any) {
    switch (effectType) {
      case 'celebration-confetti':
        this.celebrationConfetti(options)
        break
      case 'achievement-burst':
        this.achievementBurst(options)
        break
      case 'screen-flash':
        this.screenFlash(options?.color || '#4ade80')
        break
      case 'particle-explosion':
        this.particleExplosion(options)
        break
      default:
        console.warn('Unknown screen effect:', effectType)
    }
  }

  private correctPulse(element: HTMLElement, options?: Partial<AnimationOptions>) {
    const duration = options?.duration || 600
    const originalTransform = element.style.transform
    const originalBoxShadow = element.style.boxShadow

    element.style.transition = `transform ${duration}ms ease-out, box-shadow ${duration}ms ease-out`
    element.style.transform = `${originalTransform} scale(1.05)`
    element.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3)'

    setTimeout(() => {
      element.style.transform = originalTransform
      setTimeout(() => {
        element.style.boxShadow = originalBoxShadow
        element.style.transition = ''
      }, duration / 2)
    }, duration / 2)
  }

  private wrongShake(element: HTMLElement, options?: Partial<AnimationOptions>) {
    const duration = options?.duration || 500
    const originalTransform = element.style.transform
    const originalBoxShadow = element.style.boxShadow

    element.style.transition = `box-shadow ${duration}ms ease-out`
    element.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.3)'

    // Shake animation
    element.animate([
      { transform: `${originalTransform} translateX(0px)` },
      { transform: `${originalTransform} translateX(-10px)` },
      { transform: `${originalTransform} translateX(10px)` },
      { transform: `${originalTransform} translateX(-8px)` },
      { transform: `${originalTransform} translateX(8px)` },
      { transform: `${originalTransform} translateX(-6px)` },
      { transform: `${originalTransform} translateX(6px)` },
      { transform: `${originalTransform} translateX(0px)` }
    ], {
      duration: duration,
      easing: 'ease-out'
    })

    setTimeout(() => {
      element.style.boxShadow = originalBoxShadow
      element.style.transition = ''
    }, duration)
  }

  private streakFire(element: HTMLElement, options?: Partial<AnimationOptions>) {
    const duration = options?.duration || 800

    // Create flame particles around element
    const rect = element.getBoundingClientRect()
    const colors = ['#ff4500', '#ff6b35', '#f7931e', '#ffaa44']

    for (let i = 0; i < 8; i++) {
      this.createParticle({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 4,
        velocityX: (Math.random() - 0.5) * 100,
        velocityY: -Math.random() * 150 - 50,
        duration: duration,
        gravity: false
      })
    }

    // Add glow to element
    element.style.transition = `box-shadow ${duration}ms ease-out`
    element.style.boxShadow = '0 0 15px rgba(255, 69, 0, 0.8), 0 0 30px rgba(255, 165, 0, 0.4)'

    setTimeout(() => {
      element.style.boxShadow = ''
      element.style.transition = ''
    }, duration)
  }

  private timerWarning(element: HTMLElement, options?: Partial<AnimationOptions>) {
    const duration = options?.duration || 300

    // Pulsing red warning effect
    const pulseAnimation = element.animate([
      {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.5)',
        transform: 'scale(1)'
      },
      {
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
        borderColor: 'rgba(239, 68, 68, 1)',
        transform: 'scale(1.02)'
      },
      {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.5)',
        transform: 'scale(1)'
      }
    ], {
      duration: duration * 2,
      iterations: 3,
      easing: 'ease-in-out'
    })
  }

  private glowEffect(element: HTMLElement, options?: Partial<AnimationOptions>) {
    const duration = options?.duration || 1000

    element.style.transition = `box-shadow ${duration}ms ease-in-out`
    element.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.3)'

    setTimeout(() => {
      element.style.boxShadow = ''
      element.style.transition = ''
    }, duration)
  }

  private celebrationConfetti(options?: Partial<ParticleOptions>) {
    // Read theme colors from CSS variables for theme-aware celebrations
    const computedStyle = getComputedStyle(document.documentElement)
    const celebrationColor = computedStyle.getPropertyValue('--celebration-color').trim() || '#d4af37'
    const accentColor = computedStyle.getPropertyValue('--accent-color').trim() || '#c9a86c'
    const successColor = computedStyle.getPropertyValue('--success-color').trim() || '#10b981'
    const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#3b82f6'

    const config = {
      count: 50,
      colors: [celebrationColor, accentColor, successColor, primaryColor, '#ffffff'],
      duration: 3000,
      spread: 360,
      ...options
    }

    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 3

    for (let i = 0; i < config.count; i++) {
      const angle = (i / config.count) * Math.PI * 2
      const velocity = Math.random() * 300 + 200

      this.createParticle({
        x: centerX,
        y: centerY,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        size: Math.random() * 8 + 4,
        velocityX: Math.cos(angle) * velocity,
        velocityY: Math.sin(angle) * velocity,
        duration: config.duration,
        gravity: true,
        shape: Math.random() > 0.5 ? 'circle' : 'square'
      })
    }
  }

  private achievementBurst(options?: any) {
    // Read theme colors from CSS variables for theme-aware achievement bursts
    const computedStyle = getComputedStyle(document.documentElement)
    const goldColor = computedStyle.getPropertyValue('--gold-color').trim() || '#fbbf24'
    const accentColor = computedStyle.getPropertyValue('--accent-color').trim() || '#f59e0b'
    const celebrationColor = computedStyle.getPropertyValue('--celebration-color').trim() || '#d97706'
    const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#92400e'

    const colors = [goldColor, accentColor, celebrationColor, primaryColor]

    // Star burst pattern
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2

      this.createParticle({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        color: colors[i % colors.length],
        size: 8,
        velocityX: Math.cos(angle) * 400,
        velocityY: Math.sin(angle) * 400,
        duration: 2000,
        gravity: false,
        shape: 'star'
      })
    }
  }

  private screenFlash(color: string) {
    const flash = document.createElement('div')
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: ${color};
      opacity: 0.7;
      pointer-events: none;
      z-index: 10000;
    `

    document.body.appendChild(flash)

    flash.animate([
      { opacity: 0.7 },
      { opacity: 0 }
    ], {
      duration: 200,
      easing: 'ease-out'
    }).onfinish = () => {
      document.body.removeChild(flash)
    }
  }

  private particleExplosion(options?: any) {
    // Read theme colors from CSS variables for theme-aware particle explosions
    const computedStyle = getComputedStyle(document.documentElement)
    const goldColor = computedStyle.getPropertyValue('--gold-color').trim() || '#fbbf24'
    const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#3b82f6'

    const config = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      count: 30,
      colors: ['#ffffff', goldColor, primaryColor],
      ...options
    }

    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * Math.PI * 2
      const velocity = Math.random() * 200 + 100

      this.createParticle({
        x: config.x,
        y: config.y,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        size: Math.random() * 6 + 3,
        velocityX: Math.cos(angle) * velocity,
        velocityY: Math.sin(angle) * velocity,
        duration: 1500,
        gravity: false
      })
    }
  }

  private createParticle(options: {
    x: number
    y: number
    color: string
    size: number
    velocityX: number
    velocityY: number
    duration: number
    gravity: boolean
    shape?: 'circle' | 'square' | 'star'
  }) {
    if (!this.particleContainer) return

    const particle = document.createElement('div')
    const shape = options.shape || 'circle'

    let shapeStyles = ''
    if (shape === 'circle') {
      shapeStyles = 'border-radius: 50%;'
    } else if (shape === 'star') {
      shapeStyles = `
        clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
      `
    }

    particle.style.cssText = `
      position: absolute;
      left: ${options.x}px;
      top: ${options.y}px;
      width: ${options.size}px;
      height: ${options.size}px;
      background-color: ${options.color};
      pointer-events: none;
      ${shapeStyles}
    `

    this.particleContainer.appendChild(particle)

    // Animate particle
    const startTime = performance.now()
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = elapsed / options.duration

      if (progress >= 1) {
        this.particleContainer?.removeChild(particle)
        return
      }

      // Calculate position with physics
      let x = options.x + options.velocityX * (elapsed / 1000)
      let y = options.y + options.velocityY * (elapsed / 1000)

      if (options.gravity) {
        y += 0.5 * 980 * Math.pow(elapsed / 1000, 2) // gravity effect
      }

      // Fade out
      const opacity = 1 - progress

      particle.style.left = x + 'px'
      particle.style.top = y + 'px'
      particle.style.opacity = opacity.toString()

      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }

  // Score counting animation
  animateScoreCounter(element: HTMLElement, fromScore: number, toScore: number, duration: number = 1000) {
    const startTime = performance.now()
    const scoreDiff = toScore - fromScore

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for dramatic count-up
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentScore = Math.round(fromScore + (scoreDiff * easeOut))

      element.textContent = currentScore.toLocaleString()

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }

  // Clean up effects
  clearAllEffects() {
    if (this.particleContainer) {
      this.particleContainer.innerHTML = ''
    }
  }
}

// Singleton instance
export const visualEffects = new VisualEffectsSystem()

// React hook
export const useVisualEffects = () => {
  return {
    applyEffect: visualEffects.applyEffect.bind(visualEffects),
    triggerScreenEffect: visualEffects.triggerScreenEffect.bind(visualEffects),
    animateScoreCounter: visualEffects.animateScoreCounter.bind(visualEffects),
    clearAllEffects: visualEffects.clearAllEffects.bind(visualEffects)
  }
}

// CSS classes for enhanced animations
export const enhancedAnimationStyles = `
  @keyframes correct-glow {
    0% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3);
      transform: scale(1.05);
    }
    100% {
      box-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
      transform: scale(1);
    }
  }

  @keyframes wrong-shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
    20%, 40%, 60%, 80% { transform: translateX(8px); }
  }

  @keyframes streak-fire {
    0% {
      box-shadow: 0 0 10px rgba(255, 69, 0, 0.5);
      filter: hue-rotate(0deg);
    }
    25% {
      box-shadow: 0 0 20px rgba(255, 69, 0, 0.7);
      filter: hue-rotate(10deg);
    }
    50% {
      box-shadow: 0 0 30px rgba(255, 165, 0, 0.8);
      filter: hue-rotate(20deg);
    }
    75% {
      box-shadow: 0 0 25px rgba(255, 69, 0, 0.7);
      filter: hue-rotate(10deg);
    }
    100% {
      box-shadow: 0 0 15px rgba(255, 69, 0, 0.5);
      filter: hue-rotate(0deg);
    }
  }

  @keyframes timer-pulse {
    0% {
      background-color: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.5);
    }
    50% {
      background-color: rgba(239, 68, 68, 0.3);
      border-color: rgba(239, 68, 68, 1);
    }
    100% {
      background-color: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.5);
    }
  }

  .enhance-correct { animation: correct-glow 0.6s ease-out; }
  .enhance-wrong { animation: wrong-shake 0.5s ease-out; }
  .enhance-streak { animation: streak-fire 0.8s ease-in-out; }
  .enhance-timer-warning { animation: timer-pulse 0.3s ease-in-out infinite; }

  .score-counter {
    transition: all 0.3s ease-out;
    font-variant-numeric: tabular-nums;
  }

  .score-counter.updating {
    transform: scale(1.1);
    color: #10b981;
    font-weight: bold;
  }
`
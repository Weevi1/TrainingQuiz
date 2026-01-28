// Background Patterns Library - SVG patterns and gradients for theme backgrounds

export type PatternType =
  | 'dots'
  | 'grid'
  | 'diagonal-lines'
  | 'waves'
  | 'circuit'
  | 'hexagons'
  | 'triangles'
  | 'topography'
  | 'noise'
  | 'none'

export interface PatternConfig {
  type: PatternType
  color: string
  opacity: number
  scale?: number
}

export interface GradientConfig {
  type: 'linear' | 'radial'
  angle?: number // For linear gradients
  colors: Array<{
    color: string
    position: number // 0-100
  }>
}

// Pre-built patterns as data URIs
const patternGenerators: Record<PatternType, (color: string, opacity: number, scale: number) => string> = {
  dots: (color, opacity, scale) => {
    const size = 20 * scale
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="1.5" fill="${color}" fill-opacity="${opacity}"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  grid: (color, opacity, scale) => {
    const size = 40 * scale
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0h40v40H0z" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="0.5"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  'diagonal-lines': (color, opacity, scale) => {
    const size = 10 * scale
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="${color}" stroke-opacity="${opacity}" stroke-width="0.5"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  waves: (color, opacity, scale) => {
    const size = 100 * scale
    const svg = `<svg width="${size}" height="${size / 2}" viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 25 Q 25 0, 50 25 T 100 25" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  circuit: (color, opacity, scale) => {
    const size = 50 * scale
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 0v15M25 35v15M0 25h15M35 25h15" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1" fill="none"/>
      <circle cx="25" cy="25" r="3" fill="${color}" fill-opacity="${opacity}"/>
      <circle cx="25" cy="15" r="2" fill="${color}" fill-opacity="${opacity}"/>
      <circle cx="25" cy="35" r="2" fill="${color}" fill-opacity="${opacity}"/>
      <circle cx="15" cy="25" r="2" fill="${color}" fill-opacity="${opacity}"/>
      <circle cx="35" cy="25" r="2" fill="${color}" fill-opacity="${opacity}"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  hexagons: (color, opacity, scale) => {
    const size = 56 * scale
    const svg = `<svg width="${size}" height="${size * 0.86}" viewBox="0 0 56 48.5" xmlns="http://www.w3.org/2000/svg">
      <path d="M28 0L56 14v20L28 48.5 0 34V14z" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="0.5"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  triangles: (color, opacity, scale) => {
    const size = 40 * scale
    const svg = `<svg width="${size}" height="${size * 0.866}" viewBox="0 0 40 34.64" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 0L40 34.64H0z" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="0.5"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  topography: (color, opacity, scale) => {
    const size = 100 * scale
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 50 Q25 30 50 50 T100 50" fill="none" stroke="${color}" stroke-opacity="${opacity * 0.5}" stroke-width="0.5"/>
      <path d="M0 60 Q25 40 50 60 T100 60" fill="none" stroke="${color}" stroke-opacity="${opacity * 0.7}" stroke-width="0.5"/>
      <path d="M0 40 Q25 20 50 40 T100 40" fill="none" stroke="${color}" stroke-opacity="${opacity * 0.3}" stroke-width="0.5"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  noise: (color, opacity, _scale) => {
    // Subtle noise pattern using inline SVG filter
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncR type="linear" slope="${opacity}" intercept="0"/>
          <feFuncG type="linear" slope="${opacity}" intercept="0"/>
          <feFuncB type="linear" slope="${opacity}" intercept="0"/>
          <feFuncA type="linear" slope="${opacity * 0.5}"/>
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" fill="${color}"/>
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  },

  none: () => 'none'
}

/**
 * Generate a CSS background pattern
 */
export const generatePattern = (config: PatternConfig): string => {
  const { type, color, opacity, scale = 1 } = config

  if (type === 'none') {
    return 'none'
  }

  const generator = patternGenerators[type]
  if (!generator) {
    console.warn(`Unknown pattern type: ${type}`)
    return 'none'
  }

  return generator(color, opacity, scale)
}

/**
 * Generate a CSS gradient
 */
export const generateGradient = (config: GradientConfig): string => {
  const { type, angle = 180, colors } = config

  // Sort colors by position
  const sortedColors = [...colors].sort((a, b) => a.position - b.position)

  const colorStops = sortedColors
    .map(c => `${c.color} ${c.position}%`)
    .join(', ')

  if (type === 'linear') {
    return `linear-gradient(${angle}deg, ${colorStops})`
  } else {
    return `radial-gradient(circle, ${colorStops})`
  }
}

/**
 * Combine a gradient with a pattern overlay
 */
export const generateBackgroundWithPattern = (
  baseColor: string,
  pattern?: PatternConfig,
  gradient?: GradientConfig
): string => {
  const backgrounds: string[] = []

  // Add pattern as top layer if provided
  if (pattern && pattern.type !== 'none') {
    backgrounds.push(generatePattern(pattern))
  }

  // Add gradient or solid color as base layer
  if (gradient) {
    backgrounds.push(generateGradient(gradient))
  } else {
    backgrounds.push(baseColor)
  }

  return backgrounds.join(', ')
}

// Pre-defined gradient presets
export const gradientPresets = {
  // Light gradients
  'light-blue': {
    type: 'linear' as const,
    angle: 135,
    colors: [
      { color: '#f0f9ff', position: 0 },
      { color: '#e0f2fe', position: 100 }
    ]
  },
  'light-purple': {
    type: 'linear' as const,
    angle: 135,
    colors: [
      { color: '#faf5ff', position: 0 },
      { color: '#f3e8ff', position: 100 }
    ]
  },
  'warm-light': {
    type: 'linear' as const,
    angle: 135,
    colors: [
      { color: '#fffbeb', position: 0 },
      { color: '#fef3c7', position: 100 }
    ]
  },

  // Dark gradients
  'dark-blue': {
    type: 'linear' as const,
    angle: 180,
    colors: [
      { color: '#0f172a', position: 0 },
      { color: '#1e293b', position: 100 }
    ]
  },
  'dark-purple': {
    type: 'linear' as const,
    angle: 135,
    colors: [
      { color: '#1e1b4b', position: 0 },
      { color: '#4c1d95', position: 100 }
    ]
  },
  'dark-teal': {
    type: 'linear' as const,
    angle: 180,
    colors: [
      { color: '#134e4a', position: 0 },
      { color: '#0f172a', position: 100 }
    ]
  },

  // Vibrant gradients
  'sunset': {
    type: 'linear' as const,
    angle: 135,
    colors: [
      { color: '#f97316', position: 0 },
      { color: '#ec4899', position: 100 }
    ]
  },
  'ocean': {
    type: 'linear' as const,
    angle: 135,
    colors: [
      { color: '#06b6d4', position: 0 },
      { color: '#3b82f6', position: 100 }
    ]
  },
  'forest': {
    type: 'linear' as const,
    angle: 135,
    colors: [
      { color: '#16a34a', position: 0 },
      { color: '#15803d', position: 100 }
    ]
  },

  // Radial gradients
  'spotlight': {
    type: 'radial' as const,
    colors: [
      { color: 'rgba(255, 255, 255, 0.1)', position: 0 },
      { color: 'rgba(0, 0, 0, 0)', position: 70 }
    ]
  }
}

// Pre-defined pattern presets
export const patternPresets: Record<string, PatternConfig> = {
  'subtle-dots': {
    type: 'dots',
    color: '#000000',
    opacity: 0.05,
    scale: 1
  },
  'light-grid': {
    type: 'grid',
    color: '#000000',
    opacity: 0.03,
    scale: 1
  },
  'diagonal-subtle': {
    type: 'diagonal-lines',
    color: '#000000',
    opacity: 0.03,
    scale: 1
  },
  'tech-circuit': {
    type: 'circuit',
    color: '#00ff00',
    opacity: 0.1,
    scale: 1
  },
  'hex-pattern': {
    type: 'hexagons',
    color: '#ffffff',
    opacity: 0.05,
    scale: 1
  },
  'topography-subtle': {
    type: 'topography',
    color: '#000000',
    opacity: 0.05,
    scale: 1
  }
}

/**
 * Apply a background to an element
 */
export const applyBackground = (
  element: HTMLElement,
  backgroundColor: string,
  pattern?: PatternConfig,
  gradient?: GradientConfig
): void => {
  element.style.background = generateBackgroundWithPattern(backgroundColor, pattern, gradient)
  element.style.backgroundRepeat = 'repeat'
}

/**
 * Get CSS for background
 */
export const getBackgroundCSS = (
  backgroundColor: string,
  pattern?: PatternConfig,
  gradient?: GradientConfig
): Record<string, string> => {
  return {
    background: generateBackgroundWithPattern(backgroundColor, pattern, gradient),
    backgroundRepeat: 'repeat'
  }
}

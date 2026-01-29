// Branding utility for participant pages (no auth context required)
// This applies the full theme preset system to CSS variables

import {
  type ThemePresetId,
  type ThemeColors,
  type ThemeTypography,
  type ThemeEffects,
  type GameThemeOverrides,
  type ThemeBackground,
  getThemePreset,
  borderRadiusMap,
  shadowMap
} from './themePresets'
import { loadThemeFonts, getFontFamilyCSS } from './fontLoader'
import type { OrganizationBranding } from './firestore'

// Default colors matching corporate-blue preset
const defaultColors: ThemeColors = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#1e40af',
  secondary: '#1e40af',
  secondaryLight: '#3b82f6',
  secondaryDark: '#1e3a8a',
  accent: '#f59e0b',
  background: '#ffffff',
  surface: '#f8fafc',
  surfaceHover: '#f1f5f9',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textOnPrimary: '#ffffff',
  textOnSecondary: '#ffffff',
  success: '#10b981',
  successLight: '#d1fae5',
  error: '#ef4444',
  errorLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  gameAccent: '#f59e0b',
  streak: '#f97316',
  celebration: '#8b5cf6',
  border: '#e5e7eb'
}

const defaultTypography: ThemeTypography = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontFamilyHeading: 'Inter, system-ui, sans-serif',
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700
}

const defaultEffects: ThemeEffects = {
  borderRadius: 'medium',
  shadowIntensity: 'subtle',
  celebrationStyle: 'confetti',
  animationSpeed: 'normal'
}

/**
 * Apply organization branding to CSS variables
 * This is the full implementation that supports theme presets
 * Used by participant pages that don't have auth context
 */
export const applyOrganizationBranding = async (branding: OrganizationBranding | null | undefined): Promise<void> => {
  if (!branding) return

  const root = document.documentElement

  // Clear any existing custom styles first to ensure fresh theme
  const existingCustomStyles = document.getElementById('custom-branding-styles')
  if (existingCustomStyles) {
    existingCustomStyles.remove()
  }

  // Reset body background to ensure clean state
  document.body.style.background = ''
  document.body.style.backgroundImage = ''
  document.body.style.backgroundColor = ''

  // Mark document as themed (prevents dark mode override)
  root.classList.add('themed')

  // Determine the effective colors (from preset or custom)
  let effectiveColors = { ...defaultColors }
  let effectiveTypography = { ...defaultTypography }
  let effectiveEffects = { ...defaultEffects }
  let effectiveGameTheme: GameThemeOverrides = {}
  let effectiveBackground: ThemeBackground | undefined = undefined

  // If a theme preset is specified, use it as base
  if (branding.themePreset) {
    const preset = getThemePreset(branding.themePreset)
    effectiveColors = { ...preset.colors }
    effectiveTypography = { ...preset.typography }
    effectiveEffects = { ...preset.effects }
    effectiveGameTheme = { ...preset.gameTheme }
    effectiveBackground = preset.background
  }

  // Override with any custom colors specified
  if (branding.colors) {
    effectiveColors = { ...effectiveColors, ...branding.colors }
  }

  // Override with any custom typography
  if (branding.typography) {
    effectiveTypography = { ...effectiveTypography, ...branding.typography }
  }

  // Override with any custom effects
  if (branding.effects) {
    effectiveEffects = { ...effectiveEffects, ...branding.effects }
  }

  // Override with any custom game themes
  if (branding.gameTheme) {
    effectiveGameTheme = { ...effectiveGameTheme, ...branding.gameTheme }
  }

  // Legacy support: If only primaryColor/secondaryColor provided, update the colors object
  if (branding.primaryColor && !branding.colors?.primary) {
    effectiveColors.primary = branding.primaryColor
  }
  if (branding.secondaryColor && !branding.colors?.secondary) {
    effectiveColors.secondary = branding.secondaryColor
  }

  // ===== APPLY CORE COLORS =====
  root.style.setProperty('--primary-color', effectiveColors.primary)
  root.style.setProperty('--primary-light-color', effectiveColors.primaryLight)
  root.style.setProperty('--primary-dark-color', effectiveColors.primaryDark)
  root.style.setProperty('--secondary-color', effectiveColors.secondary)
  root.style.setProperty('--secondary-light-color', effectiveColors.secondaryLight)
  root.style.setProperty('--secondary-dark-color', effectiveColors.secondaryDark)
  root.style.setProperty('--accent-color', effectiveColors.accent)

  // ===== APPLY BACKGROUND COLORS =====
  root.style.setProperty('--background-color', effectiveColors.background)
  root.style.setProperty('--surface-color', effectiveColors.surface)
  root.style.setProperty('--surface-hover-color', effectiveColors.surfaceHover)

  // ===== APPLY TEXT COLORS =====
  root.style.setProperty('--text-color', effectiveColors.textPrimary)
  root.style.setProperty('--text-secondary-color', effectiveColors.textSecondary)
  root.style.setProperty('--text-on-primary-color', effectiveColors.textOnPrimary)
  root.style.setProperty('--text-on-secondary-color', effectiveColors.textOnSecondary)

  // ===== APPLY FEEDBACK COLORS =====
  root.style.setProperty('--success-color', effectiveColors.success)
  root.style.setProperty('--success-light-color', effectiveColors.successLight)
  root.style.setProperty('--error-color', effectiveColors.error)
  root.style.setProperty('--error-light-color', effectiveColors.errorLight)
  root.style.setProperty('--warning-color', effectiveColors.warning)
  root.style.setProperty('--warning-light-color', effectiveColors.warningLight)

  // ===== APPLY GAME COLORS =====
  root.style.setProperty('--game-accent-color', effectiveColors.gameAccent)
  root.style.setProperty('--streak-color', effectiveColors.streak)
  root.style.setProperty('--celebration-color', effectiveColors.celebration)

  // ===== APPLY BORDER =====
  root.style.setProperty('--border-color', effectiveColors.border)

  // ===== APPLY TYPOGRAPHY =====
  const fontFamily = getFontFamilyCSS(effectiveTypography.fontFamily.split(',')[0].trim())
  const fontFamilyHeading = getFontFamilyCSS(effectiveTypography.fontFamilyHeading.split(',')[0].trim())

  root.style.setProperty('--font-family', fontFamily)
  root.style.setProperty('--font-family-heading', fontFamilyHeading)
  root.style.setProperty('--font-weight-normal', String(effectiveTypography.fontWeightNormal))
  root.style.setProperty('--font-weight-medium', String(effectiveTypography.fontWeightMedium))
  root.style.setProperty('--font-weight-bold', String(effectiveTypography.fontWeightBold))

  // Load fonts asynchronously
  await loadThemeFonts(effectiveTypography.fontFamily, effectiveTypography.fontFamilyHeading)

  // ===== APPLY EFFECTS =====
  root.style.setProperty('--border-radius', borderRadiusMap[effectiveEffects.borderRadius])
  root.style.setProperty('--shadow-style', shadowMap[effectiveEffects.shadowIntensity])

  // ===== APPLY GAME-SPECIFIC THEMES =====
  // Millionaire
  if (effectiveGameTheme.millionaire) {
    root.style.setProperty('--millionaire-container-gradient', effectiveGameTheme.millionaire.containerGradient)
    root.style.setProperty('--millionaire-money-ladder-bg', effectiveGameTheme.millionaire.moneyLadderBackground)
    root.style.setProperty('--millionaire-question-bg', effectiveGameTheme.millionaire.questionBackground)
    root.style.setProperty('--millionaire-lifeline-bg', effectiveGameTheme.millionaire.lifelineBackground)
    root.style.setProperty('--millionaire-accent', effectiveGameTheme.millionaire.accentColor)
  }

  // Bingo
  if (effectiveGameTheme.bingo) {
    root.style.setProperty('--bingo-container-gradient', effectiveGameTheme.bingo.containerGradient)
    root.style.setProperty('--bingo-card-bg', effectiveGameTheme.bingo.cardBackground)
    root.style.setProperty('--bingo-marked-cell', effectiveGameTheme.bingo.markedCellColor)
    root.style.setProperty('--bingo-win-highlight', effectiveGameTheme.bingo.winHighlight)
  }

  // Speed Round
  if (effectiveGameTheme.speedRound) {
    root.style.setProperty('--speedround-container-gradient', effectiveGameTheme.speedRound.containerGradient)
    root.style.setProperty('--speedround-timer-bg', effectiveGameTheme.speedRound.timerBackground)
    root.style.setProperty('--speedround-question-bg', effectiveGameTheme.speedRound.questionBackground)
    root.style.setProperty('--speedround-urgent', effectiveGameTheme.speedRound.urgentColor)
  }

  // Spot Difference
  if (effectiveGameTheme.spotDifference) {
    root.style.setProperty('--spotdiff-container-bg', effectiveGameTheme.spotDifference.containerBackground)
    root.style.setProperty('--spotdiff-document-bg', effectiveGameTheme.spotDifference.documentBackground)
    root.style.setProperty('--spotdiff-highlight', effectiveGameTheme.spotDifference.highlightColor)
    root.style.setProperty('--spotdiff-found', effectiveGameTheme.spotDifference.foundColor)
  }

  // ===== APPLY BACKGROUND =====
  // Use branding.background if provided, otherwise use preset background, otherwise use solid color
  const backgroundToApply = branding.background || effectiveBackground
  if (backgroundToApply) {
    if (backgroundToApply.type === 'gradient') {
      document.body.style.background = backgroundToApply.value
    } else if (backgroundToApply.type === 'image' && backgroundToApply.value) {
      document.body.style.backgroundImage = `url(${backgroundToApply.value})`
      document.body.style.backgroundSize = 'cover'
      document.body.style.backgroundPosition = 'center'
      if (backgroundToApply.overlay) {
        document.body.style.backgroundColor = backgroundToApply.overlay
      }
    } else {
      document.body.style.background = effectiveColors.background
    }
  } else {
    document.body.style.background = effectiveColors.background
  }

  // ===== APPLY CUSTOM CSS =====
  if (branding.customCSS) {
    let customStyleElement = document.getElementById('custom-branding-styles')
    if (customStyleElement) {
      customStyleElement.remove()
    }

    customStyleElement = document.createElement('style')
    customStyleElement.id = 'custom-branding-styles'
    customStyleElement.textContent = branding.customCSS
    document.head.appendChild(customStyleElement)
  }
}

/**
 * Reset branding to defaults
 */
export const resetBranding = (): void => {
  const root = document.documentElement

  // Remove themed class to allow dark mode
  root.classList.remove('themed')

  // Remove custom CSS
  const customStyleElement = document.getElementById('custom-branding-styles')
  if (customStyleElement) {
    customStyleElement.remove()
  }

  // Reset body background
  document.body.style.background = ''
  document.body.style.backgroundImage = ''
}

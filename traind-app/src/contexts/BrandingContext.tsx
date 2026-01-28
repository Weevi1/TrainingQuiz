// Dynamic branding context for white-label theming
import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  type ThemePresetId,
  type ThemeColors,
  type ThemeTypography,
  type ThemeBackground,
  type GameThemeOverrides,
  type ThemeEffects,
  type ThemePreset,
  getThemePreset,
  borderRadiusMap,
  shadowMap
} from '../lib/themePresets'
import { loadThemeFonts, getFontFamilyCSS } from '../lib/fontLoader'
import type { OrganizationBranding } from '../lib/firestore'

// Full branding configuration that matches the extended schema
interface BrandingConfig {
  // Legacy fields (for backwards compatibility)
  logo?: string
  primaryColor: string
  secondaryColor: string
  theme: 'corporate' | 'modern' | 'playful' | 'custom'
  customCSS?: string

  // Extended fields
  themePreset?: ThemePresetId
  colors?: ThemeColors
  typography?: ThemeTypography
  background?: ThemeBackground
  gameTheme?: GameThemeOverrides
  effects?: ThemeEffects
}

interface BrandingContextType {
  brandingConfig: BrandingConfig | null
  currentPreset: ThemePreset | null
  loading: boolean
  applyBranding: (config: BrandingConfig) => void
  applyPreset: (presetId: ThemePresetId) => void
  resetToDefault: () => void
  // Helper getters
  getColors: () => ThemeColors
  getGameTheme: (gameType: keyof GameThemeOverrides) => GameThemeOverrides[keyof GameThemeOverrides] | undefined
}

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

const defaultBranding: BrandingConfig = {
  primaryColor: '#3b82f6',
  secondaryColor: '#1e40af',
  theme: 'corporate',
  themePreset: 'corporate-blue',
  colors: defaultColors,
  typography: defaultTypography,
  effects: defaultEffects
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined)

export const useBranding = () => {
  const context = useContext(BrandingContext)
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return context
}

interface BrandingProviderProps {
  children: ReactNode
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const { currentOrganization } = useAuth()
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig | null>(defaultBranding)
  const [currentPreset, setCurrentPreset] = useState<ThemePreset | null>(getThemePreset('corporate-blue'))
  const [loading, setLoading] = useState(false)

  // Apply CSS variables to DOM
  const applyBrandingToDOM = useCallback(async (config: BrandingConfig) => {
    const root = document.documentElement

    // Mark document as themed (prevents dark mode override)
    root.classList.add('themed')

    // Determine the effective colors (from preset or custom)
    let effectiveColors = defaultColors
    let effectiveTypography = defaultTypography
    let effectiveEffects = defaultEffects
    let effectiveGameTheme: GameThemeOverrides = {}
    let effectiveBackground: ThemeBackground | undefined = undefined

    // If a theme preset is specified, use it as base
    if (config.themePreset) {
      const preset = getThemePreset(config.themePreset)
      effectiveColors = { ...preset.colors }
      effectiveTypography = { ...preset.typography }
      effectiveEffects = { ...preset.effects }
      effectiveGameTheme = { ...preset.gameTheme }
      effectiveBackground = preset.background
      setCurrentPreset(preset)
    }

    // Override with any custom colors specified
    if (config.colors) {
      effectiveColors = { ...effectiveColors, ...config.colors }
    }

    // Override with any custom typography
    if (config.typography) {
      effectiveTypography = { ...effectiveTypography, ...config.typography }
    }

    // Override with any custom effects
    if (config.effects) {
      effectiveEffects = { ...effectiveEffects, ...config.effects }
    }

    // Override with any custom game themes
    if (config.gameTheme) {
      effectiveGameTheme = { ...effectiveGameTheme, ...config.gameTheme }
    }

    // Legacy support: If only primaryColor/secondaryColor provided, update the colors object
    if (config.primaryColor && !config.colors?.primary) {
      effectiveColors.primary = config.primaryColor
    }
    if (config.secondaryColor && !config.colors?.secondary) {
      effectiveColors.secondary = config.secondaryColor
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
    // Use config.background if provided, otherwise use preset background, otherwise use solid color
    const backgroundToApply = config.background || effectiveBackground
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
    if (config.customCSS) {
      let customStyleElement = document.getElementById('custom-branding-styles')
      if (customStyleElement) {
        customStyleElement.remove()
      }

      customStyleElement = document.createElement('style')
      customStyleElement.id = 'custom-branding-styles'
      customStyleElement.textContent = config.customCSS
      document.head.appendChild(customStyleElement)
    }

    // Update document title
    if (config.logo && currentOrganization?.name) {
      document.title = `${currentOrganization.name} - Trained Platform`
    } else {
      document.title = 'Trained Platform'
    }
  }, [currentOrganization])

  // Convert organization branding to full config
  const convertOrgBrandingToConfig = (orgBranding: OrganizationBranding): BrandingConfig => {
    return {
      // Legacy fields
      logo: orgBranding.logo,
      primaryColor: orgBranding.primaryColor,
      secondaryColor: orgBranding.secondaryColor,
      theme: orgBranding.theme,
      customCSS: orgBranding.customCSS,
      // Extended fields
      themePreset: orgBranding.themePreset,
      colors: orgBranding.colors,
      typography: orgBranding.typography,
      background: orgBranding.background,
      gameTheme: orgBranding.gameTheme,
      effects: orgBranding.effects
    }
  }

  // Load organization branding when organization changes
  useEffect(() => {
    const loadBranding = async () => {
      setLoading(true)

      if (currentOrganization?.branding) {
        const config = convertOrgBrandingToConfig(currentOrganization.branding)
        setBrandingConfig(config)
        await applyBrandingToDOM(config)
      } else if (!currentOrganization) {
        // No organization selected, use default branding
        setBrandingConfig(defaultBranding)
        await applyBrandingToDOM(defaultBranding)
      }

      setLoading(false)
    }

    loadBranding()
  }, [currentOrganization, applyBrandingToDOM])

  const applyBranding = useCallback(async (config: BrandingConfig) => {
    setBrandingConfig(config)
    await applyBrandingToDOM(config)
  }, [applyBrandingToDOM])

  const applyPreset = useCallback(async (presetId: ThemePresetId) => {
    const preset = getThemePreset(presetId)
    const config: BrandingConfig = {
      ...brandingConfig,
      themePreset: presetId,
      primaryColor: preset.colors.primary,
      secondaryColor: preset.colors.secondary,
      colors: preset.colors,
      typography: preset.typography,
      effects: preset.effects,
      gameTheme: preset.gameTheme
    }
    await applyBranding(config)
  }, [brandingConfig, applyBranding])

  const resetToDefault = useCallback(async () => {
    setBrandingConfig(defaultBranding)
    setCurrentPreset(getThemePreset('corporate-blue'))
    await applyBrandingToDOM(defaultBranding)

    // Remove custom CSS
    const customStyleElement = document.getElementById('custom-branding-styles')
    if (customStyleElement) {
      customStyleElement.remove()
    }

    // Remove themed class to allow dark mode
    document.documentElement.classList.remove('themed')
  }, [applyBrandingToDOM])

  // Helper to get current colors (with defaults)
  const getColors = useCallback((): ThemeColors => {
    if (brandingConfig?.colors) {
      return brandingConfig.colors
    }
    if (currentPreset?.colors) {
      return currentPreset.colors
    }
    return defaultColors
  }, [brandingConfig, currentPreset])

  // Helper to get game theme for a specific game
  const getGameTheme = useCallback((gameType: keyof GameThemeOverrides) => {
    if (brandingConfig?.gameTheme?.[gameType]) {
      return brandingConfig.gameTheme[gameType]
    }
    if (currentPreset?.gameTheme?.[gameType]) {
      return currentPreset.gameTheme[gameType]
    }
    return undefined
  }, [brandingConfig, currentPreset])

  const value: BrandingContextType = {
    brandingConfig,
    currentPreset,
    loading,
    applyBranding,
    applyPreset,
    resetToDefault,
    getColors,
    getGameTheme
  }

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

// Hook for easy access to current branding colors (legacy support)
export const useBrandingColors = () => {
  const { getColors } = useBranding()
  const colors = getColors()

  return {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    // Extended colors
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    gameAccent: colors.gameAccent,
    streak: colors.streak,
    celebration: colors.celebration
  }
}

export default BrandingContext

// Theme Presets Library - Professional pre-built themes for organizations

export type ThemePresetId =
  | 'corporate-blue'
  | 'modern-dark'
  | 'fairytale'
  | 'esi-fairytale'
  | 'legal-professional'
  | 'healthcare'
  | 'tech-modern'
  | 'nature-green'
  | 'playful-bright'
  | 'custom'

export interface ThemeColors {
  // Core colors
  primary: string
  primaryLight: string
  primaryDark: string
  secondary: string
  secondaryLight: string
  secondaryDark: string
  accent: string

  // Background colors
  background: string
  surface: string
  surfaceHover: string

  // Text colors
  textPrimary: string
  textSecondary: string
  textOnPrimary: string
  textOnSecondary: string

  // Feedback colors (for quiz responses, etc.)
  success: string
  successLight: string
  error: string
  errorLight: string
  warning: string
  warningLight: string

  // Game-specific colors
  gameAccent: string
  streak: string
  celebration: string

  // Border color
  border: string
}

export interface ThemeTypography {
  fontFamily: string
  fontFamilyHeading: string
  fontWeightNormal: number
  fontWeightMedium: number
  fontWeightBold: number
}

export interface ThemeBackground {
  type: 'solid' | 'gradient' | 'pattern' | 'image'
  value: string
  overlay?: string
}

export interface GameThemeOverrides {
  millionaire?: {
    containerGradient: string
    moneyLadderBackground: string
    questionBackground: string
    lifelineBackground: string
    accentColor: string
  }
  bingo?: {
    containerGradient: string
    cardBackground: string
    markedCellColor: string
    winHighlight: string
  }
  speedRound?: {
    containerGradient: string
    timerBackground: string
    questionBackground: string
    urgentColor: string
  }
  spotDifference?: {
    containerBackground: string
    documentBackground: string
    highlightColor: string
    foundColor: string
  }
}

export interface ThemeEffects {
  borderRadius: 'small' | 'medium' | 'large' | 'xl'
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'prominent'
  celebrationStyle: 'confetti' | 'sparkles' | 'fireworks' | 'stars'
  animationSpeed: 'slow' | 'normal' | 'fast'
}

export interface ThemePreset {
  id: ThemePresetId
  name: string
  description: string
  category: 'professional' | 'creative' | 'industry' | 'custom'
  preview: string // Preview image or gradient
  colors: ThemeColors
  typography: ThemeTypography
  background: ThemeBackground
  gameTheme: GameThemeOverrides
  effects: ThemeEffects
}

// Border radius mapping
export const borderRadiusMap: Record<ThemeEffects['borderRadius'], string> = {
  small: '4px',
  medium: '8px',
  large: '12px',
  xl: '16px'
}

// Shadow intensity mapping
export const shadowMap: Record<ThemeEffects['shadowIntensity'], string> = {
  none: 'none',
  subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  prominent: '0 10px 15px -3px rgba(0, 0, 0, 0.2)'
}

// ===== THEME PRESETS =====

export const themePresets: Record<ThemePresetId, ThemePreset> = {
  'corporate-blue': {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Professional blue theme perfect for corporate training',
    category: 'professional',
    preview: 'linear-gradient(135deg, #3b82f6, #1e40af)',
    colors: {
      primary: '#3b82f6',
      primaryLight: '#60a5fa',
      primaryDark: '#1e40af',
      secondary: '#6366f1',
      secondaryLight: '#818cf8',
      secondaryDark: '#4f46e5',
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
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyHeading: 'Inter, system-ui, sans-serif',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#ffffff'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #1e3a8a, #0f172a)',
        moneyLadderBackground: '#1e293b',
        questionBackground: 'linear-gradient(to right, #1e40af, #3b82f6)',
        lifelineBackground: '#1e293b',
        accentColor: '#fbbf24'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #3b82f6, #1e40af)',
        cardBackground: 'rgba(255, 255, 255, 0.1)',
        markedCellColor: '#10b981',
        winHighlight: '#fbbf24'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #3b82f6, #1e40af)',
        timerBackground: 'rgba(0, 0, 0, 0.3)',
        questionBackground: 'rgba(255, 255, 255, 0.95)',
        urgentColor: '#ef4444'
      },
      spotDifference: {
        containerBackground: '#f8fafc',
        documentBackground: '#ffffff',
        highlightColor: '#fef08a',
        foundColor: '#bbf7d0'
      }
    },
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'subtle',
      celebrationStyle: 'confetti',
      animationSpeed: 'normal'
    }
  },

  'modern-dark': {
    id: 'modern-dark',
    name: 'Modern Dark',
    description: 'Sleek dark theme with vibrant accents',
    category: 'professional',
    preview: 'linear-gradient(135deg, #0f172a, #1e293b)',
    colors: {
      primary: '#6366f1',
      primaryLight: '#818cf8',
      primaryDark: '#4f46e5',
      secondary: '#06b6d4',
      secondaryLight: '#22d3ee',
      secondaryDark: '#0891b2',
      accent: '#f472b6',
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHover: '#334155',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      textOnPrimary: '#ffffff',
      textOnSecondary: '#ffffff',
      success: '#22c55e',
      successLight: '#166534',
      error: '#f43f5e',
      errorLight: '#9f1239',
      warning: '#f59e0b',
      warningLight: '#92400e',
      gameAccent: '#f472b6',
      streak: '#fb923c',
      celebration: '#a855f7',
      border: '#334155'
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyHeading: 'Inter, system-ui, sans-serif',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#0f172a'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #1e1b4b, #0f172a)',
        moneyLadderBackground: '#1e293b',
        questionBackground: 'linear-gradient(to right, #4f46e5, #6366f1)',
        lifelineBackground: '#1e293b',
        accentColor: '#f472b6'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #6366f1, #4f46e5)',
        cardBackground: 'rgba(255, 255, 255, 0.05)',
        markedCellColor: '#22c55e',
        winHighlight: '#f472b6'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #6366f1, #4f46e5)',
        timerBackground: 'rgba(0, 0, 0, 0.5)',
        questionBackground: 'rgba(30, 41, 59, 0.95)',
        urgentColor: '#f43f5e'
      },
      spotDifference: {
        containerBackground: '#0f172a',
        documentBackground: '#1e293b',
        highlightColor: '#fef08a',
        foundColor: '#166534'
      }
    },
    effects: {
      borderRadius: 'large',
      shadowIntensity: 'medium',
      celebrationStyle: 'sparkles',
      animationSpeed: 'normal'
    }
  },

  'fairytale': {
    id: 'fairytale',
    name: 'Fairytale Magic',
    description: 'Enchanting purple and gold theme with magical effects',
    category: 'creative',
    preview: 'linear-gradient(135deg, #8b5cf6, #4c1d95)',
    colors: {
      primary: '#8b5cf6',
      primaryLight: '#a78bfa',
      primaryDark: '#6d28d9',
      secondary: '#f9a8d4',
      secondaryLight: '#fbcfe8',
      secondaryDark: '#ec4899',
      accent: '#fcd34d',
      background: '#1e1b4b',
      surface: '#2e1065',
      surfaceHover: '#3b0764',
      textPrimary: '#faf5ff',
      textSecondary: '#c4b5fd',
      textOnPrimary: '#ffffff',
      textOnSecondary: '#1e1b4b',
      success: '#10b981',
      successLight: '#065f46',
      error: '#fb7185',
      errorLight: '#be123c',
      warning: '#fcd34d',
      warningLight: '#92400e',
      gameAccent: '#fcd34d',
      streak: '#fbbf24',
      celebration: '#f472b6',
      border: '#4c1d95'
    },
    typography: {
      fontFamily: 'Cinzel, Georgia, serif',
      fontFamilyHeading: 'Cinzel Decorative, Georgia, serif',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700
    },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #1e1b4b, #4c1d95)'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #4c1d95, #1e1b4b)',
        moneyLadderBackground: '#2e1065',
        questionBackground: 'linear-gradient(to right, #6d28d9, #8b5cf6)',
        lifelineBackground: '#2e1065',
        accentColor: '#fcd34d'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #8b5cf6, #6d28d9)',
        cardBackground: 'rgba(255, 255, 255, 0.1)',
        markedCellColor: '#10b981',
        winHighlight: '#fcd34d'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #8b5cf6, #6d28d9)',
        timerBackground: 'rgba(0, 0, 0, 0.4)',
        questionBackground: 'rgba(255, 255, 255, 0.95)',
        urgentColor: '#fb7185'
      },
      spotDifference: {
        containerBackground: '#1e1b4b',
        documentBackground: '#2e1065',
        highlightColor: '#fcd34d',
        foundColor: '#10b981'
      }
    },
    effects: {
      borderRadius: 'xl',
      shadowIntensity: 'prominent',
      celebrationStyle: 'sparkles',
      animationSpeed: 'normal'
    }
  },

  'esi-fairytale': {
    id: 'esi-fairytale',
    name: 'ESI Attorneys Fairytale',
    description: 'Elegant dark gold theme with magical sophistication',
    category: 'industry',
    preview: 'linear-gradient(135deg, #1a1a1a, #c9a86c)',
    colors: {
      primary: '#c9a86c',
      primaryLight: '#dfc08a',
      primaryDark: '#9c7c48',
      secondary: '#4a3f35',
      secondaryLight: '#5c4f42',
      secondaryDark: '#3a3028',
      accent: '#d4af37',
      background: '#1a1a1a',
      surface: '#2b2723',
      surfaceHover: '#3a342e',
      textPrimary: '#f5f0e8',
      textSecondary: '#b5aa98',
      textOnPrimary: '#1a1a1a',
      textOnSecondary: '#f5f0e8',
      success: '#5cb87a',
      successLight: '#1e3d2a',
      error: '#e06060',
      errorLight: '#3d1e1e',
      warning: '#e0a830',
      warningLight: '#3d351e',
      gameAccent: '#d4af37',
      streak: '#c9a86c',
      celebration: '#d4af37',
      border: '#554d44'
    },
    typography: {
      fontFamily: 'Cormorant Garamond, Georgia, serif',
      fontFamilyHeading: 'Cinzel, Georgia, serif',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700
    },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #1a1a1a 0%, #2b2b2b 50%, #1a1a1a 100%)'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #2b2723, #1a1a1a)',
        moneyLadderBackground: '#1a1a1a',
        questionBackground: 'linear-gradient(to right, #3a342e, #2b2723)',
        lifelineBackground: '#2b2723',
        accentColor: '#d4af37'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #2b2723, #1a1a1a)',
        cardBackground: 'rgba(201, 168, 108, 0.12)',
        markedCellColor: '#5cb87a',
        winHighlight: '#d4af37'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #2b2723, #1a1a1a)',
        timerBackground: 'rgba(0, 0, 0, 0.5)',
        questionBackground: 'rgba(43, 39, 35, 0.95)',
        urgentColor: '#e06060'
      },
      spotDifference: {
        containerBackground: '#1a1a1a',
        documentBackground: '#2b2723',
        highlightColor: 'rgba(212, 175, 55, 0.3)',
        foundColor: 'rgba(92, 184, 122, 0.3)'
      }
    },
    effects: {
      borderRadius: 'small',
      shadowIntensity: 'medium',
      celebrationStyle: 'stars',
      animationSpeed: 'slow'
    }
  },

  'legal-professional': {
    id: 'legal-professional',
    name: 'Legal Professional',
    description: 'Dignified navy and gold theme for law firms',
    category: 'industry',
    preview: 'linear-gradient(135deg, #1e3a5f, #0c1929)',
    colors: {
      primary: '#1e3a5f',
      primaryLight: '#2d5a8c',
      primaryDark: '#0c1929',
      secondary: '#c9a227',
      secondaryLight: '#ddb84a',
      secondaryDark: '#8b7118',
      accent: '#c9a227',
      background: '#faf9f7',
      surface: '#ffffff',
      surfaceHover: '#f5f4f2',
      textPrimary: '#1a1a1a',
      textSecondary: '#4a4a4a',
      textOnPrimary: '#ffffff',
      textOnSecondary: '#0c1929',
      success: '#166534',
      successLight: '#dcfce7',
      error: '#991b1b',
      errorLight: '#fef2f2',
      warning: '#b45309',
      warningLight: '#fef3c7',
      gameAccent: '#c9a227',
      streak: '#ddb84a',
      celebration: '#c9a227',
      border: '#d4d2cd'
    },
    typography: {
      fontFamily: 'Playfair Display, Georgia, serif',
      fontFamilyHeading: 'Playfair Display, Georgia, serif',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#faf9f7'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #1e3a5f, #0c1929)',
        moneyLadderBackground: '#0c1929',
        questionBackground: 'linear-gradient(to right, #1e3a5f, #2d5a8c)',
        lifelineBackground: '#0c1929',
        accentColor: '#c9a227'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #1e3a5f, #0c1929)',
        cardBackground: 'rgba(255, 255, 255, 0.1)',
        markedCellColor: '#166534',
        winHighlight: '#c9a227'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #1e3a5f, #2d5a8c)',
        timerBackground: 'rgba(0, 0, 0, 0.4)',
        questionBackground: 'rgba(250, 249, 247, 0.95)',
        urgentColor: '#991b1b'
      },
      spotDifference: {
        containerBackground: '#faf9f7',
        documentBackground: '#ffffff',
        highlightColor: '#fef3c7',
        foundColor: '#dcfce7'
      }
    },
    effects: {
      borderRadius: 'small',
      shadowIntensity: 'subtle',
      celebrationStyle: 'stars',
      animationSpeed: 'slow'
    }
  },

  'healthcare': {
    id: 'healthcare',
    name: 'Healthcare Calm',
    description: 'Clean teal and green theme for medical training',
    category: 'industry',
    preview: 'linear-gradient(135deg, #0d9488, #134e4a)',
    colors: {
      primary: '#0d9488',
      primaryLight: '#14b8a6',
      primaryDark: '#0f766e',
      secondary: '#2563eb',
      secondaryLight: '#60a5fa',
      secondaryDark: '#1d4ed8',
      accent: '#06b6d4',
      background: '#f0fdfa',
      surface: '#ffffff',
      surfaceHover: '#ccfbf1',
      textPrimary: '#134e4a',
      textSecondary: '#115e59',
      textOnPrimary: '#ffffff',
      textOnSecondary: '#ffffff',
      success: '#059669',
      successLight: '#d1fae5',
      error: '#dc2626',
      errorLight: '#fee2e2',
      warning: '#d97706',
      warningLight: '#fef3c7',
      gameAccent: '#06b6d4',
      streak: '#14b8a6',
      celebration: '#0d9488',
      border: '#99f6e4'
    },
    typography: {
      fontFamily: 'Open Sans, system-ui, sans-serif',
      fontFamilyHeading: 'Open Sans, system-ui, sans-serif',
      fontWeightNormal: 400,
      fontWeightMedium: 600,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#f0fdfa'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #0d9488, #134e4a)',
        moneyLadderBackground: '#134e4a',
        questionBackground: 'linear-gradient(to right, #0f766e, #0d9488)',
        lifelineBackground: '#134e4a',
        accentColor: '#06b6d4'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #0d9488, #0f766e)',
        cardBackground: 'rgba(255, 255, 255, 0.15)',
        markedCellColor: '#059669',
        winHighlight: '#06b6d4'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #0d9488, #0f766e)',
        timerBackground: 'rgba(0, 0, 0, 0.3)',
        questionBackground: 'rgba(255, 255, 255, 0.95)',
        urgentColor: '#dc2626'
      },
      spotDifference: {
        containerBackground: '#f0fdfa',
        documentBackground: '#ffffff',
        highlightColor: '#fef9c3',
        foundColor: '#d1fae5'
      }
    },
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'subtle',
      celebrationStyle: 'confetti',
      animationSpeed: 'slow'
    }
  },

  'tech-modern': {
    id: 'tech-modern',
    name: 'Tech Modern',
    description: 'Dark theme with cyan accents for tech companies',
    category: 'industry',
    preview: 'linear-gradient(135deg, #0891b2, #164e63)',
    colors: {
      primary: '#0891b2',
      primaryLight: '#22d3ee',
      primaryDark: '#0e7490',
      secondary: '#8b5cf6',
      secondaryLight: '#a78bfa',
      secondaryDark: '#6d28d9',
      accent: '#22d3ee',
      background: '#0f1729',
      surface: '#1a2744',
      surfaceHover: '#243552',
      textPrimary: '#e2e8f0',
      textSecondary: '#94a3b8',
      textOnPrimary: '#0f1729',
      textOnSecondary: '#ffffff',
      success: '#22c55e',
      successLight: '#166534',
      error: '#f43f5e',
      errorLight: '#881337',
      warning: '#eab308',
      warningLight: '#713f12',
      gameAccent: '#22d3ee',
      streak: '#f97316',
      celebration: '#8b5cf6',
      border: '#334155'
    },
    typography: {
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontFamilyHeading: 'Inter, system-ui, sans-serif',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#0f1729'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #164e63, #0f1729)',
        moneyLadderBackground: '#1a2744',
        questionBackground: 'linear-gradient(to right, #0e7490, #0891b2)',
        lifelineBackground: '#1a2744',
        accentColor: '#22d3ee'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #0891b2, #164e63)',
        cardBackground: 'rgba(255, 255, 255, 0.05)',
        markedCellColor: '#22c55e',
        winHighlight: '#22d3ee'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #0891b2, #164e63)',
        timerBackground: 'rgba(0, 0, 0, 0.5)',
        questionBackground: 'rgba(26, 39, 68, 0.95)',
        urgentColor: '#f43f5e'
      },
      spotDifference: {
        containerBackground: '#0f1729',
        documentBackground: '#1a2744',
        highlightColor: '#fef08a',
        foundColor: '#166534'
      }
    },
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'medium',
      celebrationStyle: 'fireworks',
      animationSpeed: 'fast'
    }
  },

  'nature-green': {
    id: 'nature-green',
    name: 'Nature Green',
    description: 'Organic green and earth tone theme',
    category: 'creative',
    preview: 'linear-gradient(135deg, #16a34a, #14532d)',
    colors: {
      primary: '#16a34a',
      primaryLight: '#22c55e',
      primaryDark: '#15803d',
      secondary: '#a16207',
      secondaryLight: '#ca8a04',
      secondaryDark: '#854d0e',
      accent: '#65a30d',
      background: '#fefdf8',
      surface: '#ffffff',
      surfaceHover: '#f7fee7',
      textPrimary: '#14532d',
      textSecondary: '#166534',
      textOnPrimary: '#ffffff',
      textOnSecondary: '#ffffff',
      success: '#16a34a',
      successLight: '#dcfce7',
      error: '#dc2626',
      errorLight: '#fee2e2',
      warning: '#ca8a04',
      warningLight: '#fef9c3',
      gameAccent: '#65a30d',
      streak: '#ca8a04',
      celebration: '#16a34a',
      border: '#bef264'
    },
    typography: {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontFamilyHeading: 'Nunito, system-ui, sans-serif',
      fontWeightNormal: 400,
      fontWeightMedium: 600,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#fefdf8'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #15803d, #14532d)',
        moneyLadderBackground: '#14532d',
        questionBackground: 'linear-gradient(to right, #15803d, #16a34a)',
        lifelineBackground: '#14532d',
        accentColor: '#ca8a04'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #16a34a, #15803d)',
        cardBackground: 'rgba(255, 255, 255, 0.15)',
        markedCellColor: '#22c55e',
        winHighlight: '#ca8a04'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #16a34a, #15803d)',
        timerBackground: 'rgba(0, 0, 0, 0.3)',
        questionBackground: 'rgba(255, 255, 255, 0.95)',
        urgentColor: '#dc2626'
      },
      spotDifference: {
        containerBackground: '#fefdf8',
        documentBackground: '#ffffff',
        highlightColor: '#fef9c3',
        foundColor: '#dcfce7'
      }
    },
    effects: {
      borderRadius: 'large',
      shadowIntensity: 'subtle',
      celebrationStyle: 'confetti',
      animationSpeed: 'normal'
    }
  },

  'playful-bright': {
    id: 'playful-bright',
    name: 'Playful Bright',
    description: 'Fun and colorful theme for energetic training',
    category: 'creative',
    preview: 'linear-gradient(135deg, #f97316, #ea580c)',
    colors: {
      primary: '#f97316',
      primaryLight: '#fb923c',
      primaryDark: '#ea580c',
      secondary: '#8b5cf6',
      secondaryLight: '#a78bfa',
      secondaryDark: '#7c3aed',
      accent: '#ec4899',
      background: '#fffbeb',
      surface: '#ffffff',
      surfaceHover: '#fef3c7',
      textPrimary: '#1c1917',
      textSecondary: '#44403c',
      textOnPrimary: '#ffffff',
      textOnSecondary: '#ffffff',
      success: '#22c55e',
      successLight: '#dcfce7',
      error: '#ef4444',
      errorLight: '#fee2e2',
      warning: '#f59e0b',
      warningLight: '#fef3c7',
      gameAccent: '#ec4899',
      streak: '#fb923c',
      celebration: '#8b5cf6',
      border: '#fed7aa'
    },
    typography: {
      fontFamily: 'Poppins, system-ui, sans-serif',
      fontFamilyHeading: 'Poppins, system-ui, sans-serif',
      fontWeightNormal: 400,
      fontWeightMedium: 600,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#fffbeb'
    },
    gameTheme: {
      millionaire: {
        containerGradient: 'linear-gradient(to bottom, #ea580c, #9a3412)',
        moneyLadderBackground: '#9a3412',
        questionBackground: 'linear-gradient(to right, #ea580c, #f97316)',
        lifelineBackground: '#9a3412',
        accentColor: '#ec4899'
      },
      bingo: {
        containerGradient: 'linear-gradient(to bottom, #f97316, #ea580c)',
        cardBackground: 'rgba(255, 255, 255, 0.2)',
        markedCellColor: '#22c55e',
        winHighlight: '#ec4899'
      },
      speedRound: {
        containerGradient: 'linear-gradient(to bottom, #f97316, #ea580c)',
        timerBackground: 'rgba(0, 0, 0, 0.3)',
        questionBackground: 'rgba(255, 255, 255, 0.95)',
        urgentColor: '#ef4444'
      },
      spotDifference: {
        containerBackground: '#fffbeb',
        documentBackground: '#ffffff',
        highlightColor: '#fef08a',
        foundColor: '#dcfce7'
      }
    },
    effects: {
      borderRadius: 'xl',
      shadowIntensity: 'prominent',
      celebrationStyle: 'fireworks',
      animationSpeed: 'fast'
    }
  },

  'custom': {
    id: 'custom',
    name: 'Custom Theme',
    description: 'Build your own theme from scratch',
    category: 'custom',
    preview: 'linear-gradient(135deg, #6b7280, #4b5563)',
    colors: {
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
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyHeading: 'Inter, system-ui, sans-serif',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700
    },
    background: {
      type: 'solid',
      value: '#ffffff'
    },
    gameTheme: {},
    effects: {
      borderRadius: 'medium',
      shadowIntensity: 'subtle',
      celebrationStyle: 'confetti',
      animationSpeed: 'normal'
    }
  }
}

// Helper function to get theme by ID
export const getThemePreset = (id: ThemePresetId): ThemePreset => {
  return themePresets[id] || themePresets['corporate-blue']
}

// Helper function to list all presets
export const getAllThemePresets = (): ThemePreset[] => {
  return Object.values(themePresets)
}

// Helper function to get presets by category
export const getPresetsByCategory = (category: ThemePreset['category']): ThemePreset[] => {
  return Object.values(themePresets).filter(preset => preset.category === category)
}

// Helper function to merge custom colors with a preset
export const mergeThemeWithCustomColors = (
  presetId: ThemePresetId,
  customColors: Partial<ThemeColors>
): ThemePreset => {
  const preset = getThemePreset(presetId)
  return {
    ...preset,
    colors: {
      ...preset.colors,
      ...customColors
    }
  }
}

// Helper to generate CSS variables from theme colors
export const generateCSSVariables = (colors: ThemeColors): Record<string, string> => {
  return {
    '--primary-color': colors.primary,
    '--primary-light-color': colors.primaryLight,
    '--primary-dark-color': colors.primaryDark,
    '--secondary-color': colors.secondary,
    '--secondary-light-color': colors.secondaryLight,
    '--secondary-dark-color': colors.secondaryDark,
    '--accent-color': colors.accent,
    '--background-color': colors.background,
    '--surface-color': colors.surface,
    '--surface-hover-color': colors.surfaceHover,
    '--text-color': colors.textPrimary,
    '--text-secondary-color': colors.textSecondary,
    '--text-on-primary-color': colors.textOnPrimary,
    '--text-on-secondary-color': colors.textOnSecondary,
    '--success-color': colors.success,
    '--success-light-color': colors.successLight,
    '--error-color': colors.error,
    '--error-light-color': colors.errorLight,
    '--warning-color': colors.warning,
    '--warning-light-color': colors.warningLight,
    '--game-accent-color': colors.gameAccent,
    '--streak-color': colors.streak,
    '--celebration-color': colors.celebration,
    '--border-color': colors.border
  }
}

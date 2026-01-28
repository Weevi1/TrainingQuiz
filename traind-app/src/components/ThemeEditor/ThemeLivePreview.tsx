// ThemeLivePreview - Shows how the theme looks in various contexts
import React, { useState } from 'react'
import { Monitor, Smartphone, Gamepad2, Trophy, CheckCircle, XCircle, Zap, Clock } from 'lucide-react'
import type { ThemeColors, ThemeTypography, ThemeBackground } from '../../lib/themePresets'
import { generatePattern, generateGradient } from '../../lib/backgroundPatterns'

interface ThemeLivePreviewProps {
  colors: ThemeColors
  typography: ThemeTypography
  background: ThemeBackground
}

type PreviewMode = 'quiz' | 'results' | 'game'

export const ThemeLivePreview: React.FC<ThemeLivePreviewProps> = ({
  colors,
  typography,
  background
}) => {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('quiz')
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop')

  const previewModes = [
    { id: 'quiz' as const, label: 'Quiz', icon: Monitor },
    { id: 'results' as const, label: 'Results', icon: Trophy },
    { id: 'game' as const, label: 'Game', icon: Gamepad2 }
  ]

  // Build CSS variables for preview
  const previewStyles: React.CSSProperties = {
    '--preview-primary': colors.primary,
    '--preview-primary-light': colors.primaryLight,
    '--preview-primary-dark': colors.primaryDark,
    '--preview-secondary': colors.secondary,
    '--preview-background': colors.background,
    '--preview-surface': colors.surface,
    '--preview-text': colors.textPrimary,
    '--preview-text-secondary': colors.textSecondary,
    '--preview-success': colors.success,
    '--preview-success-light': colors.successLight,
    '--preview-error': colors.error,
    '--preview-error-light': colors.errorLight,
    '--preview-streak': colors.streak || '#f97316',
    '--preview-border': colors.border,
    fontFamily: typography.fontFamily || 'system-ui'
  } as React.CSSProperties

  const backgroundCSS = getBackgroundCSS(background, colors)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Live Preview</h3>
        <div className="flex items-center gap-2">
          {/* Device Toggle */}
          <button
            onClick={() => setDeviceView('desktop')}
            className={`p-2 rounded ${deviceView === 'desktop' ? 'bg-primary text-white' : 'text-text-secondary'}`}
            title="Desktop view"
          >
            <Monitor size={16} />
          </button>
          <button
            onClick={() => setDeviceView('mobile')}
            className={`p-2 rounded ${deviceView === 'mobile' ? 'bg-primary text-white' : 'text-text-secondary'}`}
            title="Mobile view"
          >
            <Smartphone size={16} />
          </button>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="flex gap-2">
        {previewModes.map(mode => (
          <button
            key={mode.id}
            onClick={() => setPreviewMode(mode.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
              previewMode === mode.id ? 'font-medium' : 'text-text-secondary'
            }`}
            style={{
              backgroundColor: previewMode === mode.id ? colors.primaryLight : 'transparent',
              color: previewMode === mode.id ? colors.primary : undefined
            }}
          >
            <mode.icon size={14} />
            {mode.label}
          </button>
        ))}
      </div>

      {/* Preview Container */}
      <div
        className={`border rounded-lg overflow-hidden transition-all ${
          deviceView === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'
        }`}
        style={{
          borderColor: 'var(--border-color)',
          height: deviceView === 'mobile' ? '500px' : '400px'
        }}
      >
        <div
          className="h-full overflow-auto"
          style={{ ...previewStyles, ...backgroundCSS }}
        >
          {previewMode === 'quiz' && (
            <QuizPreview colors={colors} typography={typography} />
          )}
          {previewMode === 'results' && (
            <ResultsPreview colors={colors} typography={typography} />
          )}
          {previewMode === 'game' && (
            <GamePreview colors={colors} typography={typography} />
          )}
        </div>
      </div>

      <p className="text-sm text-text-secondary text-center">
        This preview shows how your theme will look to participants
      </p>
    </div>
  )
}

interface PreviewProps {
  colors: ThemeColors
  typography: ThemeTypography
}

const QuizPreview: React.FC<PreviewProps> = ({ colors, typography }) => {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div className="min-h-full p-4 space-y-4">
      {/* Header */}
      <div
        className="p-3 rounded-lg"
        style={{ backgroundColor: colors.surface, borderBottom: `1px solid ${colors.border}` }}
      >
        <div className="flex justify-between items-center">
          <span style={{ color: colors.textSecondary }}>Question 3 of 10</span>
          <div className="flex items-center gap-3">
            <span style={{ color: colors.primary }}>Score: 200</span>
            <span className="flex items-center gap-1" style={{ color: colors.streak || '#f97316' }}>
              <Zap size={14} /> 3
            </span>
          </div>
        </div>
      </div>

      {/* Timer */}
      <div
        className="p-3 rounded-lg flex items-center justify-center gap-2"
        style={{ backgroundColor: colors.surface }}
      >
        <Clock size={18} style={{ color: colors.primary }} />
        <span
          className="text-xl font-bold"
          style={{ color: colors.primary, fontFamily: typography.fontFamily }}
        >
          25
        </span>
        <span style={{ color: colors.textSecondary }}>seconds</span>
      </div>

      {/* Question */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: colors.surface }}>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: colors.textPrimary, fontFamily: typography.fontFamilyHeading || typography.fontFamily }}
        >
          What is the primary benefit of regular team meetings?
        </h2>

        {/* Options */}
        <div className="space-y-2">
          {['Improved communication', 'Better coordination', 'Enhanced accountability', 'All of the above'].map((option, idx) => (
            <button
              key={idx}
              onClick={() => setSelected(idx)}
              className="w-full p-3 text-left rounded-lg border-2 transition-all"
              style={{
                backgroundColor: selected === idx ? colors.primaryLight : colors.surface,
                borderColor: selected === idx ? colors.primary : colors.border,
                color: colors.textPrimary
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{
                    borderColor: selected === idx ? colors.primary : colors.border,
                    backgroundColor: selected === idx ? colors.primary : 'transparent'
                  }}
                >
                  {selected === idx && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.textOnPrimary || 'white' }} />
                  )}
                </div>
                {option}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Submit button */}
      <button
        className="w-full py-3 rounded-lg font-medium"
        style={{
          backgroundColor: colors.primary,
          color: colors.textOnPrimary || 'white'
        }}
      >
        Submit Answer
      </button>
    </div>
  )
}

const ResultsPreview: React.FC<PreviewProps> = ({ colors, typography }) => {
  return (
    <div className="min-h-full p-4 space-y-4">
      {/* Header */}
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ backgroundColor: colors.successLight }}
        >
          <Trophy size={32} style={{ color: colors.success }} />
        </div>
        <h2
          className="text-xl font-bold"
          style={{ color: colors.textPrimary, fontFamily: typography.fontFamilyHeading || typography.fontFamily }}
        >
          Congratulations!
        </h2>
        <p style={{ color: colors.textSecondary }}>You've completed the quiz</p>
      </div>

      {/* Score */}
      <div className="p-4 rounded-lg text-center" style={{ backgroundColor: colors.surface }}>
        <div className="text-4xl font-bold mb-2" style={{ color: colors.primary }}>85%</div>
        <div
          className="inline-block px-3 py-1 rounded-full text-sm"
          style={{ backgroundColor: colors.successLight, color: colors.success }}
        >
          Excellent
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.surface }}>
          <div className="text-xl font-bold" style={{ color: colors.success }}>17</div>
          <div className="text-xs" style={{ color: colors.textSecondary }}>Correct</div>
        </div>
        <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.surface }}>
          <div className="text-xl font-bold" style={{ color: colors.error }}>3</div>
          <div className="text-xs" style={{ color: colors.textSecondary }}>Incorrect</div>
        </div>
      </div>

      {/* Question breakdown preview */}
      <div className="space-y-2">
        <div
          className="p-3 rounded-lg border-2"
          style={{ borderColor: colors.success, backgroundColor: colors.successLight }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={16} style={{ color: colors.success }} />
            <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>Question 1</span>
          </div>
        </div>
        <div
          className="p-3 rounded-lg border-2"
          style={{ borderColor: colors.error, backgroundColor: colors.errorLight }}
        >
          <div className="flex items-center gap-2">
            <XCircle size={16} style={{ color: colors.error }} />
            <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>Question 2</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const GamePreview: React.FC<PreviewProps> = ({ colors, typography }) => {
  return (
    <div className="min-h-full">
      {/* Millionaire-style header */}
      <div
        className="p-4 text-center"
        style={{
          background: `linear-gradient(180deg, ${colors.primaryDark || colors.primary} 0%, ${colors.primary} 100%)`
        }}
      >
        <h2
          className="text-lg font-bold"
          style={{ color: colors.textOnPrimary || 'white', fontFamily: typography.fontFamilyHeading || typography.fontFamily }}
        >
          Who Wants to be a Millionaire?
        </h2>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Question 5 of 15
        </p>
      </div>

      {/* Money ladder preview */}
      <div className="p-4 space-y-1">
        {[100, 200, 300, 500, 1000].map((amount, idx) => (
          <div
            key={amount}
            className="p-2 rounded text-center text-sm"
            style={{
              backgroundColor: idx === 2 ? colors.accent || colors.primary : colors.surface,
              color: idx === 2 ? colors.textOnPrimary || 'white' : colors.textPrimary,
              opacity: idx < 2 ? 0.5 : 1
            }}
          >
            ${amount.toLocaleString()}
          </div>
        ))}
      </div>

      {/* Game buttons */}
      <div className="p-4 grid grid-cols-2 gap-2">
        <button
          className="p-3 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: colors.surface,
            border: `2px solid ${colors.border}`,
            color: colors.textPrimary
          }}
        >
          A: Option One
        </button>
        <button
          className="p-3 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: colors.primaryLight,
            border: `2px solid ${colors.primary}`,
            color: colors.primary
          }}
        >
          B: Selected
        </button>
        <button
          className="p-3 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: colors.successLight,
            border: `2px solid ${colors.success}`,
            color: colors.success
          }}
        >
          C: Correct
        </button>
        <button
          className="p-3 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: colors.errorLight,
            border: `2px solid ${colors.error}`,
            color: colors.error
          }}
        >
          D: Wrong
        </button>
      </div>
    </div>
  )
}

function getBackgroundCSS(background: ThemeBackground, colors: ThemeColors): React.CSSProperties {
  let bg = colors.background

  if (background.type === 'gradient' && background.value) {
    bg = background.value
  } else if (background.type === 'solid' && background.value) {
    bg = background.value
  }

  if (background.pattern && background.pattern.type !== 'none') {
    const pattern = generatePattern(background.pattern)
    bg = `${pattern}, ${bg}`
  }

  return { background: bg }
}

export default ThemeLivePreview

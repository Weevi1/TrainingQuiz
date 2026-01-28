// TypographyEditor - Configure fonts and text styles
import React, { useEffect, useState } from 'react'
import { Type, Eye } from 'lucide-react'
import { availableFonts, type FontName, loadFont, isFontLoaded } from '../../lib/fontLoader'
import type { ThemeTypography } from '../../lib/themePresets'

interface TypographyEditorProps {
  typography: ThemeTypography
  onChange: (typography: ThemeTypography) => void
}

// Group fonts by category
const fontCategories = {
  'Sans-Serif': ['Inter', 'Open Sans', 'Poppins', 'Nunito', 'Roboto', 'Lato', 'Montserrat', 'Source Sans Pro', 'Raleway'],
  'Serif': ['Playfair Display', 'Merriweather', 'Lora', 'Georgia'],
  'Display': ['Cinzel', 'Cinzel Decorative', 'Cormorant Garamond'],
  'Monospace': ['JetBrains Mono', 'Fira Code', 'Source Code Pro'],
  'System': ['system-ui', 'sans-serif', 'serif', 'monospace']
}

export const TypographyEditor: React.FC<TypographyEditorProps> = ({
  typography,
  onChange
}) => {
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog')
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set())

  // Extract current font names
  const currentBodyFont = typography.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim() || 'Inter'
  const currentHeadingFont = typography.fontFamilyHeading?.split(',')[0]?.replace(/['"]/g, '').trim() || currentBodyFont

  const handleFontChange = async (type: 'body' | 'heading', fontName: string) => {
    // Load font if not already loaded
    if (!isFontLoaded(fontName) && fontName in availableFonts) {
      setLoadingFonts(prev => new Set(prev).add(fontName))
      await loadFont(fontName)
      setLoadingFonts(prev => {
        const next = new Set(prev)
        next.delete(fontName)
        return next
      })
    }

    // Build font stack with fallbacks
    const fontStack = buildFontStack(fontName)

    if (type === 'body') {
      onChange({
        ...typography,
        fontFamily: fontStack
      })
    } else {
      onChange({
        ...typography,
        fontFamilyHeading: fontStack
      })
    }
  }

  const handleWeightChange = (weight: keyof NonNullable<ThemeTypography['fontWeights']>, value: number) => {
    onChange({
      ...typography,
      fontWeights: {
        ...typography.fontWeights,
        [weight]: value
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Typography</h3>
        <p className="text-sm text-text-secondary">
          Choose fonts for your organization's branded experience
        </p>
      </div>

      {/* Body Font Selection */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 font-medium">
          <Type size={16} />
          Body Font
        </label>
        <FontSelector
          value={currentBodyFont}
          onChange={(font) => handleFontChange('body', font)}
          loadingFonts={loadingFonts}
        />
        <p className="text-sm text-text-secondary">
          Used for paragraphs, questions, and general content
        </p>
      </div>

      {/* Heading Font Selection */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 font-medium">
          <Type size={18} />
          Heading Font
        </label>
        <FontSelector
          value={currentHeadingFont}
          onChange={(font) => handleFontChange('heading', font)}
          loadingFonts={loadingFonts}
        />
        <p className="text-sm text-text-secondary">
          Used for titles, headers, and important text
        </p>
      </div>

      {/* Font Weights */}
      <div className="space-y-3">
        <label className="font-medium">Font Weights</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <WeightInput
            label="Normal"
            value={typography.fontWeights?.normal || 400}
            onChange={(v) => handleWeightChange('normal', v)}
          />
          <WeightInput
            label="Medium"
            value={typography.fontWeights?.medium || 500}
            onChange={(v) => handleWeightChange('medium', v)}
          />
          <WeightInput
            label="Semibold"
            value={typography.fontWeights?.semibold || 600}
            onChange={(v) => handleWeightChange('semibold', v)}
          />
          <WeightInput
            label="Bold"
            value={typography.fontWeights?.bold || 700}
            onChange={(v) => handleWeightChange('bold', v)}
          />
        </div>
      </div>

      {/* Live Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 font-medium">
            <Eye size={16} />
            Preview
          </label>
          <input
            type="text"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            className="text-sm border rounded px-2 py-1 w-64"
            style={{ borderColor: 'var(--border-color)' }}
            placeholder="Enter preview text..."
          />
        </div>

        <div
          className="p-6 rounded-lg border space-y-4"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-color)' }}
        >
          {/* Heading preview */}
          <h1
            className="text-3xl"
            style={{
              fontFamily: typography.fontFamilyHeading || typography.fontFamily,
              fontWeight: typography.fontWeights?.bold || 700
            }}
          >
            {previewText}
          </h1>

          {/* Subheading preview */}
          <h2
            className="text-xl"
            style={{
              fontFamily: typography.fontFamilyHeading || typography.fontFamily,
              fontWeight: typography.fontWeights?.semibold || 600
            }}
          >
            {previewText}
          </h2>

          {/* Body preview */}
          <p
            className="text-base"
            style={{
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeights?.normal || 400
            }}
          >
            {previewText}
          </p>

          {/* Small text preview */}
          <p
            className="text-sm text-text-secondary"
            style={{
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeights?.normal || 400
            }}
          >
            {previewText}
          </p>
        </div>
      </div>
    </div>
  )
}

interface FontSelectorProps {
  value: string
  onChange: (font: string) => void
  loadingFonts: Set<string>
}

const FontSelector: React.FC<FontSelectorProps> = ({
  value,
  onChange,
  loadingFonts
}) => {
  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
        style={{
          borderColor: 'var(--border-color)',
          fontFamily: value in availableFonts ? `"${value}", system-ui` : 'system-ui'
        }}
      >
        {Object.entries(fontCategories).map(([category, fonts]) => (
          <optgroup key={category} label={category}>
            {fonts.map(font => (
              <option
                key={font}
                value={font}
                style={{ fontFamily: font in availableFonts ? `"${font}", system-ui` : 'system-ui' }}
              >
                {font} {loadingFonts.has(font) ? '(Loading...)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Font preview */}
      <div
        className="text-lg p-2 border rounded"
        style={{
          fontFamily: `"${value}", system-ui`,
          borderColor: 'var(--border-color)'
        }}
      >
        Aa Bb Cc 123
      </div>
    </div>
  )
}

interface WeightInputProps {
  label: string
  value: number
  onChange: (value: number) => void
}

const WeightInput: React.FC<WeightInputProps> = ({
  label,
  value,
  onChange
}) => {
  const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900]

  return (
    <div className="space-y-1">
      <label className="text-sm text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1 border rounded text-sm"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {weights.map(w => (
          <option key={w} value={w}>{w}</option>
        ))}
      </select>
    </div>
  )
}

function buildFontStack(fontName: string): string {
  // System fonts don't need quotes or fallbacks
  if (['system-ui', 'sans-serif', 'serif', 'monospace'].includes(fontName)) {
    return fontName
  }

  // Determine appropriate fallback based on font category
  let fallback = 'system-ui, -apple-system, sans-serif'

  if (['Playfair Display', 'Merriweather', 'Lora', 'Georgia', 'Cinzel', 'Cinzel Decorative', 'Cormorant Garamond'].includes(fontName)) {
    fallback = 'Georgia, "Times New Roman", serif'
  } else if (['JetBrains Mono', 'Fira Code', 'Source Code Pro'].includes(fontName)) {
    fallback = '"SF Mono", Monaco, Consolas, monospace'
  }

  return `"${fontName}", ${fallback}`
}

export default TypographyEditor

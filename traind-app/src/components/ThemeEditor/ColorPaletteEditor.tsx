// ColorPaletteEditor - Edit individual theme colors with live preview
import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { ThemeColors } from '../../lib/themePresets'

interface ColorPaletteEditorProps {
  colors: ThemeColors
  onChange: (colors: ThemeColors) => void
}

type ColorGroup = {
  title: string
  description: string
  colors: Array<{
    key: keyof ThemeColors
    label: string
    description: string
  }>
}

const colorGroups: ColorGroup[] = [
  {
    title: 'Brand Colors',
    description: 'Core colors that define your brand identity',
    colors: [
      { key: 'primary', label: 'Primary', description: 'Main brand color' },
      { key: 'primaryLight', label: 'Primary Light', description: 'Lighter variant for backgrounds' },
      { key: 'primaryDark', label: 'Primary Dark', description: 'Darker variant for text/borders' },
      { key: 'secondary', label: 'Secondary', description: 'Supporting brand color' },
      { key: 'secondaryLight', label: 'Secondary Light', description: 'Lighter secondary' },
      { key: 'secondaryDark', label: 'Secondary Dark', description: 'Darker secondary' }
    ]
  },
  {
    title: 'UI Colors',
    description: 'Colors for backgrounds, surfaces, and text',
    colors: [
      { key: 'background', label: 'Background', description: 'Page background' },
      { key: 'surface', label: 'Surface', description: 'Cards and elevated elements' },
      { key: 'border', label: 'Border', description: 'Borders and dividers' },
      { key: 'textPrimary', label: 'Text Primary', description: 'Main text color' },
      { key: 'textSecondary', label: 'Text Secondary', description: 'Muted text color' },
      { key: 'textOnPrimary', label: 'Text on Primary', description: 'Text on primary color' }
    ]
  },
  {
    title: 'Feedback Colors',
    description: 'Colors for success, error, and warning states',
    colors: [
      { key: 'success', label: 'Success', description: 'Correct answers, positive feedback' },
      { key: 'successLight', label: 'Success Light', description: 'Success background' },
      { key: 'error', label: 'Error', description: 'Wrong answers, errors' },
      { key: 'errorLight', label: 'Error Light', description: 'Error background' },
      { key: 'warning', label: 'Warning', description: 'Warnings, cautions' },
      { key: 'warningLight', label: 'Warning Light', description: 'Warning background' }
    ]
  },
  {
    title: 'Game & Accent Colors',
    description: 'Colors for games, celebrations, and special effects',
    colors: [
      { key: 'accent', label: 'Accent', description: 'Highlights and accents' },
      { key: 'gameAccent', label: 'Game Accent', description: 'Game-specific highlight' },
      { key: 'streak', label: 'Streak', description: 'Streak indicators' },
      { key: 'celebration', label: 'Celebration', description: 'Win celebrations' }
    ]
  }
]

export const ColorPaletteEditor: React.FC<ColorPaletteEditorProps> = ({
  colors,
  onChange
}) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Brand Colors')

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    onChange({
      ...colors,
      [key]: value
    })
  }

  const handleAutoGenerateLightDark = (baseKey: keyof ThemeColors) => {
    const baseColor = colors[baseKey]
    if (!baseColor) return

    // Simple light/dark generation using CSS color-mix
    // In production, you might want a more sophisticated algorithm
    const lightKey = `${baseKey}Light` as keyof ThemeColors
    const darkKey = `${baseKey}Dark` as keyof ThemeColors

    if (lightKey in colors) {
      handleColorChange(lightKey, lightenColor(baseColor, 0.85))
    }
    if (darkKey in colors) {
      handleColorChange(darkKey, darkenColor(baseColor, 0.3))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Color Palette</h3>
        <p className="text-sm text-text-secondary">
          Customize individual colors for your organization's theme
        </p>
      </div>

      <div className="space-y-4">
        {colorGroups.map(group => (
          <div
            key={group.title}
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <button
              onClick={() => setExpandedGroup(expandedGroup === group.title ? null : group.title)}
              className="w-full p-4 text-left flex items-center justify-between"
              style={{ backgroundColor: 'var(--surface-color)' }}
            >
              <div>
                <h4 className="font-medium">{group.title}</h4>
                <p className="text-sm text-text-secondary">{group.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Preview swatches */}
                {group.colors.slice(0, 4).map(({ key }) => (
                  <div
                    key={key}
                    className="w-4 h-4 rounded-full border"
                    style={{
                      backgroundColor: colors[key] || 'transparent',
                      borderColor: 'rgba(0,0,0,0.1)'
                    }}
                  />
                ))}
                <span className="text-text-secondary ml-2">
                  {expandedGroup === group.title ? '−' : '+'}
                </span>
              </div>
            </button>

            {expandedGroup === group.title && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.colors.map(({ key, label, description }) => (
                  <ColorInput
                    key={key}
                    label={label}
                    description={description}
                    value={colors[key] || '#000000'}
                    onChange={(value) => handleColorChange(key, value)}
                    onAutoGenerate={
                      (key === 'primary' || key === 'secondary')
                        ? () => handleAutoGenerateLightDark(key)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface ColorInputProps {
  label: string
  description: string
  value: string
  onChange: (value: string) => void
  onAutoGenerate?: () => void
}

const ColorInput: React.FC<ColorInputProps> = ({
  label,
  description,
  value,
  onChange,
  onAutoGenerate
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {onAutoGenerate && (
          <button
            onClick={onAutoGenerate}
            className="p-1 text-text-secondary hover:text-primary transition-colors"
            title="Auto-generate light/dark variants"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border-0 p-0"
            style={{ backgroundColor: value }}
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1 text-sm font-mono border rounded"
          style={{ borderColor: 'var(--border-color)' }}
          placeholder="#000000"
        />
      </div>
      <p className="text-xs text-text-secondary">{description}</p>
    </div>
  )
}

// Color manipulation helpers
function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const lightened = {
    r: Math.round(rgb.r + (255 - rgb.r) * amount),
    g: Math.round(rgb.g + (255 - rgb.g) * amount),
    b: Math.round(rgb.b + (255 - rgb.b) * amount)
  }

  return rgbToHex(lightened.r, lightened.g, lightened.b)
}

function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const darkened = {
    r: Math.round(rgb.r * (1 - amount)),
    g: Math.round(rgb.g * (1 - amount)),
    b: Math.round(rgb.b * (1 - amount))
  }

  return rgbToHex(darkened.r, darkened.g, darkened.b)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, x)).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

export default ColorPaletteEditor

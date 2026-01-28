// BackgroundEditor - Configure background colors, gradients, and patterns
import React, { useState } from 'react'
import { Palette, Image, Grid3X3, Droplets } from 'lucide-react'
import { type PatternType, patternPresets, gradientPresets, generatePattern, generateGradient } from '../../lib/backgroundPatterns'
import type { ThemeBackground } from '../../lib/themePresets'

interface BackgroundEditorProps {
  background: ThemeBackground
  primaryColor: string
  onChange: (background: ThemeBackground) => void
}

export const BackgroundEditor: React.FC<BackgroundEditorProps> = ({
  background,
  primaryColor,
  onChange
}) => {
  const [activeTab, setActiveTab] = useState<'solid' | 'gradient' | 'pattern'>('solid')

  const tabs = [
    { id: 'solid' as const, label: 'Solid', icon: Droplets },
    { id: 'gradient' as const, label: 'Gradient', icon: Palette },
    { id: 'pattern' as const, label: 'Pattern', icon: Grid3X3 }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Background</h3>
        <p className="text-sm text-text-secondary">
          Customize the background appearance for your training sessions
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === tab.id ? 'font-medium' : 'text-text-secondary hover:text-text-primary'
            }`}
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--primary-light-color)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary-color)' : undefined
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'solid' && (
        <SolidColorEditor
          background={background}
          onChange={onChange}
        />
      )}

      {activeTab === 'gradient' && (
        <GradientEditor
          background={background}
          primaryColor={primaryColor}
          onChange={onChange}
        />
      )}

      {activeTab === 'pattern' && (
        <PatternEditor
          background={background}
          primaryColor={primaryColor}
          onChange={onChange}
        />
      )}

      {/* Preview */}
      <div className="space-y-2">
        <label className="font-medium">Preview</label>
        <div
          className="h-40 rounded-lg border overflow-hidden"
          style={{
            borderColor: 'var(--border-color)',
            background: getBackgroundPreview(background)
          }}
        >
          <div className="h-full flex items-center justify-center">
            <div
              className="px-6 py-4 rounded-lg shadow-lg"
              style={{ backgroundColor: 'var(--surface-color)' }}
            >
              <p className="font-medium">Sample Content Card</p>
              <p className="text-sm text-text-secondary">This is how content will look</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay Option */}
      <div className="space-y-3">
        <label className="font-medium">Overlay (Optional)</label>
        <p className="text-sm text-text-secondary">
          Add a semi-transparent overlay to improve text readability
        </p>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={background.overlay || '#000000'}
            onChange={(e) => onChange({ ...background, overlay: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border-0"
          />
          <input
            type="range"
            min="0"
            max="0.8"
            step="0.05"
            value={extractOverlayOpacity(background.overlay) || 0}
            onChange={(e) => {
              const opacity = parseFloat(e.target.value)
              const color = background.overlay?.replace(/[\d.]+\)$/, '') || 'rgba(0,0,0,'
              onChange({ ...background, overlay: opacity > 0 ? `${color}${opacity})` : undefined })
            }}
            className="flex-1"
          />
          <span className="text-sm text-text-secondary w-12">
            {Math.round((extractOverlayOpacity(background.overlay) || 0) * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}

interface SolidColorEditorProps {
  background: ThemeBackground
  onChange: (background: ThemeBackground) => void
}

const SolidColorEditor: React.FC<SolidColorEditorProps> = ({
  background,
  onChange
}) => {
  const presetColors = [
    '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
    '#0f172a', '#1e293b', '#334155', '#475569',
    '#f0f9ff', '#e0f2fe', '#fef3c7', '#fce7f3'
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Background Color</label>
        <div className="flex items-center gap-4">
          <input
            type="color"
            value={background.type === 'solid' ? background.value || '#ffffff' : '#ffffff'}
            onChange={(e) => onChange({ type: 'solid', value: e.target.value })}
            className="w-12 h-12 rounded cursor-pointer border-0"
          />
          <input
            type="text"
            value={background.type === 'solid' ? background.value || '' : ''}
            onChange={(e) => onChange({ type: 'solid', value: e.target.value })}
            className="flex-1 px-3 py-2 border rounded font-mono"
            style={{ borderColor: 'var(--border-color)' }}
            placeholder="#ffffff"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Quick Select</label>
        <div className="flex flex-wrap gap-2">
          {presetColors.map(color => (
            <button
              key={color}
              onClick={() => onChange({ type: 'solid', value: color })}
              className={`w-8 h-8 rounded border-2 transition-all ${
                background.type === 'solid' && background.value === color
                  ? 'ring-2 ring-offset-2'
                  : ''
              }`}
              style={{
                backgroundColor: color,
                borderColor: color === '#ffffff' ? 'var(--border-color)' : 'transparent',
                ['--tw-ring-color' as string]: 'var(--primary-color)'
              }}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface GradientEditorProps {
  background: ThemeBackground
  primaryColor: string
  onChange: (background: ThemeBackground) => void
}

const GradientEditor: React.FC<GradientEditorProps> = ({
  background,
  primaryColor,
  onChange
}) => {
  const gradientOptions = Object.entries(gradientPresets)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Preset Gradients</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {gradientOptions.map(([name, config]) => {
            const gradientValue = generateGradient(config)
            const isSelected = background.type === 'gradient' && background.value === gradientValue

            return (
              <button
                key={name}
                onClick={() => onChange({ type: 'gradient', value: gradientValue })}
                className={`h-16 rounded-lg border-2 transition-all ${
                  isSelected ? 'ring-2 ring-offset-2' : ''
                }`}
                style={{
                  background: gradientValue,
                  borderColor: isSelected ? 'var(--primary-color)' : 'transparent',
                  ['--tw-ring-color' as string]: 'var(--primary-color)'
                }}
                title={name.replace(/-/g, ' ')}
              >
                <span
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    color: 'var(--text-secondary-color, #374151)'
                  }}
                >
                  {name.replace(/-/g, ' ')}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Custom Gradient</label>
        <textarea
          value={background.type === 'gradient' ? background.value || '' : ''}
          onChange={(e) => onChange({ type: 'gradient', value: e.target.value })}
          className="w-full px-3 py-2 border rounded font-mono text-sm"
          style={{ borderColor: 'var(--border-color)' }}
          rows={2}
          placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
        <p className="text-xs text-text-secondary mt-1">
          Enter a valid CSS gradient value
        </p>
      </div>
    </div>
  )
}

interface PatternEditorProps {
  background: ThemeBackground
  primaryColor: string
  onChange: (background: ThemeBackground) => void
}

const PatternEditor: React.FC<PatternEditorProps> = ({
  background,
  primaryColor,
  onChange
}) => {
  const patternOptions: Array<{ name: string; type: PatternType; description: string }> = [
    { name: 'None', type: 'none', description: 'No pattern' },
    { name: 'Dots', type: 'dots', description: 'Subtle dot grid' },
    { name: 'Grid', type: 'grid', description: 'Light grid lines' },
    { name: 'Diagonal', type: 'diagonal-lines', description: 'Diagonal stripes' },
    { name: 'Waves', type: 'waves', description: 'Flowing wave lines' },
    { name: 'Circuit', type: 'circuit', description: 'Tech-inspired circuits' },
    { name: 'Hexagons', type: 'hexagons', description: 'Honeycomb pattern' },
    { name: 'Triangles', type: 'triangles', description: 'Geometric triangles' },
    { name: 'Topography', type: 'topography', description: 'Contour map lines' }
  ]

  const currentPattern = background.pattern?.type || 'none'
  const currentOpacity = background.pattern?.opacity || 0.05
  const currentScale = background.pattern?.scale || 1
  const baseColor = background.type === 'solid' ? background.value : '#f8fafc'

  const handlePatternChange = (type: PatternType) => {
    if (type === 'none') {
      onChange({ ...background, pattern: undefined })
    } else {
      onChange({
        ...background,
        pattern: {
          type,
          color: primaryColor,
          opacity: currentOpacity,
          scale: currentScale
        }
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Pattern Type</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {patternOptions.map(({ name, type, description }) => {
            const patternPreview = type !== 'none'
              ? generatePattern({ type, color: '#000000', opacity: 0.3, scale: 1 })
              : 'none'

            return (
              <button
                key={type}
                onClick={() => handlePatternChange(type)}
                className={`h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                  currentPattern === type ? 'ring-2 ring-offset-2' : ''
                }`}
                style={{
                  background: type !== 'none' ? `${patternPreview}, #f8fafc` : '#f8fafc',
                  borderColor: currentPattern === type ? 'var(--primary-color)' : 'var(--border-color)',
                  ['--tw-ring-color' as string]: 'var(--primary-color)'
                }}
                title={description}
              >
                <span className="text-xs font-medium">{name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {currentPattern !== 'none' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">Pattern Color</label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={background.pattern?.color || primaryColor}
                onChange={(e) => onChange({
                  ...background,
                  pattern: { ...background.pattern!, color: e.target.value }
                })}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
              <span className="text-sm text-text-secondary">
                {background.pattern?.color || primaryColor}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Opacity: {Math.round(currentOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0.01"
              max="0.3"
              step="0.01"
              value={currentOpacity}
              onChange={(e) => onChange({
                ...background,
                pattern: { ...background.pattern!, opacity: parseFloat(e.target.value) }
              })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Scale: {currentScale.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={currentScale}
              onChange={(e) => onChange({
                ...background,
                pattern: { ...background.pattern!, scale: parseFloat(e.target.value) }
              })}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  )
}

function getBackgroundPreview(background: ThemeBackground): string {
  let bg = ''

  // Add pattern layer if present
  if (background.pattern && background.pattern.type !== 'none') {
    bg = generatePattern(background.pattern)
  }

  // Add base layer
  if (background.type === 'gradient' && background.value) {
    bg = bg ? `${bg}, ${background.value}` : background.value
  } else if (background.type === 'solid' && background.value) {
    bg = bg ? `${bg}, ${background.value}` : background.value
  } else {
    bg = bg ? `${bg}, #f8fafc` : '#f8fafc'
  }

  // Add overlay if present
  if (background.overlay) {
    bg = `linear-gradient(${background.overlay}, ${background.overlay}), ${bg}`
  }

  return bg
}

function extractOverlayOpacity(overlay: string | undefined): number {
  if (!overlay) return 0
  const match = overlay.match(/[\d.]+\)$/)
  return match ? parseFloat(match[0]) : 0
}

export default BackgroundEditor

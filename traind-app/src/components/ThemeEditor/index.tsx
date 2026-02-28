// ThemeEditor - Main component for organization theme customization
import React, { useState, useEffect } from 'react'
import { Palette, Type, Image, Eye, Save, RotateCcw, Check } from 'lucide-react'
import { ThemePresetGallery } from './ThemePresetGallery'
import { ColorPaletteEditor } from './ColorPaletteEditor'
import { TypographyEditor } from './TypographyEditor'
import { BackgroundEditor } from './BackgroundEditor'
import { ThemeLivePreview } from './ThemeLivePreview'
import { getThemePreset, type ThemePresetId, type ThemeColors, type ThemeTypography, type ThemeBackground, type ThemeEffects } from '../../lib/themePresets'
import { loadThemeFonts } from '../../lib/fontLoader'

export interface ThemeEditorData {
  themePreset: ThemePresetId
  colors: ThemeColors
  typography: ThemeTypography
  background: ThemeBackground
  effects: ThemeEffects
}

interface ThemeEditorProps {
  initialData?: Partial<ThemeEditorData>
  onSave: (data: ThemeEditorData) => Promise<void>
  onPreview?: (data: ThemeEditorData) => void
  onCancel?: () => void
}

type EditorTab = 'presets' | 'colors' | 'typography' | 'background'

export const ThemeEditor: React.FC<ThemeEditorProps> = ({
  initialData,
  onSave,
  onPreview,
  onCancel
}) => {
  const [activeTab, setActiveTab] = useState<EditorTab>('presets')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Theme state
  const [themePreset, setThemePreset] = useState<ThemePresetId>(
    initialData?.themePreset || 'corporate-blue'
  )
  const [colors, setColors] = useState<ThemeColors>(
    initialData?.colors || getThemePreset('corporate-blue').colors
  )
  const [typography, setTypography] = useState<ThemeTypography>(
    initialData?.typography || getThemePreset('corporate-blue').typography || {}
  )
  const [background, setBackground] = useState<ThemeBackground>(
    initialData?.background || getThemePreset('corporate-blue').background || { type: 'solid', value: '#f8fafc' }
  )
  const [effects, setEffects] = useState<ThemeEffects>(
    initialData?.effects || getThemePreset('corporate-blue').effects || {}
  )

  // Track changes and apply live preview
  const isInitialMount = React.useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setHasChanges(true)
    onPreview?.({ themePreset, colors, typography, background, effects })
  }, [themePreset, colors, typography, background, effects])

  // Load fonts when typography changes
  useEffect(() => {
    if (typography.fontFamily || typography.fontFamilyHeading) {
      loadThemeFonts(
        typography.fontFamily || 'Inter',
        typography.fontFamilyHeading
      )
    }
  }, [typography.fontFamily, typography.fontFamilyHeading])

  const handlePresetSelect = (presetId: ThemePresetId) => {
    const preset = getThemePreset(presetId)
    setThemePreset(presetId)
    setColors(preset.colors)
    if (preset.typography) setTypography(preset.typography)
    if (preset.background) setBackground(preset.background)
    if (preset.effects) setEffects(preset.effects)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        themePreset,
        colors,
        typography,
        background,
        effects
      })
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving theme:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const resetPreset = initialData?.themePreset || 'corporate-blue'
    const preset = getThemePreset(resetPreset)
    const resetColors = initialData?.colors || preset.colors
    const resetTypography = initialData?.typography || preset.typography
    const resetBackground = initialData?.background || preset.background
    const resetEffects = initialData?.effects || preset.effects

    setThemePreset(resetPreset)
    setColors(resetColors)
    setTypography(resetTypography)
    setBackground(resetBackground)
    setEffects(resetEffects)
    setHasChanges(false)

    onPreview?.({ themePreset: resetPreset, colors: resetColors, typography: resetTypography, background: resetBackground, effects: resetEffects })
  }

  const tabs = [
    { id: 'presets' as const, label: 'Presets', icon: Palette },
    { id: 'colors' as const, label: 'Colors', icon: Palette },
    { id: 'typography' as const, label: 'Typography', icon: Type },
    { id: 'background' as const, label: 'Background', icon: Image }
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Editor Panel */}
      <div className="lg:col-span-2 space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'font-medium'
                  : 'text-text-secondary hover:text-text-primary'
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
        <div className="min-h-[400px]">
          {activeTab === 'presets' && (
            <ThemePresetGallery
              selectedPreset={themePreset}
              onSelectPreset={handlePresetSelect}
            />
          )}

          {activeTab === 'colors' && (
            <ColorPaletteEditor
              colors={colors}
              onChange={setColors}
            />
          )}

          {activeTab === 'typography' && (
            <TypographyEditor
              typography={typography}
              onChange={setTypography}
            />
          )}

          {activeTab === 'background' && (
            <BackgroundEditor
              background={background}
              primaryColor={colors.primary}
              onChange={setBackground}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-text-secondary flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning" />
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-surface transition-colors"
              style={{ borderColor: 'var(--border-color)' }}
              disabled={!hasChanges}
            >
              <RotateCcw size={16} />
              Reset
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: 'var(--primary-color)',
                color: 'var(--text-on-primary-color)'
              }}
            >
              {saving ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Theme
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="lg:col-span-1">
        <div
          className="sticky top-4 p-4 rounded-lg border"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-color)' }}
        >
          <ThemeLivePreview
            colors={colors}
            typography={typography}
            background={background}
          />
        </div>
      </div>
    </div>
  )
}

// Export all sub-components
export { ThemePresetGallery } from './ThemePresetGallery'
export { ColorPaletteEditor } from './ColorPaletteEditor'
export { TypographyEditor } from './TypographyEditor'
export { BackgroundEditor } from './BackgroundEditor'
export { ThemeLivePreview } from './ThemeLivePreview'

export default ThemeEditor

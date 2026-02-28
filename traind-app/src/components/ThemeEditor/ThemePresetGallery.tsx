// ThemePresetGallery - Visual grid of available theme presets
import React from 'react'
import { Check } from 'lucide-react'
import { getAllThemePresets, type ThemePresetId, type ThemePreset } from '../../lib/themePresets'

interface ThemePresetGalleryProps {
  selectedPreset: ThemePresetId
  onSelectPreset: (presetId: ThemePresetId) => void
}

export const ThemePresetGallery: React.FC<ThemePresetGalleryProps> = ({
  selectedPreset,
  onSelectPreset
}) => {
  const presets = getAllThemePresets()

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Theme Presets</h3>
      <p className="text-sm text-text-secondary">
        Choose a theme preset as your starting point. You can customize colors after selecting.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.map((preset) => (
          <ThemePresetCard
            key={preset.id}
            id={preset.id}
            preset={preset}
            isSelected={selectedPreset === preset.id}
            onSelect={() => onSelectPreset(preset.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface ThemePresetCardProps {
  id: ThemePresetId
  preset: ThemePreset
  isSelected: boolean
  onSelect: () => void
}

const ThemePresetCard: React.FC<ThemePresetCardProps> = ({
  id,
  preset,
  isSelected,
  onSelect
}) => {
  const { colors, typography, background } = preset

  // Generate preview background
  const previewBg = background?.type === 'gradient' && background.value
    ? background.value
    : colors.background

  return (
    <button
      onClick={onSelect}
      className={`relative p-4 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'ring-2 ring-offset-2'
          : 'hover:shadow-lg'
      }`}
      style={{
        borderColor: isSelected ? colors.primary : 'var(--border-color)',
        ['--tw-ring-color' as string]: colors.primary
      }}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: colors.primary }}
        >
          <Check size={14} style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
        </div>
      )}

      {/* Preview area */}
      <div
        className="h-24 rounded-lg mb-3 overflow-hidden"
        style={{ background: previewBg }}
      >
        {/* Mini UI preview */}
        <div className="p-2 h-full flex flex-col justify-between">
          {/* Header preview */}
          <div
            className="h-3 w-16 rounded"
            style={{ backgroundColor: colors.primary }}
          />

          {/* Content preview */}
          <div className="flex gap-1">
            <div
              className="h-6 flex-1 rounded"
              style={{ backgroundColor: colors.surface }}
            />
            <div
              className="h-6 w-8 rounded"
              style={{ backgroundColor: colors.success }}
            />
            <div
              className="h-6 w-8 rounded"
              style={{ backgroundColor: colors.error }}
            />
          </div>

          {/* Button preview */}
          <div
            className="h-4 w-20 rounded"
            style={{ backgroundColor: colors.accent || colors.primary }}
          />
        </div>
      </div>

      {/* Preset info */}
      <div className="space-y-1">
        <h4 className="font-medium">{preset.name}</h4>
        <p className="text-xs text-text-secondary line-clamp-2">
          {preset.description}
        </p>
      </div>

      {/* Color swatches */}
      <div className="flex gap-1 mt-2">
        <div
          className="w-5 h-5 rounded-full border"
          style={{ backgroundColor: colors.primary, borderColor: 'rgba(0,0,0,0.1)' }}
          title="Primary"
        />
        <div
          className="w-5 h-5 rounded-full border"
          style={{ backgroundColor: colors.secondary, borderColor: 'rgba(0,0,0,0.1)' }}
          title="Secondary"
        />
        <div
          className="w-5 h-5 rounded-full border"
          style={{ backgroundColor: colors.accent || colors.primary, borderColor: 'rgba(0,0,0,0.1)' }}
          title="Accent"
        />
        <div
          className="w-5 h-5 rounded-full border"
          style={{ backgroundColor: colors.success, borderColor: 'rgba(0,0,0,0.1)' }}
          title="Success"
        />
        <div
          className="w-5 h-5 rounded-full border"
          style={{ backgroundColor: colors.error, borderColor: 'rgba(0,0,0,0.1)' }}
          title="Error"
        />
      </div>

      {/* Typography preview */}
      <div
        className="mt-2 text-xs truncate"
        style={{ fontFamily: typography?.fontFamily || 'inherit' }}
      >
        Font: {typography?.fontFamily?.split(',')[0]?.replace(/['"]/g, '') || 'System'}
      </div>
    </button>
  )
}

export default ThemePresetGallery

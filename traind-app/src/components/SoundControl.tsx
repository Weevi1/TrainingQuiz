import React, { useState } from 'react'
import { Volume2, VolumeX, Music, Settings, X } from 'lucide-react'
import { useSoundContextOptional } from '../contexts/SoundContext'
import { soundSystem } from '../lib/soundSystem'

interface SoundControlProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showMusicControl?: boolean
  minimal?: boolean
}

export const SoundControl: React.FC<SoundControlProps> = ({
  position = 'bottom-right',
  showMusicControl = false,
  minimal = true
}) => {
  const [expanded, setExpanded] = useState(false)
  const soundContext = useSoundContextOptional()

  // Fallback state if no context provider
  const [localSoundEnabled, setLocalSoundEnabled] = useState(true)

  const soundEnabled = soundContext?.soundEnabled ?? localSoundEnabled
  const setSoundEnabled = soundContext?.setSoundEnabled ?? ((enabled: boolean) => {
    setLocalSoundEnabled(enabled)
    soundSystem.setEnabled(enabled)
  })

  const volume = soundContext?.volume ?? 0.7
  const setVolume = soundContext?.setVolume ?? soundSystem.setVolume.bind(soundSystem)

  const musicEnabled = soundContext?.musicEnabled ?? true
  const setMusicEnabled = soundContext?.setMusicEnabled ?? (() => {})

  const musicVolume = soundContext?.musicVolume ?? 0.3
  const setMusicVolume = soundContext?.setMusicVolume ?? (() => {})

  const positionClasses: Record<string, string> = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  }

  const toggleSound = () => {
    const newEnabled = !soundEnabled
    setSoundEnabled(newEnabled)
    if (newEnabled) {
      soundSystem.play('click')
    }
  }

  if (minimal && !expanded) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <button
          onClick={toggleSound}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            backgroundColor: soundEnabled ? 'var(--primary-color)' : 'var(--surface-color)',
            color: soundEnabled ? 'white' : 'var(--text-secondary-color)',
            border: '2px solid',
            borderColor: soundEnabled ? 'var(--primary-color)' : 'var(--border-color)'
          }}
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>

        {/* Expand button for more options */}
        {showMusicControl && (
          <button
            onClick={() => setExpanded(true)}
            className="absolute -top-1 -left-1 w-6 h-6 rounded-full shadow flex items-center justify-center"
            style={{
              backgroundColor: 'var(--surface-color)',
              color: 'var(--text-secondary-color)',
              border: '1px solid var(--border-color)'
            }}
            title="Sound settings"
          >
            <Settings size={12} />
          </button>
        )}
      </div>
    )
  }

  // Expanded view with more controls
  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <div
        className="rounded-xl shadow-xl p-4 min-w-[240px]"
        style={{
          backgroundColor: 'var(--surface-color)',
          border: '1px solid var(--border-color)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-color)' }}>
            Sound Settings
          </h3>
          <button
            onClick={() => setExpanded(false)}
            className="p-1 rounded hover:bg-gray-100"
            style={{ color: 'var(--text-secondary-color)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Sound Effects Toggle */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {soundEnabled ? (
                  <Volume2 size={16} style={{ color: 'var(--primary-color)' }} />
                ) : (
                  <VolumeX size={16} style={{ color: 'var(--text-secondary-color)' }} />
                )}
                <span className="text-sm font-medium">Sound Effects</span>
              </div>
              <button
                onClick={toggleSound}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                style={{
                  backgroundColor: soundEnabled ? 'var(--primary-color)' : 'var(--border-color)'
                }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Volume Slider */}
            {soundEnabled && (
              <input
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--primary-color) ${volume * 100}%, var(--border-color) ${volume * 100}%)`
                }}
              />
            )}
          </div>

          {/* Music Toggle (if enabled) */}
          {showMusicControl && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Music
                    size={16}
                    style={{ color: musicEnabled ? 'var(--primary-color)' : 'var(--text-secondary-color)' }}
                  />
                  <span className="text-sm font-medium">Background Music</span>
                </div>
                <button
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                  style={{
                    backgroundColor: musicEnabled ? 'var(--primary-color)' : 'var(--border-color)'
                  }}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      musicEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Music Volume Slider */}
              {musicEnabled && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={musicVolume * 100}
                  onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--primary-color) ${musicVolume * 100}%, var(--border-color) ${musicVolume * 100}%)`
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Quick mute all button */}
        <button
          onClick={() => {
            setSoundEnabled(false)
            setMusicEnabled(false)
          }}
          className="w-full mt-4 py-2 text-sm rounded-lg transition-colors"
          style={{
            backgroundColor: 'var(--surface-color)',
            color: 'var(--text-secondary-color)',
            border: '1px solid var(--border-color)'
          }}
        >
          Mute All
        </button>
      </div>
    </div>
  )
}

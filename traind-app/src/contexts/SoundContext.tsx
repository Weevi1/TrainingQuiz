import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { soundSystem } from '../lib/soundSystem'
import { musicSystem } from '../lib/musicSystem'

interface SoundContextValue {
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  volume: number
  setVolume: (volume: number) => void
  musicEnabled: boolean
  setMusicEnabled: (enabled: boolean) => void
  musicVolume: number
  setMusicVolume: (volume: number) => void
}

const SoundContext = createContext<SoundContextValue | undefined>(undefined)

const STORAGE_KEY = 'traind-sound-preferences'

interface StoredPreferences {
  soundEnabled: boolean
  volume: number
  musicEnabled: boolean
  musicVolume: number
}

export const SoundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [soundEnabled, setSoundEnabledState] = useState(true)
  const [volume, setVolumeState] = useState(0.7)
  const [musicEnabled, setMusicEnabledState] = useState(true)
  const [musicVolume, setMusicVolumeState] = useState(0.3)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const prefs: StoredPreferences = JSON.parse(stored)
        setSoundEnabledState(prefs.soundEnabled ?? true)
        setVolumeState(prefs.volume ?? 0.7)
        setMusicEnabledState(prefs.musicEnabled ?? true)
        setMusicVolumeState(prefs.musicVolume ?? 0.3)

        // Apply to systems
        soundSystem.setEnabled(prefs.soundEnabled ?? true)
        soundSystem.setVolume(prefs.volume ?? 0.7)
        musicSystem.setEnabled(prefs.musicEnabled ?? true)
        musicSystem.setMasterVolume(prefs.musicVolume ?? 0.3)
      }
    } catch (e) {
      console.warn('Failed to load sound preferences:', e)
    }
  }, [])

  // Save preferences to localStorage whenever they change
  const savePreferences = (prefs: StoredPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch (e) {
      console.warn('Failed to save sound preferences:', e)
    }
  }

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled)
    soundSystem.setEnabled(enabled)
    savePreferences({ soundEnabled: enabled, volume, musicEnabled, musicVolume })
  }

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    setVolumeState(clampedVolume)
    soundSystem.setVolume(clampedVolume)
    savePreferences({ soundEnabled, volume: clampedVolume, musicEnabled, musicVolume })
  }

  const setMusicEnabled = (enabled: boolean) => {
    setMusicEnabledState(enabled)
    musicSystem.setEnabled(enabled)
    savePreferences({ soundEnabled, volume, musicEnabled: enabled, musicVolume })
  }

  const setMusicVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    setMusicVolumeState(clampedVolume)
    musicSystem.setMasterVolume(clampedVolume)
    savePreferences({ soundEnabled, volume, musicEnabled, musicVolume: clampedVolume })
  }

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        setSoundEnabled,
        volume,
        setVolume,
        musicEnabled,
        setMusicEnabled,
        musicVolume,
        setMusicVolume
      }}
    >
      {children}
    </SoundContext.Provider>
  )
}

export const useSoundContext = (): SoundContextValue => {
  const context = useContext(SoundContext)
  if (context === undefined) {
    throw new Error('useSoundContext must be used within a SoundProvider')
  }
  return context
}

// Optional hook for components that may be outside provider
export const useSoundContextOptional = (): SoundContextValue | null => {
  const context = useContext(SoundContext)
  return context ?? null
}

// Background music system for training games
// Uses HTML5 Audio for music playback with fade effects

export type MusicTrack =
  | 'quiz-ambient'
  | 'quiz-tension'
  | 'victory-fanfare'
  | 'waiting-room'
  | 'countdown'

// Placeholder audio URLs - replace with actual royalty-free tracks
// These can be loaded from public/audio/ or external CDN
const TRACK_URLS: Record<MusicTrack, string> = {
  'quiz-ambient': '/audio/quiz-ambient.mp3',
  'quiz-tension': '/audio/quiz-tension.mp3',
  'victory-fanfare': '/audio/victory-fanfare.mp3',
  'waiting-room': '/audio/waiting-room.mp3',
  'countdown': '/audio/countdown.mp3'
}

interface PlayOptions {
  loop?: boolean
  volume?: number
  fadeIn?: number // milliseconds
}

class MusicSystem {
  private tracks: Map<MusicTrack, HTMLAudioElement> = new Map()
  private currentTrack: HTMLAudioElement | null = null
  private currentTrackName: MusicTrack | null = null
  private masterVolume = 0.3
  private isEnabled = true
  private isDucked = false
  private normalVolume = 0.3
  private duckVolume = 0.1
  private fadeInterval: NodeJS.Timeout | null = null

  constructor() {
    // Pre-load tracks lazily on first play
    this.setupVisibilityHandler()
  }

  // Pause music when tab is hidden, resume when visible
  private setupVisibilityHandler() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseCurrentTrack()
        } else if (this.currentTrack && !this.currentTrack.paused) {
          this.resumeCurrentTrack()
        }
      })
    }
  }

  private pauseCurrentTrack() {
    if (this.currentTrack) {
      this.currentTrack.pause()
    }
  }

  private resumeCurrentTrack() {
    if (this.currentTrack && this.isEnabled) {
      this.currentTrack.play().catch(() => {
        // Autoplay blocked - will resume on next user interaction
      })
    }
  }

  // Load a track (lazy loading)
  async loadTrack(name: MusicTrack): Promise<HTMLAudioElement> {
    if (this.tracks.has(name)) {
      return this.tracks.get(name)!
    }

    const audio = new Audio()
    audio.preload = 'auto'

    // Try to load from URL, fallback to silent if not found
    try {
      audio.src = TRACK_URLS[name]

      // Wait for audio to be loadable
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve()
        audio.onerror = () => {
          console.warn(`Music track not found: ${name}. Using silent mode.`)
          resolve() // Don't reject, just continue without this track
        }
        // Timeout after 5 seconds
        setTimeout(() => resolve(), 5000)
      })

      this.tracks.set(name, audio)
      return audio
    } catch (error) {
      console.warn(`Failed to load track: ${name}`, error)
      // Return a dummy audio element that does nothing
      return audio
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
    if (!enabled && this.currentTrack) {
      this.stop()
    }
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    this.normalVolume = this.masterVolume
    if (this.currentTrack && !this.isDucked) {
      this.currentTrack.volume = this.masterVolume
    }
  }

  async play(name: MusicTrack, options: PlayOptions = {}) {
    if (!this.isEnabled) return

    const {
      loop = true,
      volume = this.masterVolume,
      fadeIn = 500
    } = options

    // Stop current track if different
    if (this.currentTrackName !== name && this.currentTrack) {
      await this.stop(300) // Quick fade out
    }

    try {
      const audio = await this.loadTrack(name)

      // Check if the audio source is valid
      if (!audio.src || audio.error) {
        console.warn(`Track ${name} not available`)
        return
      }

      audio.loop = loop
      audio.volume = fadeIn > 0 ? 0 : volume

      // Start playing
      await audio.play().catch(err => {
        // Autoplay may be blocked - that's OK, user interaction will enable it
        console.log('Music autoplay blocked - will play on next user interaction')
      })

      this.currentTrack = audio
      this.currentTrackName = name

      // Fade in
      if (fadeIn > 0) {
        this.fadeToVolume(volume, fadeIn)
      }
    } catch (error) {
      console.warn('Error playing music track:', error)
    }
  }

  async stop(fadeOut: number = 500) {
    if (!this.currentTrack) return

    if (fadeOut > 0) {
      await this.fadeToVolume(0, fadeOut)
    }

    this.currentTrack.pause()
    this.currentTrack.currentTime = 0
    this.currentTrack = null
    this.currentTrackName = null
  }

  // Lower volume temporarily (duck) for important sound effects
  duck(duration: number = 1000) {
    if (!this.currentTrack) return

    this.isDucked = true
    this.currentTrack.volume = this.duckVolume

    setTimeout(() => {
      this.isDucked = false
      if (this.currentTrack) {
        this.fadeToVolume(this.normalVolume, 300)
      }
    }, duration)
  }

  private fadeToVolume(targetVolume: number, duration: number): Promise<void> {
    return new Promise(resolve => {
      if (!this.currentTrack) {
        resolve()
        return
      }

      // Clear any existing fade
      if (this.fadeInterval) {
        clearInterval(this.fadeInterval)
      }

      const audio = this.currentTrack
      const startVolume = audio.volume
      const volumeDiff = targetVolume - startVolume
      const steps = duration / 50 // Update every 50ms
      const volumeStep = volumeDiff / steps
      let currentStep = 0

      this.fadeInterval = setInterval(() => {
        currentStep++
        audio.volume = Math.max(0, Math.min(1, startVolume + volumeStep * currentStep))

        if (currentStep >= steps) {
          if (this.fadeInterval) {
            clearInterval(this.fadeInterval)
            this.fadeInterval = null
          }
          audio.volume = targetVolume
          resolve()
        }
      }, 50)
    })
  }

  // Check if a track is currently playing
  isPlaying(name?: MusicTrack): boolean {
    if (name) {
      return this.currentTrackName === name && !!this.currentTrack && !this.currentTrack.paused
    }
    return !!this.currentTrack && !this.currentTrack.paused
  }

  // Get current track info
  getCurrentTrack(): MusicTrack | null {
    return this.currentTrackName
  }
}

// Singleton instance
export const musicSystem = new MusicSystem()

// Hook for React components
export const useMusicSystem = (enabled: boolean = true) => {
  musicSystem.setEnabled(enabled)

  return {
    play: musicSystem.play.bind(musicSystem),
    stop: musicSystem.stop.bind(musicSystem),
    duck: musicSystem.duck.bind(musicSystem),
    setVolume: musicSystem.setMasterVolume.bind(musicSystem),
    setEnabled: musicSystem.setEnabled.bind(musicSystem),
    isPlaying: musicSystem.isPlaying.bind(musicSystem),
    getCurrentTrack: musicSystem.getCurrentTrack.bind(musicSystem)
  }
}

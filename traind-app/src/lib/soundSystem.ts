// Comprehensive sound system for training games
// Uses Web Audio API for dynamic sound generation and playback

export type SoundType =
  | 'correct'
  | 'incorrect'
  | 'tick'
  | 'celebration'
  | 'tension'
  | 'whoosh'
  | 'ding'
  | 'buzz'
  | 'fanfare'
  | 'heartbeat'
  | 'click'
  | 'streak'
  | 'achievement'
  | 'timeWarning'
  | 'gameStart'
  | 'gameEnd'

class GameSoundSystem {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private isEnabled = true
  private volume = 0.7

  constructor() {
    this.initialize()
  }

  private async initialize() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.connect(this.audioContext.destination)
      this.masterGain.gain.setValueAtTime(this.volume, this.audioContext.currentTime)
    } catch (error) {
      console.warn('Audio not supported:', error)
      this.audioContext = null
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioContext!.currentTime)
    }
  }

  async play(soundType: SoundType) {
    if (!this.isEnabled || !this.audioContext || !this.masterGain) return

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    const filterNode = this.audioContext.createBiquadFilter()

    oscillator.connect(filterNode)
    filterNode.connect(gainNode)
    gainNode.connect(this.masterGain)

    const now = this.audioContext.currentTime

    switch (soundType) {
      case 'correct':
        this.playCorrectSound(oscillator, gainNode, filterNode, now)
        break

      case 'incorrect':
        this.playIncorrectSound(oscillator, gainNode, filterNode, now)
        break

      case 'tick':
        this.playTickSound(oscillator, gainNode, now)
        break

      case 'celebration':
        this.playCelebrationSound(oscillator, gainNode, filterNode, now)
        break

      case 'tension':
        this.playTensionSound(oscillator, gainNode, now)
        break

      case 'whoosh':
        this.playWhooshSound(oscillator, gainNode, filterNode, now)
        break

      case 'ding':
        this.playDingSound(oscillator, gainNode, now)
        break

      case 'buzz':
        this.playBuzzSound(oscillator, gainNode, now)
        break

      case 'fanfare':
        this.playFanfareSound(oscillator, gainNode, now)
        break

      case 'heartbeat':
        this.playHeartbeatSound(oscillator, gainNode, now)
        break

      case 'click':
        this.playClickSound(oscillator, gainNode, now)
        break

      case 'streak':
        this.playStreakSound(oscillator, gainNode, filterNode, now)
        break

      case 'achievement':
        this.playAchievementSound(oscillator, gainNode, filterNode, now)
        break

      case 'timeWarning':
        this.playTimeWarningSound(oscillator, gainNode, now)
        break

      case 'gameStart':
        this.playGameStartSound(oscillator, gainNode, filterNode, now)
        break

      case 'gameEnd':
        this.playGameEndSound(oscillator, gainNode, filterNode, now)
        break

      default:
        this.playClickSound(oscillator, gainNode, now)
    }

    oscillator.start(now)
  }

  private playCorrectSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Uplifting major chord progression
    osc.frequency.setValueAtTime(523.25, time) // C5
    osc.frequency.setValueAtTime(659.25, time + 0.1) // E5
    osc.frequency.setValueAtTime(783.99, time + 0.2) // G5
    osc.type = 'sine'

    filter.frequency.setValueAtTime(2000, time)
    filter.Q.setValueAtTime(1, time)

    gain.gain.setValueAtTime(0.3, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6)

    osc.stop(time + 0.6)
  }

  private playIncorrectSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Descending minor pattern
    osc.frequency.setValueAtTime(415.30, time) // G#4
    osc.frequency.setValueAtTime(369.99, time + 0.1) // F#4
    osc.frequency.setValueAtTime(311.13, time + 0.2) // E♭4
    osc.type = 'sawtooth'

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(800, time)
    filter.Q.setValueAtTime(5, time)

    gain.gain.setValueAtTime(0.4, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8)

    osc.stop(time + 0.8)
  }

  private playTickSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // Sharp, brief tick
    osc.frequency.setValueAtTime(800, time)
    osc.type = 'square'

    gain.gain.setValueAtTime(0.15, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)

    osc.stop(time + 0.1)
  }

  private playCelebrationSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Triumphant ascending melody
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.50] // C5, D5, E5, G5, A5, C6
    osc.type = 'sine'

    filter.frequency.setValueAtTime(3000, time)
    filter.Q.setValueAtTime(2, time)

    notes.forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq, time + (i * 0.15))
    })

    gain.gain.setValueAtTime(0.4, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2)

    osc.stop(time + 1.2)
  }

  private playTensionSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // Low, ominous pulse
    osc.frequency.setValueAtTime(55, time) // A1
    osc.type = 'triangle'

    gain.gain.setValueAtTime(0.0, time)
    gain.gain.linearRampToValueAtTime(0.3, time + 0.1)
    gain.gain.linearRampToValueAtTime(0.0, time + 0.5)
    gain.gain.linearRampToValueAtTime(0.3, time + 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.0)

    osc.stop(time + 1.0)
  }

  private playWhooshSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Sweeping transition sound
    osc.frequency.setValueAtTime(200, time)
    osc.frequency.exponentialRampToValueAtTime(2000, time + 0.3)
    osc.type = 'sawtooth'

    filter.type = 'highpass'
    filter.frequency.setValueAtTime(100, time)
    filter.frequency.exponentialRampToValueAtTime(1000, time + 0.3)

    gain.gain.setValueAtTime(0.2, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4)

    osc.stop(time + 0.4)
  }

  private playDingSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // Classic ding notification
    osc.frequency.setValueAtTime(1047, time) // C6
    osc.type = 'sine'

    gain.gain.setValueAtTime(0.3, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8)

    osc.stop(time + 0.8)
  }

  private playBuzzSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // Game show buzzer
    osc.frequency.setValueAtTime(150, time)
    osc.type = 'square'

    gain.gain.setValueAtTime(0.4, time)
    gain.gain.setValueAtTime(0.4, time + 0.5)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.0)

    osc.stop(time + 1.0)
  }

  private playFanfareSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // Victory fanfare
    const melody = [523.25, 523.25, 523.25, 659.25, 783.99] // C5, C5, C5, E5, G5
    osc.type = 'square'

    melody.forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq, time + (i * 0.2))
    })

    gain.gain.setValueAtTime(0.35, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2)

    osc.stop(time + 1.2)
  }

  private playHeartbeatSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // Tension heartbeat for final seconds
    osc.frequency.setValueAtTime(60, time)
    osc.type = 'sine'

    // Double beat pattern
    gain.gain.setValueAtTime(0.0, time)
    gain.gain.linearRampToValueAtTime(0.4, time + 0.05)
    gain.gain.linearRampToValueAtTime(0.0, time + 0.15)
    gain.gain.linearRampToValueAtTime(0.3, time + 0.25)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4)

    osc.stop(time + 0.4)
  }

  private playClickSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // UI click sound
    osc.frequency.setValueAtTime(1200, time)
    osc.type = 'square'

    gain.gain.setValueAtTime(0.1, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)

    osc.stop(time + 0.05)
  }

  private playStreakSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Rising streak bonus sound
    osc.frequency.setValueAtTime(440, time)
    osc.frequency.exponentialRampToValueAtTime(880, time + 0.3)
    osc.frequency.exponentialRampToValueAtTime(1760, time + 0.6)
    osc.type = 'sine'

    filter.frequency.setValueAtTime(2000, time)
    filter.Q.setValueAtTime(3, time)

    gain.gain.setValueAtTime(0.3, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8)

    osc.stop(time + 0.8)
  }

  private playAchievementSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Special achievement unlock sound
    const chord = [523.25, 659.25, 783.99, 1046.50] // C major chord
    osc.type = 'sine'

    filter.frequency.setValueAtTime(4000, time)
    filter.Q.setValueAtTime(1.5, time)

    chord.forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq, time + (i * 0.1))
    })

    gain.gain.setValueAtTime(0.4, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5)

    osc.stop(time + 1.5)
  }

  private playTimeWarningSound(osc: OscillatorNode, gain: GainNode, time: number) {
    // Urgent time warning beep
    osc.frequency.setValueAtTime(1000, time)
    osc.type = 'sine'

    gain.gain.setValueAtTime(0.0, time)
    gain.gain.linearRampToValueAtTime(0.5, time + 0.05)
    gain.gain.linearRampToValueAtTime(0.0, time + 0.15)

    osc.stop(time + 0.2)
  }

  private playGameStartSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Game show start sound
    osc.frequency.setValueAtTime(220, time)
    osc.frequency.exponentialRampToValueAtTime(880, time + 0.5)
    osc.type = 'sawtooth'

    filter.frequency.setValueAtTime(1000, time)
    filter.frequency.exponentialRampToValueAtTime(4000, time + 0.5)

    gain.gain.setValueAtTime(0.3, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.0)

    osc.stop(time + 1.0)
  }

  private playGameEndSound(osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode, time: number) {
    // Final resolution chord
    const finalChord = [261.63, 329.63, 392.00, 523.25] // C4, E4, G4, C5
    osc.type = 'sine'

    filter.frequency.setValueAtTime(3000, time)
    filter.Q.setValueAtTime(1, time)

    finalChord.forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq, time + (i * 0.15))
    })

    gain.gain.setValueAtTime(0.4, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 2.0)

    osc.stop(time + 2.0)
  }

  // Utility method for chained sound sequences
  async playSequence(sounds: { sound: SoundType; delay: number }[]) {
    for (const { sound, delay } of sounds) {
      setTimeout(() => this.play(sound), delay)
    }
  }

  // Play background ambience (for tension building)
  playAmbientTension(duration: number = 10000) {
    if (!this.isEnabled || !this.audioContext) return

    const interval = setInterval(() => {
      this.play('heartbeat')
    }, 1200) // Heartbeat every 1.2 seconds

    setTimeout(() => {
      clearInterval(interval)
    }, duration)

    return interval
  }
}

// Singleton instance
export const soundSystem = new GameSoundSystem()

// Hook for React components
export const useGameSounds = (enabled: boolean = true) => {
  soundSystem.setEnabled(enabled)

  return {
    playSound: soundSystem.play.bind(soundSystem),
    playSequence: soundSystem.playSequence.bind(soundSystem),
    playAmbientTension: soundSystem.playAmbientTension.bind(soundSystem),
    setVolume: soundSystem.setVolume.bind(soundSystem),
    setEnabled: soundSystem.setEnabled.bind(soundSystem)
  }
}
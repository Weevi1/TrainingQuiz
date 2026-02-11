// Sound system for training games
// Uses Web Audio API for dynamic sound generation
// Architecture based on proven v1 gameShowSounds.js pattern

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
  | 'participantJoin'

// Volume levels for consistent UX (from v1)
const vol = {
  feedback: 0.25,
  selection: 0.15,
  celebration: 0.3,
  timer: 0.2,
  fanfare: 0.35,
  notification: 0.3,
}

class GameSoundSystem {
  private audioContext: AudioContext | null = null
  private isEnabled = true
  private initialized = false

  constructor() {
    this.setupAutoInit()
  }

  private setupAutoInit() {
    const initOnInteraction = () => {
      this.init()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('click', initOnInteraction, { once: true })
      document.addEventListener('touchstart', initOnInteraction, { once: true })
      document.addEventListener('keydown', initOnInteraction, { once: true })
    }
  }

  init() {
    if (this.initialized) return
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.initialized = true
      console.log('🎵 Sound system initialized')
    } catch (error) {
      console.warn('Audio not supported:', error)
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }

  setVolume(_volume: number) {
    // Volume is controlled per-sound via the volume levels
  }

  // Core helper: creates an oscillator+gain pair connected to destination (v1 pattern)
  private createOsc(frequency: number, type: OscillatorType = 'sine', volume: number = 0.2, duration: number = 0.5) {
    if (!this.initialized || !this.audioContext) return null

    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    osc.connect(gain)
    gain.connect(this.audioContext.destination)

    osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
    osc.type = type

    // Envelope: 50ms attack from 0, then decay (prevents clicks, matches v1)
    gain.gain.setValueAtTime(0, this.audioContext.currentTime)
    gain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration)

    return { osc, gain }
  }

  async play(soundType: SoundType) {
    if (!this.isEnabled) return

    // Auto-init if needed
    if (!this.initialized) {
      this.init()
    }
    if (!this.audioContext) return

    // Resume if suspended
    if (this.audioContext.state === 'suspended') {
      try { await this.audioContext.resume() } catch { /* ignore */ }
    }

    try {
      switch (soundType) {
        case 'correct': this.playCorrect(); break
        case 'incorrect': this.playIncorrect(); break
        case 'tick': this.playTick(); break
        case 'celebration': this.playCelebration(); break
        case 'tension': this.playTension(); break
        case 'whoosh': this.playWhoosh(); break
        case 'ding': this.playDing(); break
        case 'buzz': this.playBuzz(); break
        case 'fanfare': this.playFanfare(); break
        case 'heartbeat': this.playHeartbeat(); break
        case 'click': this.playClick(); break
        case 'streak': this.playStreak(); break
        case 'achievement': this.playAchievement(); break
        case 'timeWarning': this.playTimeWarning(); break
        case 'gameStart': this.playGameStart(); break
        case 'gameEnd': this.playGameEnd(); break
        case 'participantJoin': this.playParticipantJoin(); break
        default: this.playClick()
      }
    } catch (error) {
      console.warn('Sound play error:', soundType, error)
    }
  }

  // === SOUND METHODS (each creates its own oscillators, v1 pattern) ===

  private playCorrect() {
    if (!this.audioContext) return
    const v = vol.feedback
    // Layered harmonics (from v1)
    const harmonics = [
      { freq: 800, type: 'sine' as OscillatorType, v: v * 1.0 },
      { freq: 1200, type: 'sine' as OscillatorType, v: v * 0.6 },
      { freq: 1600, type: 'triangle' as OscillatorType, v: v * 0.3 },
    ]
    harmonics.forEach(h => {
      const o = this.createOsc(h.freq, h.type, h.v, 0.6)
      if (!o) return
      // Ascending sweep
      o.osc.frequency.exponentialRampToValueAtTime(h.freq * 1.4, this.audioContext!.currentTime + 0.1)
      o.osc.frequency.exponentialRampToValueAtTime(h.freq * 1.1, this.audioContext!.currentTime + 0.4)
      o.osc.start()
      o.osc.stop(this.audioContext!.currentTime + 0.6)
    })
  }

  private playIncorrect() {
    if (!this.audioContext) return
    const v = vol.feedback
    // Layered buzzer (from v1)
    const layers = [
      { freq: 150, type: 'sawtooth' as OscillatorType, v: v * 0.8 },
      { freq: 100, type: 'square' as OscillatorType, v: v * 0.6 },
      { freq: 200, type: 'sawtooth' as OscillatorType, v: v * 0.4 },
    ]
    layers.forEach(l => {
      const o = this.createOsc(l.freq, l.type, l.v, 0.7)
      if (!o) return
      // Frequency drop
      o.osc.frequency.linearRampToValueAtTime(l.freq * 0.7, this.audioContext!.currentTime + 0.6)
      // LFO modulation for mechanical buzzer feel
      const lfo = this.audioContext!.createOscillator()
      const lfoGain = this.audioContext!.createGain()
      lfo.frequency.setValueAtTime(8, this.audioContext!.currentTime)
      lfoGain.gain.setValueAtTime(5, this.audioContext!.currentTime)
      lfo.connect(lfoGain)
      lfoGain.connect(o.osc.frequency)
      o.osc.start()
      lfo.start()
      o.osc.stop(this.audioContext!.currentTime + 0.7)
      lfo.stop(this.audioContext!.currentTime + 0.7)
    })
  }

  private playTick() {
    const o = this.createOsc(800, 'square', vol.timer, 0.15)
    if (!o) return
    o.osc.start()
    o.osc.stop(this.audioContext!.currentTime + 0.15)
  }

  private playCelebration() {
    if (!this.audioContext) return
    const notes = [440, 554, 659, 880]
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const o = this.createOsc(freq, 'triangle', vol.celebration, 0.4)
        if (!o) return
        o.osc.start()
        o.osc.stop(this.audioContext!.currentTime + 0.4)
      }, i * 100)
    })
  }

  private playTension() {
    // Low ominous pulse
    const o = this.createOsc(55, 'triangle', 0.3, 1.0)
    if (!o) return
    // Override envelope for pulse pattern
    o.gain.gain.cancelScheduledValues(this.audioContext!.currentTime)
    o.gain.gain.setValueAtTime(0, this.audioContext!.currentTime)
    o.gain.gain.linearRampToValueAtTime(0.3, this.audioContext!.currentTime + 0.1)
    o.gain.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + 0.5)
    o.gain.gain.linearRampToValueAtTime(0.3, this.audioContext!.currentTime + 0.6)
    o.gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 1.0)
    o.osc.start()
    o.osc.stop(this.audioContext!.currentTime + 1.0)
  }

  private playWhoosh() {
    if (!this.audioContext) return
    const o = this.createOsc(200, 'sawtooth', 0.2, 0.4)
    if (!o) return
    o.osc.frequency.exponentialRampToValueAtTime(2000, this.audioContext.currentTime + 0.3)
    o.osc.start()
    o.osc.stop(this.audioContext.currentTime + 0.4)
  }

  private playDing() {
    const o = this.createOsc(1047, 'sine', 0.3, 0.8)
    if (!o) return
    o.osc.start()
    o.osc.stop(this.audioContext!.currentTime + 0.8)
  }

  private playBuzz() {
    const o = this.createOsc(150, 'square', 0.4, 1.0)
    if (!o) return
    o.osc.start()
    o.osc.stop(this.audioContext!.currentTime + 1.0)
  }

  private playFanfare() {
    if (!this.audioContext) return
    const melody = [523, 523, 523, 659, 784]
    melody.forEach((freq, i) => {
      setTimeout(() => {
        const o = this.createOsc(freq, 'triangle', vol.fanfare, 0.5)
        if (!o) return
        o.osc.start()
        o.osc.stop(this.audioContext!.currentTime + 0.5)
      }, i * 150)
    })
  }

  private playHeartbeat() {
    if (!this.audioContext) return
    // Double beat pattern
    const o = this.createOsc(60, 'sine', 0.4, 0.4)
    if (!o) return
    o.gain.gain.cancelScheduledValues(this.audioContext.currentTime)
    o.gain.gain.setValueAtTime(0, this.audioContext.currentTime)
    o.gain.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + 0.05)
    o.gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.15)
    o.gain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.25)
    o.gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4)
    o.osc.start()
    o.osc.stop(this.audioContext.currentTime + 0.4)
  }

  private playClick() {
    const o = this.createOsc(600, 'sine', vol.selection, 0.12)
    if (!o) return
    o.osc.start()
    o.osc.stop(this.audioContext!.currentTime + 0.12)
  }

  private playStreak() {
    if (!this.audioContext) return
    // Rising notes
    const notes = [440, 660, 880]
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const o = this.createOsc(freq, 'sine', 0.25, 0.3)
        if (!o) return
        o.osc.start()
        o.osc.stop(this.audioContext!.currentTime + 0.3)
      }, i * 100)
    })
  }

  private playAchievement() {
    if (!this.audioContext) return
    // C major chord arpeggio
    const chord = [523, 659, 784, 1047]
    chord.forEach((freq, i) => {
      setTimeout(() => {
        const o = this.createOsc(freq, 'sine', 0.35, 0.6)
        if (!o) return
        o.osc.start()
        o.osc.stop(this.audioContext!.currentTime + 0.6)
      }, i * 100)
    })
  }

  private playTimeWarning() {
    if (!this.audioContext) return
    // Urgent beep with frequency wobble (from v1 playFinalCountdown)
    const o = this.createOsc(1000, 'sawtooth', vol.timer * 1.5, 0.2)
    if (!o) return
    o.osc.frequency.linearRampToValueAtTime(1200, this.audioContext.currentTime + 0.05)
    o.osc.frequency.linearRampToValueAtTime(1000, this.audioContext.currentTime + 0.15)
    o.osc.start()
    o.osc.stop(this.audioContext.currentTime + 0.2)
  }

  private playGameStart() {
    if (!this.audioContext) return
    // Grand opening chord (from v1 playShowStart)
    const chord = [262, 330, 392, 523]
    chord.forEach(freq => {
      const o = this.createOsc(freq, 'triangle', vol.fanfare, 1.8)
      if (!o) return
      o.osc.start()
      o.osc.stop(this.audioContext!.currentTime + 1.8)
    })
  }

  private playGameEnd() {
    if (!this.audioContext) return
    // Victory melody (from v1 playQuizComplete)
    const melody = [523, 659, 784, 880, 1047]
    melody.forEach((freq, i) => {
      setTimeout(() => {
        const o = this.createOsc(freq, 'triangle', vol.fanfare, 0.5)
        if (!o) return
        o.osc.start()
        o.osc.stop(this.audioContext!.currentTime + 0.5)
      }, i * 150)
    })
  }

  private playParticipantJoin() {
    if (!this.audioContext) return
    // Two-note ascending pop
    const o1 = this.createOsc(880, 'sine', vol.notification, 0.15)
    if (!o1) return
    o1.osc.start()
    o1.osc.stop(this.audioContext.currentTime + 0.15)

    setTimeout(() => {
      const o2 = this.createOsc(1109, 'sine', vol.notification, 0.15)
      if (!o2) return
      o2.osc.start()
      o2.osc.stop(this.audioContext!.currentTime + 0.15)
    }, 80)
  }

  // Utility: play a sequence of sounds with delays
  async playSequence(sounds: { sound: SoundType; delay: number }[]) {
    for (const { sound, delay } of sounds) {
      setTimeout(() => this.play(sound), delay)
    }
  }

  // Play ambient tension heartbeat
  playAmbientTension(duration: number = 10000) {
    if (!this.isEnabled || !this.audioContext) return
    const interval = setInterval(() => { this.play('heartbeat') }, 1200)
    setTimeout(() => clearInterval(interval), duration)
    return interval
  }
}

// Singleton
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

// 🎵 GAME SHOW SOUND EFFECTS! 🎪
// Web Audio API synthesized sounds for maximum game show excitement!

class GameShowSounds {
  constructor() {
    this.audioContext = null
    this.initialized = false

    // Normalized volume levels for consistent UX
    this.volumes = {
      feedback: 0.25,      // Correct/Wrong answers - moderate volume
      selection: 0.15,     // UI interactions - subtle
      celebration: 0.3,    // Victory/celebrations - slightly louder
      timer: 0.2,          // Clock ticking - background level
      fanfare: 0.35,       // Show start/complete - prominent but not overwhelming
    }
  }

  // Initialize audio context (must be called after user interaction)
  async init() {
    if (this.initialized) return
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.initialized = true
      console.log('🎵 Game Show Sounds initialized!')
    } catch (error) {
      console.log('Audio not supported:', error)
    }
  }

  // Helper method to create enhanced oscillators with proper envelopes
  createOscillator(frequency, type = 'sine', volume = 0.2, duration = 0.5) {
    if (!this.initialized) return null

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
    oscillator.type = type

    // Enhanced envelope: attack -> sustain -> release
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.05) // 50ms attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration)

    return { oscillator, gainNode }
  }

  // 🔊 CORRECT ANSWER - Enhanced Triumphant Sound!
  playCorrect() {
    if (!this.initialized) return

    const baseFreq = 800
    const volume = this.volumes.feedback

    // Create a rich, layered sound with multiple harmonics
    const harmonics = [
      { freq: baseFreq, type: 'sine', vol: volume * 1.0 },        // Fundamental
      { freq: baseFreq * 1.5, type: 'sine', vol: volume * 0.6 },  // Perfect fifth
      { freq: baseFreq * 2, type: 'triangle', vol: volume * 0.3 }, // Octave with triangle wave
    ]

    harmonics.forEach((harmonic, index) => {
      const osc = this.createOscillator(harmonic.freq, harmonic.type, harmonic.vol, 0.6)
      if (!osc) return

      // Ascending frequency sweep for that "ding" effect
      osc.oscillator.frequency.exponentialRampToValueAtTime(
        harmonic.freq * 1.4,
        this.audioContext.currentTime + 0.1
      )
      osc.oscillator.frequency.exponentialRampToValueAtTime(
        harmonic.freq * 1.1,
        this.audioContext.currentTime + 0.4
      )

      osc.oscillator.start()
      osc.oscillator.stop(this.audioContext.currentTime + 0.6)
    })
  }

  // ❌ WRONG ANSWER - Enhanced Game Show Buzzer!
  playBuzzer() {
    if (!this.initialized) return

    const volume = this.volumes.feedback

    // Create a more sophisticated "buzzer" with multiple layers
    const buzzerLayers = [
      { freq: 150, type: 'sawtooth', vol: volume * 0.8 },    // Main buzzer tone
      { freq: 100, type: 'square', vol: volume * 0.6 },      // Lower harsh tone
      { freq: 200, type: 'sawtooth', vol: volume * 0.4 },    // Higher edge
    ]

    buzzerLayers.forEach((layer, index) => {
      const osc = this.createOscillator(layer.freq, layer.type, layer.vol, 0.7)
      if (!osc) return

      // Characteristic buzzer frequency drop
      osc.oscillator.frequency.linearRampToValueAtTime(
        layer.freq * 0.7,
        this.audioContext.currentTime + 0.6
      )

      // Add some modulation for more "mechanical" buzzer feel
      const lfo = this.audioContext.createOscillator()
      const lfoGain = this.audioContext.createGain()

      lfo.frequency.setValueAtTime(8, this.audioContext.currentTime) // 8Hz modulation
      lfoGain.gain.setValueAtTime(5, this.audioContext.currentTime)  // Small pitch modulation

      lfo.connect(lfoGain)
      lfoGain.connect(osc.oscillator.frequency)

      osc.oscillator.start()
      lfo.start()

      osc.oscillator.stop(this.audioContext.currentTime + 0.7)
      lfo.stop(this.audioContext.currentTime + 0.7)
    })
  }

  // 🎉 CELEBRATION - Victory Fanfare!
  playCelebration() {
    if (!this.initialized) return

    const volume = this.volumes.celebration
    // Multi-note fanfare - A major chord arpeggio
    const notes = [440, 554, 659, 880] // A, C#, E, A octave

    notes.forEach((freq, index) => {
      setTimeout(() => {
        const osc = this.createOscillator(freq, 'triangle', volume, 0.4)
        if (!osc) return

        osc.oscillator.start()
        osc.oscillator.stop(this.audioContext.currentTime + 0.4)
      }, index * 100)
    })
  }

  // ⏰ DRAMATIC COUNTDOWN - Ticking with tension!
  playTick() {
    if (!this.initialized) return

    const osc = this.createOscillator(800, 'square', this.volumes.timer, 0.15)
    if (!osc) return

    osc.oscillator.start()
    osc.oscillator.stop(this.audioContext.currentTime + 0.15)
  }

  // 🚨 FINAL COUNTDOWN - Dramatic last seconds!
  playFinalCountdown() {
    if (!this.initialized) return

    const osc = this.createOscillator(1000, 'sawtooth', this.volumes.timer * 1.5, 0.2)
    if (!osc) return

    // Higher pitch, more urgent with frequency wobble
    osc.oscillator.frequency.linearRampToValueAtTime(1200, this.audioContext.currentTime + 0.05)
    osc.oscillator.frequency.linearRampToValueAtTime(1000, this.audioContext.currentTime + 0.15)

    osc.oscillator.start()
    osc.oscillator.stop(this.audioContext.currentTime + 0.2)
  }

  // 🎪 SHOW START - Opening fanfare!
  playShowStart() {
    if (!this.initialized) return

    const volume = this.volumes.fanfare
    // Grand opening chord progression - C Major chord
    const chord = [262, 330, 392, 523] // C, E, G, C

    chord.forEach((freq, index) => {
      const osc = this.createOscillator(freq, 'triangle', volume, 1.8)
      if (!osc) return

      osc.oscillator.start()
      osc.oscillator.stop(this.audioContext.currentTime + 1.8)
    })
  }

  // 🎯 ANSWER SELECTION - Quick feedback beep
  playSelect() {
    if (!this.initialized) return

    const osc = this.createOscillator(600, 'sine', this.volumes.selection, 0.12)
    if (!osc) return

    osc.oscillator.start()
    osc.oscillator.stop(this.audioContext.currentTime + 0.12)
  }

  // 🏆 QUIZ COMPLETE - Victory theme!
  playQuizComplete() {
    if (!this.initialized) return

    const volume = this.volumes.fanfare
    // Victory melody - ascending scale
    const melody = [523, 659, 784, 880, 1047] // C, E, G, A, C

    melody.forEach((freq, index) => {
      setTimeout(() => {
        const osc = this.createOscillator(freq, 'triangle', volume, 0.5)
        if (!osc) return

        osc.oscillator.start()
        osc.oscillator.stop(this.audioContext.currentTime + 0.5)
      }, index * 150)
    })
  }
}

// Create singleton instance
export const gameShowSounds = new GameShowSounds()

// Auto-initialize on first user interaction
document.addEventListener('click', () => {
  gameShowSounds.init()
}, { once: true })

document.addEventListener('touch', () => {
  gameShowSounds.init()
}, { once: true })

export default gameShowSounds
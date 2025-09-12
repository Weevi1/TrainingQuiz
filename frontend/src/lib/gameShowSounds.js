// 🎵 GAME SHOW SOUND EFFECTS! 🎪
// Web Audio API synthesized sounds for maximum game show excitement!

class GameShowSounds {
  constructor() {
    this.audioContext = null
    this.initialized = false
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

  // 🔊 CORRECT ANSWER - Triumphant Ding!
  playCorrect() {
    if (!this.initialized) return
    
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    // Beautiful ascending ding sound
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1)
    oscillator.frequency.exponentialRampToValueAtTime(1000, this.audioContext.currentTime + 0.3)
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5)
    
    oscillator.type = 'sine'
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 0.5)
  }

  // ❌ WRONG ANSWER - Classic Game Show Buzzer!
  playBuzzer() {
    if (!this.initialized) return
    
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    // Harsh buzzer sound
    oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime)
    oscillator.frequency.linearRampToValueAtTime(100, this.audioContext.currentTime + 0.5)
    
    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5)
    
    oscillator.type = 'sawtooth'
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 0.5)
  }

  // 🎉 CELEBRATION - Victory Fanfare!
  playCelebration() {
    if (!this.initialized) return
    
    // Multi-note fanfare
    const notes = [440, 554, 659, 880] // A, C#, E, A octave
    
    notes.forEach((freq, index) => {
      setTimeout(() => {
        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()
        
        osc.connect(gain)
        gain.connect(this.audioContext.destination)
        
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime)
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3)
        
        osc.type = 'triangle'
        osc.start()
        osc.stop(this.audioContext.currentTime + 0.3)
      }, index * 100)
    })
  }

  // ⏰ DRAMATIC COUNTDOWN - Ticking with tension!
  playTick() {
    if (!this.initialized) return
    
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)
    
    oscillator.type = 'square'
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 0.1)
  }

  // 🚨 FINAL COUNTDOWN - Dramatic last seconds!
  playFinalCountdown() {
    if (!this.initialized) return
    
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    // Higher pitch, more urgent
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime)
    oscillator.frequency.linearRampToValueAtTime(1200, this.audioContext.currentTime + 0.05)
    oscillator.frequency.linearRampToValueAtTime(1000, this.audioContext.currentTime + 0.1)
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15)
    
    oscillator.type = 'sawtooth'
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 0.15)
  }

  // 🎪 SHOW START - Opening fanfare!
  playShowStart() {
    if (!this.initialized) return
    
    // Grand opening chord progression
    const chord = [262, 330, 392, 523] // C Major chord
    
    chord.forEach((freq, index) => {
      const osc = this.audioContext.createOscillator()
      const gain = this.audioContext.createGain()
      
      osc.connect(gain)
      gain.connect(this.audioContext.destination)
      
      osc.frequency.setValueAtTime(freq, this.audioContext.currentTime)
      gain.gain.setValueAtTime(0.15, this.audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.5)
      
      osc.type = 'triangle'
      osc.start()
      osc.stop(this.audioContext.currentTime + 1.5)
    })
  }

  // 🎯 ANSWER SELECTION - Quick feedback beep
  playSelect() {
    if (!this.initialized) return
    
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)
    
    oscillator.type = 'sine'
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 0.1)
  }

  // 🏆 QUIZ COMPLETE - Victory theme!
  playQuizComplete() {
    if (!this.initialized) return
    
    // Victory melody
    const melody = [523, 659, 784, 880, 1047] // C, E, G, A, C
    
    melody.forEach((freq, index) => {
      setTimeout(() => {
        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()
        
        osc.connect(gain)
        gain.connect(this.audioContext.destination)
        
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime)
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4)
        
        osc.type = 'triangle'
        osc.start()
        osc.stop(this.audioContext.currentTime + 0.4)
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
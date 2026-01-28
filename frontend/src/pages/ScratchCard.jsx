import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Gift, AlertCircle, Trophy, Sparkles } from 'lucide-react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc, Timestamp, onSnapshot } from 'firebase/firestore'
import { gameShowSounds } from '../lib/gameShowSounds'

function ScratchCard() {
  const { sessionCode } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [session, setSession] = useState(null)
  const [participant, setParticipant] = useState({ name: '' })
  const [participantId, setParticipantId] = useState(null)
  const [scratchCard, setScratchCard] = useState(null)
  const [hasJoined, setHasJoined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isScratching, setIsScratching] = useState(false)
  const [scratchProgress, setScratchProgress] = useState(0)
  const [cardRevealed, setCardRevealed] = useState(false)
  const [canvasInitialized, setCanvasInitialized] = useState(false)
  const [touchIntensity, setTouchIntensity] = useState(1)
  const [lastScratchTime, setLastScratchTime] = useState(0)
  const [scratchParticles, setScratchParticles] = useState([])
  const [devicePixelRatio] = useState(window.devicePixelRatio || 1)

  useEffect(() => {
    loadSessionData()
  }, [sessionCode])

  useEffect(() => {
    if (scratchCard && !cardRevealed && !canvasInitialized) {
      initializeCanvas()
      setCanvasInitialized(true)
    }
  }, [scratchCard, cardRevealed, canvasInitialized])

  // Set up real-time listener for scratch cards when participant has joined
  useEffect(() => {
    if (!hasJoined || !participantId || !session?.id) return

    console.log('🔥 Setting up real-time scratch card listener for participant:', participantId)

    // Real-time listener for scratch cards
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'scratch_sessions', session.id, 'cards'),
        where('participantId', '==', participantId)
      ),
      async (snapshot) => {
        console.log('🔥 REAL-TIME: Scratch card change detected!')

        if (snapshot.empty) {
          setScratchCard(null)
          return
        }

        const cardDoc = snapshot.docs[0]
        const cardData = { id: cardDoc.id, ...cardDoc.data() }

        // If there's a prize, load prize details
        if (cardData.prizeId) {
          const prizeDoc = await getDoc(doc(db, 'scratch_sessions', session.id, 'prizes', cardData.prizeId))
          if (prizeDoc.exists()) {
            cardData.prize = prizeDoc.data()
          }
        }

        // Play exciting sound when card first appears!
        if (!scratchCard && cardData) {
          console.log('🎵 New scratch card appeared! Playing celebration sound!')
          gameShowSounds.playCelebration()
        }

        // Only update if it's a new card or significant change
        const isNewCard = !scratchCard || scratchCard.id !== cardData.id
        if (isNewCard) {
          setScratchCard(cardData)
          setCanvasInitialized(false) // Reset canvas for new card
        }

        if (cardData?.scratched && !cardRevealed) {
          setCardRevealed(true)
          setScratchProgress(100)
        }
      },
      (error) => {
        console.error('Error listening to scratch cards:', error)
      }
    )

    return () => {
      console.log('🧹 Cleaning up scratch card listener')
      unsubscribe()
    }
  }, [hasJoined, participantId, session?.id, scratchCard])

  const loadSessionData = async () => {
    try {
      // Load session by session code from Firebase
      const sessionsQuery = query(
        collection(db, 'scratch_sessions'),
        where('sessionCode', '==', sessionCode)
      )
      const sessionsSnapshot = await getDocs(sessionsQuery)

      if (sessionsSnapshot.empty) {
        setError('Scratch card session not found. Please check the session code.')
        return
      }

      const sessionDoc = sessionsSnapshot.docs[0]
      const sessionData = { id: sessionDoc.id, ...sessionDoc.data() }

      if (sessionData.status === 'completed') {
        setError('This scratch card giveaway has already ended.')
        return
      }

      // Allow joining during setup phase, but participants will wait for activation
      setSession(sessionData)
    } catch (error) {
      console.error('Error loading session data:', error)
      setError('Failed to load scratch card session.')
    } finally {
      setLoading(false)
    }
  }

  const joinGiveaway = async () => {
    if (!participant.name.trim()) return

    try {
      // Check if already joined
      const participantsQuery = query(
        collection(db, 'scratch_sessions', session.id, 'participants'),
        where('name', '==', participant.name.trim())
      )
      const participantsSnapshot = await getDocs(participantsQuery)

      if (!participantsSnapshot.empty) {
        const existingParticipant = participantsSnapshot.docs[0]
        setParticipantId(existingParticipant.id)
        setHasJoined(true)
        await loadScratchCard(existingParticipant.id)
        return
      }

      // Add new participant
      const participantRef = await addDoc(collection(db, 'scratch_sessions', session.id, 'participants'), {
        name: participant.name.trim(),
        joinedAt: Timestamp.now()
      })

      setParticipantId(participantRef.id)
      setHasJoined(true)

      // Try to load scratch card (might not exist yet if session not activated)
      await loadScratchCard(participantRef.id)
    } catch (error) {
      console.error('Error joining giveaway:', error)
      alert('Failed to join giveaway. Please try again.')
    }
  }

  const loadScratchCard = async (pId = participantId) => {
    try {
      // Load scratch card for this participant
      const cardsQuery = query(
        collection(db, 'scratch_sessions', session.id, 'cards'),
        where('participantId', '==', pId)
      )
      const cardsSnapshot = await getDocs(cardsQuery)

      if (cardsSnapshot.empty) {
        setScratchCard(null)
        return
      }

      const cardDoc = cardsSnapshot.docs[0]
      const cardData = { id: cardDoc.id, ...cardDoc.data() }

      // If there's a prize, load prize details
      if (cardData.prizeId) {
        const prizeDoc = await getDoc(doc(db, 'scratch_sessions', session.id, 'prizes', cardData.prizeId))
        if (prizeDoc.exists()) {
          cardData.prize = prizeDoc.data()
        }
      }

      setScratchCard(cardData)
      if (cardData?.scratched) {
        setCardRevealed(true)
        setScratchProgress(100)
      }
    } catch (error) {
      console.error('Error loading scratch card:', error)
    }
  }

  const initializeCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()

    // Set high-DPI canvas size for crisp rendering
    canvas.width = rect.width * devicePixelRatio
    canvas.height = rect.height * devicePixelRatio
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    ctx.scale(devicePixelRatio, devicePixelRatio)

    // Enhanced metallic gradient with more realistic look
    const gradient = ctx.createRadialGradient(
      rect.width / 2, rect.height / 2, 0,
      rect.width / 2, rect.height / 2, Math.max(rect.width, rect.height) / 2
    )
    gradient.addColorStop(0, '#FFD700')   // Bright gold center
    gradient.addColorStop(0.3, '#DAA520') // Gold
    gradient.addColorStop(0.7, '#B8860B') // Dark gold
    gradient.addColorStop(1, '#8B7355')   // Bronze edge

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Enhanced texture with multiple layers
    ctx.globalCompositeOperation = 'overlay'

    // Fine texture dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    for (let i = 0; i < 50; i++) {
      ctx.beginPath()
      ctx.arc(
        Math.random() * rect.width,
        Math.random() * rect.height,
        Math.random() * 2 + 0.5,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }

    // Scratched texture pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i < 20; i++) {
      ctx.beginPath()
      ctx.moveTo(Math.random() * rect.width, Math.random() * rect.height)
      ctx.lineTo(Math.random() * rect.width, Math.random() * rect.height)
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'source-over'

    // Modern text with shadow and glow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    ctx.fillStyle = 'rgba(139, 115, 85, 0.9)' // Dark bronze
    ctx.font = `bold ${Math.max(16, rect.width / 20)}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText('SCRATCH TO REVEAL', rect.width / 2, rect.height / 2 - 10)

    ctx.font = `bold ${Math.max(14, rect.width / 25)}px Arial`
    ctx.fillText('YOUR PRIZE', rect.width / 2, rect.height / 2 + 15)

    // Add a subtle border
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, rect.width - 2, rect.height - 2)
  }

  const handleScratch = (e) => {
    const canvas = canvasRef.current
    if (!canvas || cardRevealed || !canvasInitialized) return

    // Prevent default touch behavior to avoid scrolling
    e.preventDefault()

    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const now = Date.now()

    let clientX, clientY, pressure = 1
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
      // Simulate pressure based on touch size if available
      pressure = e.touches[0].force || (e.touches[0].radiusX ? Math.min(e.touches[0].radiusX / 20, 2) : 1)
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    // Enhanced coordinate calculation with DPI scaling
    const x = (clientX - rect.left) * devicePixelRatio
    const y = (clientY - rect.top) * devicePixelRatio

    // Optimized scratch radius - bigger for better feel but still deliberate
    const baseRadius = Math.min(canvas.width, canvas.height) * 0.06 // Increased from 4% to 6%
    const scratchRadius = baseRadius * pressure * touchIntensity

    // Enhanced scratching with better composite operation
    ctx.globalCompositeOperation = 'destination-out'

    // Create a more subtle scratch pattern with reduced strength
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, scratchRadius)
    gradient.addColorStop(0, 'rgba(0,0,0,0.8)')    // Reduced from full removal
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.5)')  // More gradual removal
    gradient.addColorStop(0.8, 'rgba(0,0,0,0.2)')  // Subtle fade
    gradient.addColorStop(1, 'rgba(0,0,0,0.1)')    // Very light fade at edges

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x / devicePixelRatio, y / devicePixelRatio, scratchRadius / devicePixelRatio, 0, Math.PI * 2)
    ctx.fill()

    // Add more subtle scratch marks for realistic effect
    if (isScratching && now - lastScratchTime < 50) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)' // Reduced opacity from 0.5 to 0.2
      for (let i = 0; i < 2; i++) { // Reduced from 3 to 2 marks
        const offsetX = (Math.random() - 0.5) * scratchRadius * 0.3 // Reduced spread
        const offsetY = (Math.random() - 0.5) * scratchRadius * 0.3
        ctx.beginPath()
        ctx.arc(
          (x + offsetX) / devicePixelRatio,
          (y + offsetY) / devicePixelRatio,
          (scratchRadius * 0.2) / devicePixelRatio, // Reduced size from 0.3 to 0.2
          0, Math.PI * 2
        )
        ctx.fill()
      }
    }

    setLastScratchTime(now)

    // Optimized progress calculation - sample every 4th pixel for performance
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    let scratched = 0
    let total = 0

    // Sample every 16th pixel for better performance on mobile
    for (let i = 3; i < pixels.length; i += 16) {
      total++
      if (pixels[i] < 128) {  // Alpha < 128 = scratched/transparent
        scratched++
      }
    }

    const progress = total > 0 ? (scratched / total) * 100 : 0
    setScratchProgress(progress)

    // Adjust touch intensity based on scratching speed for haptic-like feedback
    const scratchSpeed = now - lastScratchTime
    setTouchIntensity(Math.max(0.8, Math.min(1.5, 100 / Math.max(scratchSpeed, 1))))

    // Increased reveal threshold - require much more scratching for satisfaction
    if (progress > 60 && !cardRevealed) {
      console.log('🎯 Auto-revealing card at', Math.round(progress), '%')
      revealCard()
    }
  }

  const revealCard = async () => {
    console.log('🎯 Revealing card! Progress was:', Math.round(scratchProgress), '%')

    setCardRevealed(true)
    setScratchProgress(100)
    setCanvasInitialized(false) // Reset for next card

    // Play exciting reveal sound!
    const hasPrize = scratchCard.prize
    if (hasPrize) {
      console.log('🎵 Winner! Playing celebration sound!')
      gameShowSounds.playCelebration()
    } else {
      console.log('🎵 No prize, playing selection sound')
      gameShowSounds.playSelect()
    }

    // Mark card as scratched in Firebase
    try {
      await updateDoc(doc(db, 'scratch_sessions', session.id, 'cards', scratchCard.id), {
        scratched: true,
        scratchedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error updating scratch card:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--gradient-start), var(--gradient-middle), var(--gradient-end))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
          <p className="mt-4" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Loading giveaway...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--gradient-start), var(--gradient-middle), var(--gradient-end))' }}>
        <div className="p-8 rounded-lg shadow-lg max-w-md w-full mx-4 text-center" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
          <AlertCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--error-color)' }} />
          <h1 className="text-2xl font-bold mb-4">Oops!</h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary-color)' }}>{error}</p>
          <button
            onClick={() => window.location.href = 'https://gblaw.capetown/'}
            className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg hover:bg-gb-gold-light font-bold"
          >
            Visit Gustav Barkhuysen
          </button>
        </div>
      </div>
    )
  }

  if (!hasJoined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden" style={{ background: 'linear-gradient(to bottom right, var(--gradient-start), var(--gradient-middle), var(--gradient-end))' }}>
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gb-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}></div>
        </div>

        <div className="bg-gb-navy p-8 rounded-3xl shadow-2xl max-w-md w-full text-center relative border-2 border-gb-gold z-10">
          <div className="mb-6">
            <img
              src="/gblogo.png"
              alt="Gustav Barkhuysen Attorneys"
              className="h-16 mx-auto mb-4"
            />
            <div className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg">
              <h1 className="text-xl font-bold">Scratch Card Giveaway</h1>
            </div>
          </div>

          <div className="p-4 rounded-xl mb-6 border border-gb-gold/20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <h2 className="text-xl font-bold text-gb-gold mb-2">{session.title}</h2>
            <p className="text-gb-gold text-sm">
              Session: <span className="font-mono px-2 py-1 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>{sessionCode}</span>
            </p>
            {session.description && (
              <p className="text-sm mt-2" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{session.description}</p>
            )}
          </div>

          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-gb-gold/20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <label className="block text-lg font-bold text-gb-gold mb-3">Enter Your Name</label>
              <input
                type="text"
                value={participant.name}
                onChange={(e) => setParticipant({ name: e.target.value })}
                className="w-full px-4 py-3 text-lg font-medium text-center border-2 border-gb-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-gb-gold focus:border-gb-gold text-gb-navy"
                style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}
                placeholder="Your name..."
                onKeyPress={(e) => e.key === 'Enter' && joinGiveaway()}
              />
              <button
                onClick={joinGiveaway}
                className={`w-full mt-3 py-3 text-lg font-bold rounded-lg transition-all ${
                  participant.name.trim()
                    ? 'bg-gb-gold text-gb-navy hover:bg-gb-gold-light'
                    : 'cursor-not-allowed'
                }`}
                style={!participant.name.trim() ? { backgroundColor: 'var(--disabled-bg-color)', color: 'var(--text-secondary-color)' } : {}}
                disabled={!participant.name.trim()}
              >
                {participant.name.trim() ? 'Join Giveaway' : 'Enter Name First'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!scratchCard) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--gradient-start), var(--gradient-middle), var(--gradient-end))' }}>
        <div className="bg-gb-navy p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center border-2 border-gb-gold">
          <div className="mb-6">
            <div className="bg-gb-gold p-3 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Gift className="w-8 h-8 text-gb-navy" />
            </div>
            <h1 className="text-xl font-bold text-gb-gold mb-2">Welcome {participant.name}!</h1>
            <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>You're registered for the giveaway</p>
          </div>

          <div className="bg-gb-gold/10 p-4 rounded-xl border border-gb-gold/30">
            {session?.status === 'setup' ? (
              <>
                <p className="text-gb-gold text-sm font-medium mb-2">Waiting for trainer to generate cards</p>
                <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Your scratch card will appear here once the trainer starts the giveaway</p>
              </>
            ) : (
              <>
                <p className="text-gb-gold text-sm font-medium mb-2">Scratch cards generated!</p>
                <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Loading your scratch card...</p>
              </>
            )}
            <div className="w-2 h-2 bg-gb-gold rounded-full animate-pulse mx-auto mt-3"></div>
          </div>
        </div>
      </div>
    )
  }

  const hasPrize = scratchCard.prize

  // Debug logging (comment out for production)
  // console.log('RENDER STATE:', { cardRevealed, hasPrize: !!hasPrize, scratchProgress })

  return (
    <div className="w-screen h-screen relative overflow-hidden flex flex-col" style={{ background: 'linear-gradient(to bottom right, var(--gradient-bg-start), var(--gradient-bg-middle), var(--gradient-bg-end))' }}>
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes scratchPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .scratch-container {
          animation: scratchPulse 2s ease-in-out infinite;
        }
        .scratch-container:active {
          animation: none;
          transform: scale(0.98);
        }
        /* Enhanced touch responsiveness */
        .scratch-canvas {
          touch-action: none;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      `}</style>
      {/* Animated background elements */}
      <div className="absolute inset-0 animate-pulse" style={{ background: 'linear-gradient(to right, rgba(250,204,21,0.1), rgba(248,113,113,0.1), rgba(244,114,182,0.1))' }}></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-bounce" style={{ backgroundColor: 'rgba(250,204,21,0.2)' }}></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-bounce delay-1000" style={{ backgroundColor: 'rgba(168,85,247,0.2)' }}></div>

      <header className="relative z-10 bg-gb-navy shadow-2xl border-b-4 border-gb-gold flex-shrink-0 h-16">
        <div className="w-full px-4 py-2 h-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex items-center gap-4">
              <img src="/gbname.png" alt="GB Logo" className="h-10" />
              <div>
                <h1 className="text-base font-bold text-gb-gold drop-shadow-lg font-serif">
                  Scratch Card Giveaway
                </h1>
                <p className="text-gb-gold/80 text-xs font-medium">#{scratchCard.cardNumber} - {participant.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 rounded-lg text-sm font-semibold tracking-wide shadow-lg bg-gb-gold text-gb-navy">
                Card #{scratchCard.cardNumber}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 p-4 flex items-center justify-center overflow-y-auto">
        <div className="max-w-2xl w-full max-h-full flex flex-col justify-center">

        {/* Scratch Card */}
        <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 md:p-6 border-2 border-gb-gold flex-shrink-0">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="bg-gb-gold p-2 rounded-lg">
                <Gift className="w-5 h-5 text-gb-navy" />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Gustav Barkhuysen Attorneys</h2>
                <p className="text-gb-gold text-sm font-medium">Training Giveaway</p>
              </div>
            </div>
          </div>

          <div className={`relative ${!cardRevealed ? 'scratch-container' : ''}`}>
            {/* Prize/No Prize Display */}
            <div
              className={`p-6 md:p-8 rounded-xl text-center transition-all duration-500 border-2 ${cardRevealed ? 'border-gb-gold/50' : 'border-white/20'}`}
              style={{
                background: hasPrize
                  ? 'linear-gradient(to bottom right, var(--card-winner-start), var(--card-winner-middle), var(--card-winner-end))'
                  : 'linear-gradient(to bottom right, var(--card-loser-start), var(--card-loser-middle), var(--card-loser-end))',
                color: hasPrize ? '#713f12' : '#374151'
              }}
            >
              {cardRevealed ? (
                hasPrize ? (
                  <div className="animate-bounce">
                    <div className="relative">
                      <Trophy className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 animate-spin" style={{ color: '#a16207' }}
                             style={{ animationDuration: '3s', animationIterationCount: '1' }} />
                      {/* Celebration particles */}
                      <div className="absolute -top-2 -left-2 w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: 'var(--celebration-gold)' }}></div>
                      <div className="absolute -top-1 -right-1 w-1 h-1 rounded-full animate-ping delay-75" style={{ backgroundColor: 'var(--celebration-yellow)' }}></div>
                      <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 rounded-full animate-ping delay-150" style={{ backgroundColor: '#eab308' }}></div>
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold mb-2 animate-pulse">🎉 WINNER! 🎉</h3>
                    <div className="rounded-lg p-3 mb-2 shadow-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderColor: 'rgba(250,204,21,0.3)', borderWidth: '1px', borderStyle: 'solid' }}>
                      <p className="text-lg md:text-xl font-bold">{hasPrize.prizeName}</p>
                      <p className="text-base md:text-lg font-semibold" style={{ color: '#854d0e' }}>{hasPrize.prizeValue}</p>
                    </div>
                    <p className="text-xs md:text-sm opacity-80">{hasPrize.prizeDescription}</p>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    <Sparkles className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 animate-pulse" style={{ color: '#4b5563' }} />
                    <h3 className="text-lg md:text-xl font-bold mb-2">Thank You! 🤝</h3>
                    <p className="text-base md:text-lg">Better luck next time!</p>
                    <p className="text-xs md:text-sm opacity-80 mt-2">Thanks for participating in our training session</p>
                    <div className="mt-3 text-xs" style={{ color: '#6b7280' }}>
                      ✨ Every participation counts!
                    </div>
                  </div>
                )
              ) : (
                <div style={{ color: '#4b5563' }}>
                  <Gift className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3" />
                  <p className="text-base md:text-lg font-medium">Scratch to reveal your prize!</p>
                </div>
              )}
            </div>

            {/* Enhanced Scratch Canvas */}
            {!cardRevealed && (
              <canvas
                ref={canvasRef}
                className="scratch-canvas absolute inset-0 w-full h-full cursor-pointer rounded-xl"
                onMouseDown={(e) => {
                  setIsScratching(true)
                  handleScratch(e)
                }}
                onMouseUp={() => setIsScratching(false)}
                onMouseLeave={() => setIsScratching(false)}
                onMouseMove={(e) => isScratching && handleScratch(e)}
                onTouchStart={(e) => {
                  e.preventDefault()
                  setIsScratching(true)
                  handleScratch(e)
                  // Add haptic feedback if available
                  if (navigator.vibrate) {
                    navigator.vibrate(10)
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  setIsScratching(false)
                }}
                onTouchMove={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleScratch(e)
                  // Subtle haptic feedback during scratching
                  if (navigator.vibrate && Math.random() < 0.1) {
                    navigator.vibrate(5)
                  }
                }}
                onTouchCancel={(e) => {
                  e.preventDefault()
                  setIsScratching(false)
                }}
                style={{
                  borderRadius: '12px',
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              />
            )}
          </div>

          {/* Enhanced Progress Bar with Animation */}
          {!cardRevealed && (
            <div className="mt-4">
              <div className="relative rounded-full h-3 overflow-hidden shadow-inner" style={{ backgroundColor: 'var(--border-color)' }}>
                <div
                  className="h-full transition-all duration-300 ease-out rounded-full relative"
                  style={{
                    background: 'linear-gradient(to right, var(--accent-color, #d4af37), var(--warning-color, #facc15), var(--accent-color, #d4af37))',
                    width: `${scratchProgress}%`
                  }}
                >
                  {/* Animated shine effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
                    style={{
                      transform: 'translateX(-100%)',
                      animation: scratchProgress > 10 ? 'shine 2s infinite' : 'none'
                    }}
                  />
                </div>
                {/* Progress notches */}
                <div className="absolute inset-0 flex items-center justify-between px-1">
                  {[25, 50, 75].map(mark => (
                    <div
                      key={mark}
                      className="w-0.5 h-full"
                      style={{ backgroundColor: scratchProgress >= mark ? 'rgba(255, 255, 255, 0.5)' : 'var(--disabled-bg-color-50)' }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs font-medium" style={{ color: '#4b5563' }}>
                  {scratchProgress < 25 ? '🪙 Keep scratching...' :
                   scratchProgress < 45 ? '⚡ Getting there!' :
                   scratchProgress < 60 ? '✨ Almost there!' :
                   '🎯 Ready to reveal!'}
                </p>
                <span className="text-xs font-bold text-gb-gold bg-gb-gold/10 px-2 py-1 rounded">
                  {Math.round(scratchProgress)}%
                </span>
              </div>
            </div>
          )}

          {/* Enhanced Reveal Button */}
          {!cardRevealed && (
            <button
              onClick={revealCard}
              disabled={scratchProgress < 35}
              className={`w-full mt-4 py-3 rounded-xl font-bold text-lg transition-all duration-300 transform ${
                scratchProgress >= 60
                  ? 'shadow-lg hover:shadow-xl hover:scale-105 animate-pulse'
                  : scratchProgress >= 35
                  ? 'bg-gb-gold text-gb-navy hover:bg-gb-gold-light shadow-md hover:shadow-lg hover:scale-102'
                  : 'cursor-not-allowed opacity-50'
              }`}
              style={
                scratchProgress >= 60
                  ? { background: 'linear-gradient(to right, var(--success-color), var(--success-hover))', color: 'var(--text-on-primary-color, #ffffff)' }
                  : scratchProgress < 35
                  ? { backgroundColor: '#9ca3af', color: '#4b5563' }
                  : {}
              }
            >
              {scratchProgress >= 60 ? '🎉 Reveal Prize Now!' :
               scratchProgress >= 35 ? `🎯 Reveal Prize (${Math.round(scratchProgress)}%)` :
               `Keep Scratching (${Math.round(scratchProgress)}%)`}
            </button>
          )}
        </div>

        {/* Action Buttons */}
        {cardRevealed && (
          <div className="text-center mt-4">
            <div className="bg-gb-navy/50 backdrop-blur-sm rounded-lg p-3 border border-gb-gold/30">
              <p className="text-gb-gold text-sm font-medium mb-2">
                {hasPrize ? 'Congratulations! Contact your trainer to claim your prize.' : 'Thank you for participating in our training session!'}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                © Gustav Barkhuysen Attorneys
              </p>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}

export default ScratchCard
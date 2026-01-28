import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Gift, Target, Play, QrCode } from 'lucide-react'
import QRCode from 'react-qr-code'
import { db } from '../lib/firebase'
import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, deleteDoc, addDoc, Timestamp, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'

function ScratchCardSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [prizes, setPrizes] = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrSize, setQrSize] = useState(220)

  const sessionUrl = `${window.location.origin}/scratch/${session?.sessionCode}`

  // Update QR code size based on window width
  useEffect(() => {
    const updateQrSize = () => {
      const width = window.innerWidth
      if (width < 640) {
        setQrSize(200)
      } else if (width < 1024) {
        setQrSize(250)
      } else if (width < 1280) {
        setQrSize(300)
      } else {
        setQrSize(350)
      }
    }

    updateQrSize()
    window.addEventListener('resize', updateQrSize)
    return () => window.removeEventListener('resize', updateQrSize)
  }, [])

  useEffect(() => {
    if (!sessionId) return

    loadSessionData()

    // Set up real-time Firebase listener for participants
    const unsubscribe = onSnapshot(
      query(collection(db, 'scratch_sessions', sessionId, 'participants'), orderBy('joinedAt')),
      (snapshot) => {
        console.log('🔥 REAL-TIME: Scratch participant change received!')
        const participantData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setParticipants(participantData)
      },
      (error) => {
        console.error('Error listening to participants:', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [sessionId])

  const loadSessionData = async () => {
    try {
      // Load session details
      const sessionDoc = await getDoc(doc(db, 'scratch_sessions', sessionId))
      if (!sessionDoc.exists()) {
        throw new Error('Session not found')
      }

      const sessionData = { id: sessionDoc.id, ...sessionDoc.data() }
      setSession(sessionData)

      // Load prizes
      const prizesQuery = query(
        collection(db, 'scratch_sessions', sessionId, 'prizes'),
        orderBy('createdAt')
      )
      const prizesSnapshot = await getDocs(prizesQuery)
      const prizesData = prizesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPrizes(prizesData)

    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadParticipants = async () => {
    try {
      const participantsQuery = query(
        collection(db, 'scratch_sessions', sessionId, 'participants'),
        orderBy('joinedAt')
      )
      const participantsSnapshot = await getDocs(participantsQuery)
      const participantsData = participantsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setParticipants(participantsData)
    } catch (error) {
      console.error('Error loading participants:', error)
    }
  }

  const generateScratchCards = async () => {
    if (participants.length === 0) {
      alert('No participants have joined yet!')
      return
    }

    try {
      // Calculate total prize cards
      const totalPrizeCards = prizes.reduce((sum, prize) => sum + prize.quantity, 0)
      const totalParticipants = participants.length

      // Create array of prize assignments
      const prizeAssignments = []

      // Add prize cards
      prizes.forEach(prize => {
        for (let i = 0; i < prize.quantity; i++) {
          prizeAssignments.push(prize.id)
        }
      })

      // Add "no prize" cards for remaining participants
      const noPrizeCount = totalParticipants - totalPrizeCards
      for (let i = 0; i < noPrizeCount; i++) {
        prizeAssignments.push(null) // null = no prize
      }

      // Shuffle the prize assignments
      for (let i = prizeAssignments.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [prizeAssignments[i], prizeAssignments[j]] = [prizeAssignments[j], prizeAssignments[i]]
      }

      // Create scratch cards for each participant in Firebase
      const cardPromises = participants.map((participant, index) =>
        addDoc(collection(db, 'scratch_sessions', sessionId, 'cards'), {
          participantId: participant.id,
          prizeId: prizeAssignments[index],
          cardNumber: index + 1,
          scratched: false,
          createdAt: Timestamp.now()
        })
      )

      await Promise.all(cardPromises)

      // Update session status to active
      await updateDoc(doc(db, 'scratch_sessions', sessionId), {
        status: 'active',
        startedAt: Timestamp.now(),
        totalCards: totalParticipants
      })

      // Reload session data
      loadSessionData()

      alert(`Successfully generated ${totalParticipants} scratch cards!`)
    } catch (error) {
      console.error('Error generating scratch cards:', error)
      alert('Failed to generate scratch cards. Please try again.')
    }
  }

  const endSession = async () => {
    try {
      await updateDoc(doc(db, 'scratch_sessions', sessionId), {
        status: 'completed',
        endedAt: Timestamp.now()
      })

      loadSessionData()
      alert('Scratch card session ended!')
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Failed to end session. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--brand-primary), var(--gradient-bg-start), var(--gradient-bg-end))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gb-gold mx-auto"></div>
          <p className="mt-4 text-gb-gold text-lg">Loading scratch card session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--brand-primary), var(--gradient-bg-start), var(--gradient-bg-end))' }}>
        <div className="text-center" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>
          <h1 className="text-2xl font-bold mb-4">Session not found</h1>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 bg-gb-gold text-gb-navy rounded-lg font-bold"
          >
            Back to Admin
          </button>
        </div>
      </div>
    )
  }

  const totalPrizes = prizes.reduce((sum, prize) => sum + prize.quantity, 0)

  return (
    <div className="w-screen h-screen relative overflow-hidden flex flex-col" style={{ background: 'linear-gradient(to bottom right, var(--gradient-bg-start), var(--gradient-bg-middle), var(--gradient-bg-end))' }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 animate-pulse" style={{ background: 'linear-gradient(to right, rgba(250,204,21,0.1), rgba(248,113,113,0.1), rgba(244,114,182,0.1))' }}></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-bounce" style={{ backgroundColor: 'rgba(250,204,21,0.2)' }}></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-bounce delay-1000" style={{ backgroundColor: 'rgba(168,85,247,0.2)' }}></div>
      <header className="relative z-10 bg-gb-navy shadow-2xl border-b-4 border-gb-gold flex-shrink-0 h-20">
        <div className="w-full px-4 py-2 h-full">
          <div className="flex items-center justify-between h-full">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gb-gold hover:text-gb-gold-light transition-colors px-3 py-2 rounded-lg hover:bg-gb-gold/10"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <img src="/gbname.png" alt="GB Logo" className="h-16" />
            <div>
              <h1 className="text-xl font-bold text-gb-gold drop-shadow-lg font-serif">
                {session.title}
              </h1>
              <p className="text-gb-gold/80 text-sm">Code: {session.sessionCode}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 p-4">
        <div className="grid grid-cols-2 gap-4 h-full max-h-full">

          <div className="col-span-1 flex flex-col gap-4 h-full min-h-0">
            <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-gb-gold flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-gb-gold p-2 rounded-lg">
                    <Users className="w-5 h-5 text-gb-navy" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Scratch Card Participants</h2>
                    <p className="text-gb-gold text-sm font-medium">Live participant tracking</p>
                  </div>
                </div>
                <button
                  onClick={loadParticipants}
                  className="px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-bold shadow-lg transition-all text-sm flex items-center gap-2"
                >
                  <span>Refresh</span>
                </button>
              </div>

              <div className="flex items-center justify-between mb-3 bg-gb-gold/10 rounded-lg p-3 flex-shrink-0 border border-gb-gold/30">
                <div className="flex items-center gap-4">
                  <div className="bg-gb-gold/20 p-1.5 rounded-full">
                    <Users className="w-5 h-5 text-gb-gold" />
                  </div>
                  <div>
                    <span className="text-xl font-bold text-gb-gold">{participants.length}</span>
                    <span className="text-sm font-medium ml-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Participants Ready</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gb-gold/80 uppercase tracking-wide">Status</div>
                  <div
                    className="text-sm font-medium px-2 py-1 rounded"
                    style={{
                      backgroundColor: session.status === 'setup' ? 'var(--status-setup)' :
                        session.status === 'waiting' ? 'var(--status-waiting)' :
                        session.status === 'active' ? 'var(--status-active)' :
                        'var(--status-completed)',
                      color: 'var(--text-on-primary-color, #ffffff)'
                    }}
                  >
                    {session.status.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {participants.length === 0 ? (
                  <div className="text-center py-8 bg-gb-gold/5 rounded-xl border border-gb-gold/20 h-full flex flex-col items-center justify-center">
                    <div className="bg-gb-gold/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Users className="w-8 h-8 text-gb-gold" />
                    </div>
                    <p className="text-lg font-bold mb-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Waiting for Participants</p>
                    <p className="text-gb-gold/80 text-sm">Share the QR code to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {participants.map((participant, index) => (
                      <div key={participant.id} className="flex items-center justify-between py-3 px-4 rounded-lg border border-gb-gold/20 transition-all group" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-gb-gold rounded-lg flex items-center justify-center text-gb-navy font-bold text-sm shadow-lg flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-base truncate block" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{participant.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-gb-gold text-sm font-medium bg-gb-gold/10 px-2 py-0.5 rounded">✓ Ready</span>
                              <span className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Giveaway Participant</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gb-gold/20 flex-shrink-0">
                {session.status === 'setup' && (
                  <button
                    onClick={generateScratchCards}
                    disabled={participants.length === 0}
                    className="flex-1 py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--success-color)', color: 'var(--text-on-primary-color, #ffffff)' }}
                    onMouseOver={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--success-hover)')}
                    onMouseOut={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = 'var(--success-color)')}
                  >
                    <Play className="w-5 h-5" />
                    Generate Scratch Cards ({participants.length})
                  </button>
                )}

                {session.status === 'active' && (
                  <>
                    <button
                      onClick={() => navigate(`/admin/scratch-results/${sessionId}`)}
                      className="flex-1 py-3 px-4 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-bold transition-all"
                    >
                      View Results
                    </button>
                    <button
                      onClick={endSession}
                      className="flex-1 py-3 px-4 rounded-lg font-bold transition-all"
                      style={{ backgroundColor: 'var(--error-color)', color: 'var(--text-on-primary-color, #ffffff)' }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--error-hover)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--error-color)'}
                    >
                      End Session
                    </button>
                  </>
                )}

                {session.status === 'completed' && (
                  <button
                    onClick={() => navigate(`/admin/scratch-results/${sessionId}`)}
                    className="flex-1 py-3 px-4 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-bold transition-all"
                  >
                    View Final Results
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 h-full min-h-0">
            {/* QR Code */}
            <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-gb-gold flex flex-col min-h-0">
              <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                <div className="bg-gb-gold p-2 rounded-lg">
                  <QrCode className="w-5 h-5 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Participant Access</h2>
                  <p className="text-gb-gold text-sm font-medium">Scan to join giveaway</p>
                </div>
              </div>

              <div className="text-center flex-1 flex flex-col justify-center min-h-0">
                <div className="p-4 rounded-xl border-2 border-gb-gold mb-4 shadow-2xl mx-auto flex-shrink-0" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
                  <QRCode
                    value={sessionUrl}
                    size={qrSize}
                    level="M"
                  />
                </div>

                <div className="bg-gb-gold/10 rounded-lg p-1.5 sm:p-2 border border-gb-gold/30 flex-shrink-0 mt-auto">
                  <div className="text-gb-gold text-[10px] sm:text-xs font-bold uppercase tracking-wide mb-0.5">Session URL</div>
                  <p className="text-xs sm:text-sm font-mono break-all leading-tight" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{sessionUrl}</p>
                </div>
              </div>
            </div>

            {/* Prize Summary */}
            <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-gb-gold flex flex-col min-h-0">
              <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                <div className="bg-gb-gold p-2 rounded-lg">
                  <Gift className="w-5 h-5 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Prizes</h2>
                  <p className="text-gb-gold text-sm font-medium">{totalPrizes} total</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
                {prizes.map((prize, index) => (
                  <div key={prize.id} className="bg-gb-gold/10 rounded-lg p-2 border border-gb-gold/30">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm truncate" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{prize.prizeName}</span>
                      <span className="text-gb-gold font-bold text-base">×{prize.quantity}</span>
                    </div>
                  </div>
                ))}
                {prizes.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>No prizes configured</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ScratchCardSession
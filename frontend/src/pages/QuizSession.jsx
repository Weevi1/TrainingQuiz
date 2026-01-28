import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Users, Clock, Play, Square, Trophy, Zap, Star, Target, Award, X, ArrowLeft } from 'lucide-react'
import {
  getSession,
  subscribeToParticipants,
  subscribeToSession,
  subscribeToAnswers,
  removeParticipant,
  updateSession
} from '../lib/firestore'
import { serverTimestamp, enableNetwork, disableNetwork } from 'firebase/firestore'
import { gameShowSounds } from '../lib/gameShowSounds'

function QuizSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [liveResults, setLiveResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(true)
  const [lastParticipantUpdate, setLastParticipantUpdate] = useState(new Date())
  const [qrSize, setQrSize] = useState(400)
  const [timeRemaining, setTimeRemaining] = useState(null)

  // Update QR code size based on window dimensions
  useEffect(() => {
    const updateQrSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      // Calculate size based on both width and height, with reasonable limits
      const maxSize = Math.min(width * 0.35, height * 0.4, 450)
      const minSize = 180
      setQrSize(Math.max(minSize, maxSize))
    }

    updateQrSize()
    window.addEventListener('resize', updateQrSize)
    return () => window.removeEventListener('resize', updateQrSize)
  }, [])

  useEffect(() => {
    if (!sessionId) return

    console.log('🔥 Setting up Firebase real-time subscriptions for session:', sessionId)

    // Load initial session data
    loadSessionData()

    // Set up real-time subscriptions - NO POLLING NEEDED!
    const unsubscribeSession = subscribeToSession(sessionId, (sessionData) => {
      console.log('🔥 REAL-TIME: Session updated!', sessionData)
      setSession(sessionData)
      setRealtimeConnected(true)
    })

    const unsubscribeParticipants = subscribeToParticipants(sessionId, (participantsData) => {
      console.log('🔥 REAL-TIME: Participants updated!', participantsData.length, 'participants')
      setParticipants(participantsData)
      setLastParticipantUpdate(new Date())
      setRealtimeConnected(true)
    })

    const unsubscribeAnswers = subscribeToAnswers(sessionId, (answersData) => {
      console.log('🔥 REAL-TIME: Answers updated!', answersData.length, 'answers')
      calculateLiveResults(answersData)
      setRealtimeConnected(true)
    })

    // Cleanup function - unsubscribe from all real-time listeners
    return () => {
      console.log('🧹 Cleaning up Firebase subscriptions...')
      unsubscribeSession()
      unsubscribeParticipants()
      unsubscribeAnswers()
    }
  }, [sessionId])

  // Recalculate live results whenever participants change
  useEffect(() => {
    if (participants.length > 0 && session?.quiz) {
      // Get current answers and recalculate
      const unsubscribe = subscribeToAnswers(sessionId, (answersData) => {
        calculateLiveResults(answersData)
      })
      return unsubscribe
    }
  }, [participants, session?.quiz])

  // Timer management - synchronized with participant screens
  useEffect(() => {
    console.log('🔄 Timer effect triggered:', {
      status: session?.status,
      hasStartedAt: !!session?.startedAt,
      hasTimeLimit: !!session?.quiz?.timeLimit,
      timeLimit: session?.quiz?.timeLimit
    })

    if (session?.status === 'active' && session?.startedAt && session?.quiz?.timeLimit) {
      // Projector is the authoritative timer - calculate from its start time
      const calculateTimeRemaining = () => {
        // Use timerStartedAt (number) first, fallback to startedAt (Firestore timestamp)
        const timerStart = session.timerStartedAt ||
          (session.startedAt ? session.startedAt.toDate().getTime() : Date.now())

        const currentTime = Date.now()
        const elapsedSeconds = Math.floor((currentTime - timerStart) / 1000)
        const remaining = Math.max(0, session.quiz.timeLimit - elapsedSeconds)

        return remaining
      }

      // Update timer display every second (for smooth countdown)
      const displayTimer = setInterval(async () => {
        setTimeRemaining(prev => {
          // Recalculate from authoritative projector time
          const currentTime = calculateTimeRemaining()

          // Broadcast timer update to sync mobile devices every second for better sync
          updateSession(sessionId, {
            currentTimeRemaining: currentTime,
            lastTimerUpdate: Date.now()
          }).catch(error => console.error('Timer sync update failed:', error))

          // Debug logging for projector timer
          if (Math.floor(Date.now() / 1000) % 5 === 0) { // Log every 5 seconds for better debugging
            const timerStart = session.timerStartedAt || (session.startedAt ? session.startedAt.toDate().getTime() : 0)
            console.log('🖥️ PROJECTOR (Authority) Timer:')
            console.log('  - Quiz timeLimit:', session.quiz.timeLimit, 'seconds')
            console.log('  - Timer started at:', new Date(timerStart).toISOString())
            console.log('  - Current time:', new Date().toISOString())
            console.log('  - Elapsed:', Math.floor((Date.now() - timerStart) / 1000), 'seconds')
            console.log('  - Remaining:', currentTime, 'seconds')
            console.log('  - Broadcasting:', currentTime, 'to mobile devices')
          }

          // Auto-end session when timer expires
          if (currentTime <= 0 && session.status === 'active') {
            console.log('⏰ Timer expired on projector, ending session')
            stopSession()
            return 0
          }

          return currentTime
        })
      }, 1000)

      // Set initial time immediately
      const initialTime = calculateTimeRemaining()
      console.log('🚀 TIMER STARTED - Initial calculation:', {
        timeLimit: session.quiz.timeLimit,
        startedAt: session.startedAt.toDate().toISOString(),
        initialRemaining: initialTime
      })
      setTimeRemaining(initialTime)

      return () => clearInterval(displayTimer)
    } else if (session?.status !== 'active') {
      // Reset timer when not active
      setTimeRemaining(session?.quiz?.timeLimit || null)
    }
  }, [session?.status, session?.startedAt, session?.quiz?.timeLimit])

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const loadSessionData = async () => {
    console.log('🔄 LOADING SESSION DATA for sessionId:', sessionId)
    try {
      // Get session data from Firebase
      const sessionData = await getSession(sessionId)
      console.log('✅ SESSION LOADED:', sessionData)
      console.log('📝 QUIZ DATA:', sessionData.quiz)
      console.log('⏰ TIME LIMIT:', sessionData.quiz?.timeLimit, 'seconds =', Math.floor((sessionData.quiz?.timeLimit || 0) / 60), 'minutes')
      setSession(sessionData)
    } catch (error) {
      console.error('💥 Error loading session data:', error)
      // Session not found - redirect back
      navigate('/admin')
    } finally {
      setLoading(false)
    }
  }

  // Calculate live results from answers data
  const calculateLiveResults = (answersData) => {
    if (!session?.quiz?.questions || !participants.length) return

    const participantResults = participants.map(participant => {
      const participantAnswers = answersData.filter(answer => answer.participantId === participant.id)
      const totalQuestions = session.quiz.questions.length
      const correctAnswers = participantAnswers.filter(answer => answer.isCorrect).length
      const totalAnswers = participantAnswers.length
      // Check both answers-based completion and participant.completed flag
      const completed = (totalAnswers >= totalQuestions) || participant.completed || false
      const score = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0
      const avgTime = totalAnswers > 0 ? Math.round(participantAnswers.reduce((sum, a) => sum + (a.timeTaken || 0), 0) / totalAnswers) : 0

      return {
        ...participant,
        completed,
        score,
        totalAnswers,
        avgTime
      }
    })

    // Sort by completion first, then by score, then by time
    participantResults.sort((a, b) => {
      if (a.completed !== b.completed) return b.completed - a.completed
      if (a.score !== b.score) return b.score - a.score
      return a.avgTime - b.avgTime
    })

    setLiveResults(participantResults)
  }

  const kickParticipant = async (participantId, participantName) => {
    if (!confirm(`Are you sure you want to remove ${participantName} from the quiz?`)) {
      return
    }

    try {
      // Delete the participant from Firebase
      await removeParticipant(sessionId, participantId)
      console.log('✅ Participant kicked successfully:', participantName)
      // The real-time subscription will automatically update the participant list
    } catch (error) {
      console.error('💥 Error kicking participant:', error)
      alert('Failed to remove participant. Please try again.')
    }
  }

  const startSession = async () => {
    try {
      const timerStartTime = Date.now()
      await updateSession(sessionId, {
        status: 'active',
        startedAt: serverTimestamp(),
        timerStartedAt: timerStartTime, // Projector's authoritative timer start time
        currentTimeRemaining: session?.quiz?.timeLimit || 60,
        lastTimerUpdate: timerStartTime
      })

      // 🎵 SHOW START FANFARE!
      gameShowSounds.playShowStart()

      console.log('✅ Session started successfully - Projector is timer authority')
      console.log('🕐 Timer started at:', new Date(timerStartTime).toISOString())
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Error starting session. Please try again.')
    }
  }

  const stopSession = async () => {
    try {
      await updateSession(sessionId, {
        status: 'completed',
        endedAt: new Date()
      })

      // 🎵 QUIZ COMPLETE VICTORY SOUND!
      gameShowSounds.playQuizComplete()

      console.log('✅ Session stopped successfully')

      // Show confirmation and redirect to results
      setTimeout(() => {
        navigate(`/results/${sessionId}`)
      }, 2000)
    } catch (error) {
      console.error('Error stopping session:', error)
      alert('Error stopping session. Please try again.')
    }
  }

  const viewResults = () => {
    navigate(`/results/${sessionId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color, #f9fafb)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2" style={{ borderColor: 'var(--primary-color, #2563eb)' }}></div>
          <p className="mt-4" style={{ color: 'var(--text-muted, #4b5563)' }}>Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color, #f9fafb)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-color, #111827)' }}>Session not found</h1>
          <p style={{ color: 'var(--text-muted, #4b5563)' }}>The quiz session you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const sessionUrl = `${window.location.origin}/quiz/${session.sessionCode}`
  
  // Debug the QR code URL
  console.log('🔗 QR Code URL:', sessionUrl)
  console.log('🌐 Current origin:', window.location.origin)

  return (
    <div
      className="w-screen h-screen relative overflow-hidden flex flex-col"
      style={{ background: 'var(--game-gradient, linear-gradient(to bottom right, #581c87, #1e3a8a, #312e81))' }}
    >
      {/* Animated background elements */}
      <div
        className="absolute inset-0 animate-pulse"
        style={{ background: 'var(--celebration-gradient-overlay, linear-gradient(to right, rgba(250,204,21,0.1), rgba(248,113,113,0.1), rgba(244,114,182,0.1)))' }}
      ></div>
      <div
        className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-bounce"
        style={{ backgroundColor: 'var(--accent-glow, rgba(250,204,21,0.2))' }}
      ></div>
      <div
        className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-bounce delay-1000"
        style={{ backgroundColor: 'var(--secondary-glow, rgba(192,132,252,0.2))' }}
      ></div>
      
      <header
        className="relative z-10 shadow-2xl flex-shrink-0 h-24"
        style={{
          backgroundColor: 'var(--header-bg, #1e3a5f)',
          borderBottom: '4px solid var(--brand-gold, #d4a841)'
        }}
      >
        <div className="w-full px-4 py-3 h-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex items-center gap-4">
              {/* Back Button - Only available before quiz starts */}
              <button
                onClick={() => navigate('/admin')}
                disabled={session?.status === 'active' || session?.status === 'completed'}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-lg"
                style={{
                  color: session?.status === 'active' || session?.status === 'completed'
                    ? 'var(--brand-gold-disabled, rgba(212,168,65,0.3))'
                    : 'var(--brand-gold, #d4a841)',
                  cursor: session?.status === 'active' || session?.status === 'completed'
                    ? 'not-allowed'
                    : 'pointer'
                }}
                title={session?.status === 'active' || session?.status === 'completed' ? 'Cannot go back during active quiz' : 'Back to Dashboard'}
              >
                <ArrowLeft className="w-6 h-6" />
                <span className="hidden sm:inline font-semibold">Back</span>
              </button>
              <img src="/gbname.png" alt="GB Logo" className="h-20" />
              <div>
                <h1
                  className="text-2xl font-bold drop-shadow-lg font-serif"
                  style={{ color: 'var(--brand-gold, #d4a841)' }}
                >
                  {session.quiz.title}
                </h1>
                <p
                  className="text-base font-medium"
                  style={{ color: 'var(--brand-gold-muted, rgba(212,168,65,0.8))' }}
                >Live Training Quiz</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`px-5 py-3 rounded-lg text-lg font-semibold tracking-wide shadow-lg transition-all ${
                  session.status === 'active' ? 'animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: session.status === 'waiting'
                    ? 'var(--brand-gold, #d4a841)'
                    : session.status === 'active'
                    ? 'var(--success-color, #16a34a)'
                    : 'var(--neutral-color, #4b5563)',
                  color: session.status === 'waiting'
                    ? 'var(--brand-navy, #1e3a5f)'
                    : '#ffffff'
                }}
              >
                {session.status === 'waiting' && 'Ready to Start'}
                {session.status === 'active' && '● LIVE'}
                {session.status === 'completed' && '✓ Completed'}
              </div>
              {session.status === 'waiting' && (
                <button
                  onClick={startSession}
                  className="px-6 py-3 rounded-lg text-lg font-bold flex items-center gap-3 shadow-lg transition-all hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--brand-gold, #d4a841)',
                    color: 'var(--brand-navy, #1e3a5f)'
                  }}
                >
                  <Play className="w-6 h-6" />
                  Start Quiz
                </button>
              )}
              {session.status === 'active' && (
                <button
                  onClick={stopSession}
                  className="px-6 py-3 rounded-lg text-lg font-bold flex items-center gap-3 shadow-lg transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--error-color, #dc2626)', color: '#ffffff' }}
                >
                  <Square className="w-6 h-6" />
                  End Quiz
                </button>
              )}
              {session.status === 'completed' && (
                <button
                  onClick={viewResults}
                  className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--brand-gold, #d4a841)',
                    color: 'var(--brand-navy, #1e3a5f)'
                  }}
                >
                  <Trophy className="w-5 h-5" />
                  View Results
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 p-4">
        <div className="grid grid-cols-2 gap-4 h-full max-h-full">
          <div className="col-span-1 flex flex-col gap-4 h-full min-h-0">
            {/* Participants Section */}
            <div
              className="backdrop-blur-sm rounded-xl shadow-2xl p-4 flex flex-col flex-1 min-h-0 overflow-hidden"
              style={{
                backgroundColor: 'var(--card-bg, rgba(30,58,95,0.95))',
                border: '2px solid var(--brand-gold, #d4a841)'
              }}
            >
              <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: 'var(--brand-gold, #d4a841)' }}
                  >
                    <Users className="w-5 h-5" style={{ color: 'var(--brand-navy, #1e3a5f)' }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Training Participants</h2>
                    <p className="text-sm font-medium" style={{ color: 'var(--brand-gold, #d4a841)' }}>Live Session Management</p>
                  </div>
                </div>
                <div
                className="px-3 py-2 rounded-lg font-bold shadow-lg text-sm flex items-center gap-2"
                style={{
                  backgroundColor: realtimeConnected
                    ? 'var(--success-color, #22c55e)'
                    : 'var(--error-color, #ef4444)',
                  color: '#ffffff'
                }}
              >
                  <div className={`w-2 h-2 rounded-full ${realtimeConnected ? 'animate-pulse' : ''}`} style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}></div>
                  <span>{realtimeConnected ? 'Live' : 'Offline'}</span>
                </div>
              </div>
              <div
                className="flex items-center justify-between mb-3 rounded-lg p-3 flex-shrink-0"
                style={{
                  backgroundColor: 'var(--brand-gold-transparent, rgba(212,168,65,0.1))',
                  border: '1px solid var(--brand-gold-border, rgba(212,168,65,0.3))'
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-1.5 rounded-full"
                    style={{ backgroundColor: 'var(--brand-gold-light, rgba(212,168,65,0.2))' }}
                  >
                    <Users className="w-5 h-5" style={{ color: 'var(--brand-gold, #d4a841)' }} />
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xl font-bold" style={{ color: 'var(--brand-gold, #d4a841)' }}>{participants.length}</span>
                      <span className="text-sm font-medium ml-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Total</span>
                    </div>
                    {liveResults.length > 0 && (
                      <>
                        <div className="w-px h-6" style={{ backgroundColor: 'var(--brand-gold-transparent, rgba(212,168,65,0.3))' }}></div>
                        <div>
                          <span className="text-xl font-bold" style={{ color: 'var(--success-text, #4ade80)' }}>{liveResults.filter(p => p.completed).length}</span>
                          <span className="text-sm font-medium ml-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Completed</span>
                        </div>
                        <div className="w-px h-6" style={{ backgroundColor: 'var(--brand-gold-transparent, rgba(212,168,65,0.3))' }}></div>
                        <div>
                          <span className="text-xl font-bold" style={{ color: 'var(--warning-text, #facc15)' }}>{session?.status === 'waiting' ? participants.filter(p => !p.completed).length : liveResults.filter(p => !p.completed).length}</span>
                          <span className="text-sm font-medium ml-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{session?.status === 'waiting' ? 'Waiting' : 'In Progress'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-sm uppercase tracking-wide"
                    style={{ color: 'var(--brand-gold-muted, rgba(212,168,65,0.8))' }}
                  >Gustav Barkhuysen</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Training Session</div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0">
                {participants.length === 0 ? (
                  <div
                    className="text-center py-8 rounded-xl h-full flex flex-col items-center justify-center"
                    style={{
                      backgroundColor: 'var(--brand-gold-faint, rgba(212,168,65,0.05))',
                      border: '1px solid var(--brand-gold-border, rgba(212,168,65,0.2))'
                    }}
                  >
                    <div
                      className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center"
                      style={{ backgroundColor: 'var(--brand-gold-transparent, rgba(212,168,65,0.1))' }}
                    >
                      <Users className="w-8 h-8" style={{ color: 'var(--brand-gold, #d4a841)' }} />
                    </div>
                    <p className="text-lg font-bold mb-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Awaiting Training Participants</p>
                    <p className="text-sm" style={{ color: 'var(--brand-gold-muted, rgba(212,168,65,0.8))' }}>Share QR code to begin session</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {participants.map((participant, index) => {
                      // Check completion status from both participant data and live results
                      const liveResult = liveResults.find(lr => lr.id === participant.id)
                      const isCompleted = participant.completed || liveResult?.completed || false

                      return (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between py-3 px-4 rounded-lg border transition-all group"
                          style={{
                            backgroundColor: isCompleted
                              ? 'var(--success-bg-transparent, rgba(34,197,94,0.1))'
                              : 'rgba(255,255,255,0.05)',
                            borderColor: isCompleted
                              ? 'var(--success-border, rgba(74,222,128,0.3))'
                              : 'var(--brand-gold-transparent, rgba(212,168,65,0.2))'
                          }}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg flex-shrink-0"
                              style={{
                                backgroundColor: isCompleted
                                  ? 'var(--success-color, #22c55e)'
                                  : 'var(--brand-gold, #d4a841)',
                                color: isCompleted ? '#ffffff' : 'var(--brand-navy, #1e3a5f)'
                              }}
                            >
                              {isCompleted ? '✓' : index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-base truncate block" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{participant.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {isCompleted ? (
                                  <span
                                    className="text-sm font-medium px-2 py-0.5 rounded"
                                    style={{ color: 'var(--success-text, #4ade80)', backgroundColor: 'var(--success-bg-transparent, rgba(74,222,128,0.1))' }}
                                  >
                                    Completed
                                  </span>
                                ) : session?.status === 'waiting' ? (
                                  <span
                                    className="text-sm font-medium px-2 py-0.5 rounded"
                                    style={{ color: 'var(--info-text, #60a5fa)', backgroundColor: 'var(--info-bg-transparent, rgba(96,165,250,0.1))' }}
                                  >
                                    Waiting
                                  </span>
                                ) : session?.status === 'active' ? (
                                  <span
                                    className="text-sm font-medium px-2 py-0.5 rounded"
                                    style={{ color: 'var(--brand-gold, #d4a841)', backgroundColor: 'var(--brand-gold-transparent, rgba(212,168,65,0.1))' }}
                                  >
                                    In Progress
                                  </span>
                                ) : (
                                  <span
                                    className="text-sm font-medium px-2 py-0.5 rounded"
                                    style={{ color: 'var(--text-muted, #9ca3af)', backgroundColor: 'rgba(156,163,175,0.1)' }}
                                  >
                                    Ready
                                  </span>
                                )}
                                <span className="text-sm" style={{ color: 'var(--text-on-primary-muted, rgba(255,255,255,0.6))' }}>Training Participant</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCompleted && (
                              <div
                                className="text-lg animate-pulse"
                                style={{ color: 'var(--success-text, #4ade80)' }}
                              >
                                Trophy
                              </div>
                            )}
                            <button
                              onClick={() => kickParticipant(participant.id, participant.name)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group shadow-lg hover:shadow-xl hover:opacity-90 flex-shrink-0"
                              style={{ backgroundColor: 'var(--error-color, #dc2626)' }}
                              title={`Remove ${participant.name}`}
                            >
                              <X className="w-4 h-4 group-hover:scale-110 transition-transform" style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="flex flex-col gap-4 h-full min-h-0">
            {/* QR Code Section */}
            <div
              className="backdrop-blur-sm rounded-xl shadow-2xl p-4 flex flex-col min-h-0"
              style={{
                backgroundColor: 'var(--card-bg, rgba(30,58,95,0.95))',
                border: '2px solid var(--brand-gold, #d4a841)'
              }}
            >
              <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: 'var(--brand-gold, #d4a841)' }}
                >
                  <Target className="w-5 h-5" style={{ color: 'var(--brand-navy, #1e3a5f)' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Session Access</h2>
                  <p className="text-sm font-medium" style={{ color: 'var(--brand-gold, #d4a841)' }}>Participant Entry Portal</p>
                </div>
              </div>

              <div className="text-center flex-1 flex flex-col justify-center min-h-0">
                <div
                  className="p-4 rounded-xl mb-4 shadow-2xl mx-auto flex-shrink-0"
                  style={{ backgroundColor: 'var(--surface-color, #ffffff)', border: '2px solid var(--brand-gold, #d4a841)' }}
                >
                  <QRCode
                    value={sessionUrl}
                    size={qrSize}
                    level="M"
                  />
                </div>

                <div
                  className="rounded-lg p-2 flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--brand-gold-transparent, rgba(212,168,65,0.1))',
                    border: '1px solid var(--brand-gold-border, rgba(212,168,65,0.3))'
                  }}
                >
                  <div
                    className="text-xs font-bold uppercase tracking-wide mb-1"
                    style={{ color: 'var(--brand-gold, #d4a841)' }}
                  >Session URL</div>
                  <p className="text-sm font-mono break-all" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{sessionUrl}</p>
                </div>
              </div>
            </div>

            {/* Timer Display - Redesigned for better UX */}
            <div
              className="backdrop-blur-sm rounded-xl shadow-2xl flex-1 min-h-0 overflow-hidden flex flex-col"
              style={{
                backgroundColor: 'var(--card-bg, rgba(30,58,95,0.95))',
                border: '2px solid var(--brand-gold, #d4a841)'
              }}
            >

              {/* Timer Section - Dominant */}
              <div className="flex-1 flex flex-col justify-center items-center text-center p-6">
                {session?.status === 'active' ? (
                  <>
                    <div
                      className={`text-7xl font-mono font-bold mb-2 ${timeRemaining <= 30 ? 'animate-pulse' : ''}`}
                      style={{
                        color: timeRemaining <= 30
                          ? 'var(--error-text, #f87171)'
                          : timeRemaining <= 60
                          ? 'var(--warning-text, #facc15)'
                          : 'var(--brand-gold, #d4a841)'
                      }}
                    >
                      {formatTime(timeRemaining)}
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Time Remaining</div>
                    {timeRemaining <= 30 && timeRemaining > 0 && (
                      <div
                        className="text-xs font-bold animate-bounce"
                        style={{ color: 'var(--error-text, #f87171)' }}
                      >
                        FINAL COUNTDOWN
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className="text-5xl font-mono font-bold mb-2"
                      style={{ color: 'var(--brand-gold, #d4a841)' }}
                    >
                      {formatTime(session?.quiz?.timeLimit)}
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Quiz Duration</div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: 'var(--brand-gold-muted, rgba(212,168,65,0.7))' }}
                    >
                      {session?.status === 'waiting' ? 'Timer will start when quiz begins' : 'Quiz completed'}
                    </div>
                  </>
                )}
              </div>

              {/* Quiz Details - Compact footer */}
              <div
                className="rounded-b-xl px-4 py-3 flex-shrink-0"
                style={{
                  backgroundColor: 'var(--brand-gold-transparent, rgba(212,168,65,0.1))',
                  borderTop: '1px solid var(--brand-gold-border, rgba(212,168,65,0.2))'
                }}
              >
                <div className="flex items-center justify-center text-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--brand-gold, #d4a841)' }}
                    ></div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{session?.quiz?.questions?.length || 0} Questions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default QuizSession
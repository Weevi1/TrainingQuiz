import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, Play, Clock, AlertCircle, CheckCircle, QrCode } from 'lucide-react'
import { FirestoreService, type GameSession } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Participant {
  id: string
  name: string
  joinedAt: Date
  isReady: boolean
}

export const JoinSession: React.FC = () => {
  const navigate = useNavigate()
  const { sessionCode } = useParams<{ sessionCode?: string }>()

  const [inputCode, setInputCode] = useState(sessionCode || '')
  const [participantName, setParticipantName] = useState('')
  const [session, setSession] = useState<GameSession | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')

  // Auto-search for session when code is provided in URL
  useEffect(() => {
    if (sessionCode) {
      findSession(sessionCode)
    }
  }, [sessionCode])

  const findSession = async (code: string) => {
    if (!code.trim()) {
      setError('Please enter a session code')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Find session by code in Firestore
      const foundSession = await FirestoreService.findSessionByCode(code.toUpperCase())

      if (!foundSession) {
        setError('Session not found. Please check the code and try again.')
        setSession(null)
        setLoading(false)
        return
      }

      setSession(foundSession)

      // Load real participants from Firestore
      const sessionParticipants = await FirestoreService.getSessionParticipants(foundSession.id)
      setParticipants(sessionParticipants.map(p => ({
        id: p.id,
        name: p.name,
        joinedAt: p.joinedAt,
        isReady: p.status === 'ready' || p.status === 'playing'
      })))

    } catch (error) {
      console.error('Error finding session:', error)
      setError('Session not found. Please check the code and try again.')
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  const joinSession = async () => {
    if (!participantName.trim()) {
      setError('Please enter your name')
      return
    }

    if (!session) {
      setError('No session selected')
      return
    }

    if (session.currentParticipants >= session.participantLimit) {
      setError('Session is full')
      return
    }

    if (session.status === 'completed') {
      setError('This session has already ended')
      return
    }

    if (session.status === 'active' && !session.settings.allowLateJoin) {
      setError('Late joining is not allowed for this session')
      return
    }

    setJoining(true)
    setError('')

    try {
      // Add participant to session in Firestore
      const participantId = await FirestoreService.addParticipantToSession(session.id, participantName)

      if (!participantId) {
        throw new Error('Failed to create participant record')
      }

      setJoined(true)

      // Navigate to the game interface after a short delay
      setTimeout(() => {
        navigate(`/play/${session.code}`, {
          state: {
            participantName,
            participantId,
            sessionId: session.id,
            gameType: session.gameType
          }
        })
      }, 1500)

    } catch (error) {
      console.error('Error joining session:', error)
      setError('Failed to join session. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Finding session...</p>
        </div>
      </div>
    )
  }

  if (joined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div
            className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--success-light-color)' }}
          >
            <CheckCircle style={{ color: 'var(--success-color)' }} size={32} />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Welcome!</h1>
          <p className="text-text-secondary mb-4">
            You've successfully joined the session. Redirecting to the game...
          </p>
          <LoadingSpinner size="sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <h1 className="text-xl font-bold text-primary">Join Training Session</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!session ? (
          /* Session Code Entry */
          <div className="card text-center">
            <div className="mb-6">
              <QrCode className="mx-auto text-primary mb-4" size={48} />
              <h2 className="text-2xl font-bold mb-2">Enter Session Code</h2>
              <p className="text-text-secondary">
                Enter the 6-character code provided by your trainer
              </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <div>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="input text-center text-2xl font-mono tracking-widest"
                  placeholder="ABC123"
                  maxLength={6}
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--error-color)' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={() => findSession(inputCode)}
                disabled={inputCode.length !== 6}
                className="btn-primary w-full"
              >
                Find Session
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm text-text-secondary">
                Scan the QR code shown by your trainer or enter the session code manually
              </p>
            </div>
          </div>
        ) : (
          /* Session Found - Join Interface */
          <div className="space-y-6">
            {/* Session Info */}
            <div className="card">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-primary mb-2">{session.title}</h2>
                <div className="flex items-center justify-center space-x-4 text-text-secondary">
                  <div className="flex items-center space-x-1">
                    <Play size={16} />
                    <span className="capitalize">{session.gameType}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users size={16} />
                    <span>{session.currentParticipants}/{session.participantLimit}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock size={16} />
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: session.status === 'waiting' ? 'var(--primary-light-color)' :
                          session.status === 'active' ? 'var(--success-light-color)' :
                          'var(--surface-color)',
                        color: session.status === 'waiting' ? 'var(--primary-color)' :
                          session.status === 'active' ? 'var(--success-color)' :
                          'var(--text-secondary-color)'
                      }}
                    >
                      {session.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Name Entry */}
              <div className="max-w-sm mx-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    className="input w-full"
                    placeholder="Enter your name"
                    maxLength={50}
                  />
                </div>

                {error && (
                  <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--error-color)' }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={joinSession}
                  disabled={joining || !participantName.trim()}
                  className="btn-primary w-full flex items-center justify-center space-x-2"
                >
                  {joining ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <Users size={16} />
                      <span>Join Session</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Current Participants */}
            <div className="card">
              <h3 className="font-semibold mb-4">
                Participants ({participants.length}/{session.participantLimit})
              </h3>

              {participants.length === 0 ? (
                <p className="text-text-secondary text-center py-4">
                  No participants yet. Be the first to join!
                </p>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--surface-color)' }}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: participant.isReady ? 'var(--success-color)' : 'var(--warning-color)' }}
                        />
                        <span className="font-medium">{participant.name}</span>
                      </div>
                      <span className="text-sm text-text-secondary">
                        {participant.isReady ? 'Ready' : 'Joining...'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Session Status */}
            {session.status === 'waiting' && (
              <div
                className="card"
                style={{
                  backgroundColor: 'var(--primary-light-color)',
                  borderColor: 'var(--primary-color)'
                }}
              >
                <div className="flex items-center space-x-3">
                  <Clock style={{ color: 'var(--primary-color)' }} size={20} />
                  <div>
                    <p className="font-medium" style={{ color: 'var(--primary-dark-color)' }}>Waiting to Start</p>
                    <p className="text-sm" style={{ color: 'var(--primary-color)' }}>
                      The trainer will start the session when ready
                    </p>
                  </div>
                </div>
              </div>
            )}

            {session.status === 'active' && session.settings.allowLateJoin && (
              <div
                className="card"
                style={{
                  backgroundColor: 'var(--success-light-color)',
                  borderColor: 'var(--success-color)'
                }}
              >
                <div className="flex items-center space-x-3">
                  <Play style={{ color: 'var(--success-color)' }} size={20} />
                  <div>
                    <p className="font-medium" style={{ color: 'var(--success-color)' }}>Session Active</p>
                    <p className="text-sm" style={{ color: 'var(--success-color)' }}>
                      You can still join this session
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
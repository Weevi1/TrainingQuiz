import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, Play, Clock, AlertCircle, CheckCircle, QrCode, UserPlus, Volume2, Award } from 'lucide-react'
import { FirestoreService, type GameSession, type Organization } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

import { applyOrganizationBranding } from '../lib/applyBranding'

interface Participant {
  id: string
  name: string
  joinedAt: Date
  isReady: boolean
  avatar?: string
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
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [newParticipantName, setNewParticipantName] = useState<string | null>(null) // For toast notification
  const [selectedAvatar, setSelectedAvatar] = useState('😀')
  const previousParticipantCountRef = useRef(0)

  // Avatar options
  const AVATAR_OPTIONS = ['😀', '😎', '🤓', '🦊', '🐱', '🐼', '🦁', '🐸', '🦄', '🌟', '🚀', '💪']

  // Auto-search for session when code is provided in URL
  useEffect(() => {
    if (sessionCode) {
      findSession(sessionCode)
    }
  }, [sessionCode])

  // Real-time subscription to participants
  useEffect(() => {
    if (!session?.id) return

    const unsubscribe = FirestoreService.subscribeToSessionParticipants(
      session.id,
      (newParticipants) => {
        const mappedParticipants = newParticipants.map(p => ({
          id: p.id,
          name: p.name,
          joinedAt: p.joinedAt,
          isReady: p.isReady,
          avatar: (p as any).avatar || '😀'
        }))

        // Check if a new participant joined
        if (mappedParticipants.length > previousParticipantCountRef.current) {
          // Find the new participant (most recently joined)
          const sortedByJoinTime = [...mappedParticipants].sort(
            (a, b) => (b.joinedAt?.getTime() || 0) - (a.joinedAt?.getTime() || 0)
          )
          const newestParticipant = sortedByJoinTime[0]

          if (newestParticipant) {
            setNewParticipantName(newestParticipant.name)
            // Join sounds only play on presenter (SessionControl)

            // Hide toast after 3 seconds
            setTimeout(() => {
              setNewParticipantName(null)
            }, 3000)
          }
        }

        previousParticipantCountRef.current = mappedParticipants.length
        setParticipants(mappedParticipants)
      }
    )

    return () => unsubscribe()
  }, [session?.id])

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

      // Load organization branding
      try {
        const org = await FirestoreService.getOrganization(foundSession.organizationId)
        if (org) {
          setOrganization(org)
          await applyOrganizationBranding(org.branding)
        }
      } catch (orgError) {
        console.error('Error loading organization branding:', orgError)
      }

      // Load initial participants from Firestore
      const sessionParticipants = await FirestoreService.getSessionParticipants(foundSession.id)
      const mappedParticipants = sessionParticipants.map(p => ({
        id: p.id,
        name: p.name,
        joinedAt: p.joinedAt,
        isReady: p.isReady,
        avatar: (p as any).avatar || '😀'
      }))
      setParticipants(mappedParticipants)
      previousParticipantCountRef.current = mappedParticipants.length

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
      // Add participant to session in Firestore (with avatar)
      const participantId = await FirestoreService.addParticipantToSession(session.id, participantName, selectedAvatar)

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
            gameType: session.gameType,
            avatar: selectedAvatar
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background-color)' }}>

      {/* New Participant Toast Notification */}
      {newParticipantName && (
        <div
          className="fixed top-4 right-4 z-50 animate-slide-in-right"
          style={{
            animation: 'slideInRight 0.3s ease-out forwards'
          }}
        >
          <div
            className="flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg"
            style={{
              backgroundColor: 'var(--success-color)',
              color: 'white'
            }}
          >
            <UserPlus size={20} />
            <span className="font-medium">{newParticipantName} just joined!</span>
          </div>
        </div>
      )}

      {/* CSS for toast animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes participantEnter {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .participant-enter {
          animation: participantEnter 0.3s ease-out forwards;
        }
      `}</style>

      {/* Header */}
      <header style={{ backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            {organization?.branding?.logoUrl ? (
              <img
                src={organization.branding.logoUrl}
                alt={organization.name}
                className="h-10 object-contain"
              />
            ) : (
              <h1 className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>
                Join Training Session
              </h1>
            )}
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
              <p className="text-base text-text-secondary">
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
                <div className="flex items-center space-x-2 text-base" style={{ color: 'var(--error-color)' }}>
                  <AlertCircle size={18} />
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
              <p className="text-base text-text-secondary">
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
                <div className="flex items-center justify-center space-x-4 text-base text-text-secondary">
                  <div className="flex items-center space-x-1">
                    <Play size={18} />
                    <span className="capitalize">{session.gameType}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users size={18} />
                    <span>{session.currentParticipants}/{session.participantLimit}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock size={18} />
                    <span
                      className="px-2 py-1 rounded text-sm font-medium"
                      style={{
                        backgroundColor: session.status === 'waiting' ? 'var(--primary-color)' :
                          session.status === 'active' ? 'var(--success-color)' :
                          'var(--surface-hover-color)',
                        color: session.status === 'waiting' ? 'var(--text-on-primary-color)' :
                          session.status === 'active' ? '#ffffff' :
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
                  <label className="block text-base font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                    {organization?.settings?.enableAttendanceCertificates ? 'Your Full Name' : 'Your Name'}
                  </label>
                  <input
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    className="input w-full"
                    placeholder={organization?.settings?.enableAttendanceCertificates ? 'Enter your full name' : 'Enter your name'}
                    maxLength={50}
                  />
                  {organization?.settings?.enableAttendanceCertificates && (
                    <div
                      className="flex items-center space-x-2 text-base rounded-lg p-3 mt-2"
                      style={{
                        backgroundColor: 'var(--surface-hover-color)',
                        color: 'var(--text-color)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <Award size={18} className="flex-shrink-0" style={{ color: 'var(--accent-color)' }} />
                      <span>You'll receive an attendance certificate on completion — please use your full name as it should appear on the certificate.</span>
                    </div>
                  )}
                </div>

                {/* Avatar Selection */}
                <div>
                  <label className="block text-base font-medium mb-2">
                    Choose Your Avatar
                  </label>
                  <div className="grid grid-cols-6 gap-3">
                    {AVATAR_OPTIONS.map((avatar) => (
                      <button
                        key={avatar}
                        onClick={() => {
                          setSelectedAvatar(avatar)
                        }}
                        className={`w-12 h-12 text-2xl rounded-lg transition-all ${
                          selectedAvatar === avatar ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
                        }`}
                        style={{
                          backgroundColor: selectedAvatar === avatar
                            ? 'var(--primary-light-color)'
                            : 'var(--surface-color)',
                          ringColor: 'var(--primary-color)',
                          border: '1px solid',
                          borderColor: selectedAvatar === avatar
                            ? 'var(--primary-color)'
                            : 'var(--border-color)'
                        }}
                        type="button"
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volume tip */}
                <div
                  className="flex items-center space-x-2 text-base rounded-lg p-3"
                  style={{
                    backgroundColor: 'var(--surface-hover-color)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <Volume2 size={20} className="flex-shrink-0" style={{ color: 'var(--primary-color)' }} />
                  <span>Turn up your volume for sound effects during the quiz!</span>
                </div>

                {error && (
                  <div className="flex items-center space-x-2 text-base" style={{ color: 'var(--error-color)' }}>
                    <AlertCircle size={18} />
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
                      <Users size={20} />
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
                <p className="text-base text-text-secondary text-center py-4">
                  No participants yet. Be the first to join!
                </p>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant, index) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 rounded-lg participant-enter"
                      style={{
                        backgroundColor: 'var(--surface-color)',
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{participant.avatar || '😀'}</span>
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: participant.isReady ? 'var(--success-color)' : 'var(--warning-color)' }}
                        />
                        <span className="font-medium">{participant.name}</span>
                      </div>
                      <span className="text-base text-text-secondary">
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
                  backgroundColor: 'var(--surface-color)',
                  borderColor: 'var(--primary-color)',
                  borderLeftWidth: '4px'
                }}
              >
                <div className="flex items-center space-x-3">
                  <Clock style={{ color: 'var(--primary-color)' }} size={20} />
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-color)' }}>Waiting to Start</p>
                    <p className="text-base" style={{ color: 'var(--text-secondary-color)' }}>
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
                  backgroundColor: 'var(--surface-color)',
                  borderColor: 'var(--success-color)',
                  borderLeftWidth: '4px'
                }}
              >
                <div className="flex items-center space-x-3">
                  <Play style={{ color: 'var(--success-color)' }} size={20} />
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-color)' }}>Session Active</p>
                    <p className="text-base" style={{ color: 'var(--text-secondary-color)' }}>
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
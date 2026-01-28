// Real-time competition and engagement components

import React, { useState, useEffect } from 'react'
import { Users, Trophy, Zap, Eye, Heart } from 'lucide-react'

interface Participant {
  id: string
  name: string
  score: number
  streak: number
  answered: boolean
  avatar?: string
  isCurrentUser?: boolean
}

interface LiveEngagementProps {
  participants: Participant[]
  currentQuestion: number
  totalQuestions: number
  onReaction?: (reaction: string) => void
  showProgress?: boolean
  showLeaderboard?: boolean
  showParticipantCount?: boolean
  showAnswerProgress?: boolean
}

interface Reaction {
  id: string
  type: '👍' | '😮' | '🔥' | '😅' | '🤔' | '💯'
  participantId: string
  timestamp: number
}

export const LiveEngagement: React.FC<LiveEngagementProps> = ({
  participants,
  currentQuestion,
  totalQuestions,
  onReaction,
  showProgress = true,
  showLeaderboard = true,
  showParticipantCount = true,
  showAnswerProgress = true
}) => {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [showReactionBar, setShowReactionBar] = useState(false)

  // Live participant statistics
  const totalParticipants = participants.length
  const answeredCount = participants.filter(p => p.answered).length
  const progressPercentage = totalParticipants > 0 ? (answeredCount / totalParticipants) * 100 : 0

  // Top performers for leaderboard
  const topPerformers = [...participants]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  useEffect(() => {
    // Clean up old reactions (remove after 5 seconds)
    const cleanup = setInterval(() => {
      const now = Date.now()
      setReactions(prev => prev.filter(r => now - r.timestamp < 5000))
    }, 1000)

    return () => clearInterval(cleanup)
  }, [])

  const handleReaction = (type: Reaction['type']) => {
    if (!onReaction) return

    const reaction: Reaction = {
      id: Date.now().toString(),
      type,
      participantId: 'current-user',
      timestamp: Date.now()
    }

    setReactions(prev => [...prev, reaction])
    onReaction(type)
    setShowReactionBar(false)
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-xs space-y-3">
      {/* Participant Count */}
      {showParticipantCount && (
        <div
          className="backdrop-blur-sm rounded-lg p-3 shadow-lg"
          style={{
            backgroundColor: 'var(--surface-color, rgba(255, 255, 255, 0.9))',
            borderColor: 'var(--border-color, rgba(255, 255, 255, 0.2))',
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <div className="flex items-center space-x-2">
            <Users size={16} style={{ color: 'var(--primary-color)' }} />
            <span className="font-medium" style={{ color: 'var(--text-color)' }}>
              {totalParticipants} participants
            </span>
          </div>
        </div>
      )}

      {/* Answer Progress */}
      {showAnswerProgress && (
        <div
          className="backdrop-blur-sm rounded-lg p-3 shadow-lg"
          style={{
            backgroundColor: 'var(--surface-color, rgba(255, 255, 255, 0.9))',
            borderColor: 'var(--border-color, rgba(255, 255, 255, 0.2))',
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary-color)' }}>
              Answered: {answeredCount}/{totalParticipants}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted-color, #6b7280)' }}>
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--background-color, #e5e7eb)' }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercentage}%`,
                background: 'linear-gradient(to right, var(--primary-color), var(--secondary-color))'
              }}
            />
          </div>
          {answeredCount === totalParticipants && (
            <div className="text-xs mt-1 font-medium" style={{ color: 'var(--success-color)' }}>
              All participants answered! 🎉
            </div>
          )}
        </div>
      )}

      {/* Question Progress */}
      {showProgress && (
        <div
          className="backdrop-blur-sm rounded-lg p-3 shadow-lg"
          style={{
            backgroundColor: 'var(--surface-color, rgba(255, 255, 255, 0.9))',
            borderColor: 'var(--border-color, rgba(255, 255, 255, 0.2))',
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <div className="flex items-center space-x-2 mb-2">
            <Eye size={16} style={{ color: 'var(--secondary-color)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary-color)' }}>
              Question {currentQuestion} of {totalQuestions}
            </span>
          </div>
          <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--background-color, #e5e7eb)' }}>
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(currentQuestion / totalQuestions) * 100}%`,
                background: 'linear-gradient(to right, var(--secondary-color), var(--accent-color, #ec4899))'
              }}
            />
          </div>
        </div>
      )}

      {/* Live Leaderboard */}
      {showLeaderboard && topPerformers.length > 0 && (
        <div
          className="backdrop-blur-sm rounded-lg p-3 shadow-lg"
          style={{
            backgroundColor: 'var(--surface-color, rgba(255, 255, 255, 0.9))',
            borderColor: 'var(--border-color, rgba(255, 255, 255, 0.2))',
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <div className="flex items-center space-x-2 mb-3">
            <Trophy size={16} style={{ color: 'var(--warning-color, #ca8a04)' }} />
            <span className="font-medium" style={{ color: 'var(--text-color)' }}>Live Rankings</span>
          </div>
          <div className="space-y-2">
            {topPerformers.map((participant, index) => (
              <div
                key={participant.id}
                className="flex items-center space-x-2 p-2 rounded-md transition-all"
                style={
                  participant.isCurrentUser
                    ? {
                        backgroundColor: 'var(--primary-light-color, rgba(59, 130, 246, 0.1))',
                        borderColor: 'var(--primary-color)',
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }
                    : undefined
                }
              >
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={
                    index === 0
                      ? { backgroundColor: 'var(--gold-color, #facc15)', color: 'var(--gold-text-color, #713f12)' }
                      : index === 1
                      ? { backgroundColor: 'var(--silver-color, #d1d5db)', color: 'var(--text-secondary-color, #374151)' }
                      : index === 2
                      ? { backgroundColor: 'var(--bronze-color, #fb923c)', color: 'var(--bronze-text-color, #7c2d12)' }
                      : { backgroundColor: 'var(--background-color, #f3f4f6)', color: 'var(--text-muted-color, #4b5563)' }
                  }
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-color)' }}>
                    {participant.name}
                    {participant.isCurrentUser && (
                      <span className="ml-1" style={{ color: 'var(--primary-color)' }}>(You)</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs" style={{ color: 'var(--text-muted-color, #6b7280)' }}>
                    <span>{participant.score.toLocaleString()}</span>
                    {participant.streak > 0 && (
                      <div className="flex items-center">
                        <Zap size={10} style={{ color: 'var(--streak-color, #f97316)' }} />
                        <span style={{ color: 'var(--streak-color, #ea580c)' }}>{participant.streak}</span>
                      </div>
                    )}
                  </div>
                </div>
                {participant.answered && (
                  <div style={{ color: 'var(--success-color)' }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Reactions */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {reactions.map(reaction => (
          <FloatingReaction key={reaction.id} reaction={reaction} />
        ))}
      </div>

      {/* Reaction Bar */}
      {showReactionBar && onReaction && (
        <div
          className="backdrop-blur-sm rounded-lg p-3 shadow-lg"
          style={{
            backgroundColor: 'var(--surface-color, rgba(255, 255, 255, 0.95))',
            borderColor: 'var(--border-color, rgba(255, 255, 255, 0.2))',
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <div className="flex items-center space-x-2">
            {(['👍', '😮', '🔥', '😅', '🤔', '💯'] as const).map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors"
                style={{ backgroundColor: 'var(--background-color, #f3f4f6)' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--background-hover-color, #e5e7eb)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--background-color, #f3f4f6)'}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reaction Trigger */}
      {onReaction && (
        <button
          onClick={() => setShowReactionBar(!showReactionBar)}
          className="p-3 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          style={{
            background: 'linear-gradient(to right, var(--secondary-color), var(--accent-color, #ec4899))',
            color: 'var(--button-text-color, #ffffff)'
          }}
        >
          <Heart size={16} />
        </button>
      )}
    </div>
  )
}

// Floating reaction animation component
const FloatingReaction: React.FC<{ reaction: Reaction }> = ({ reaction }) => {
  const [position] = useState({
    x: Math.random() * window.innerWidth * 0.8,
    y: window.innerHeight * 0.8
  })

  useEffect(() => {
    // Auto-remove after animation
    const timer = setTimeout(() => {
      // Component will be unmounted by parent cleanup
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="absolute text-2xl animate-bounce pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        animation: 'float-up 5s ease-out forwards'
      }}
    >
      {reaction.type}
    </div>
  )
}

// Additional CSS for floating animation (add to index.css)
const floatingAnimationCSS = `
@keyframes float-up {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateY(-200px) scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: translateY(-400px) scale(0.5);
    opacity: 0;
  }
}
`

export { floatingAnimationCSS }
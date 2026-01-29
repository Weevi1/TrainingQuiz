import React, { useState, useEffect } from 'react'
import { useGameSounds } from '../lib/soundSystem'
import { useVisualEffects } from '../lib/visualEffects'

interface CountdownOverlayProps {
  onComplete: () => void
  startFrom?: number
  organizationLogo?: string
  sessionTitle?: string
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  onComplete,
  startFrom = 3,
  organizationLogo,
  sessionTitle
}) => {
  const [count, setCount] = useState(startFrom)
  const [showGo, setShowGo] = useState(false)

  const { playSound } = useGameSounds(true)
  const { triggerScreenEffect } = useVisualEffects()

  useEffect(() => {
    // Play initial sound
    playSound('tick')

    const timer = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Show "GO!" message
          setShowGo(true)
          playSound('gameStart')
          triggerScreenEffect('screen-flash', { color: 'var(--success-color)' })

          // Call onComplete after GO animation
          setTimeout(() => {
            onComplete()
          }, 800)
          return 0
        }

        // Play tick sound for each count
        playSound('tick')
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'linear-gradient(135deg, var(--primary-dark-color, #1e3a8a), var(--secondary-color, #1e40af), var(--primary-color, #3b82f6))'
      }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: 'var(--accent-color, #f59e0b)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: 'var(--primary-light-color, #60a5fa)', animationDelay: '0.5s' }}
        />
      </div>

      <div className="text-center relative z-10">
        {/* Organization logo */}
        {organizationLogo && (
          <img
            src={organizationLogo}
            alt="Organization"
            className="h-16 mx-auto mb-6 object-contain"
          />
        )}

        {/* Session title */}
        {sessionTitle && (
          <h2
            className="text-2xl md:text-3xl font-bold mb-8 text-white opacity-80"
          >
            {sessionTitle}
          </h2>
        )}

        {/* "Get Ready" text */}
        {!showGo && (
          <p
            className="text-xl md:text-2xl text-white opacity-75 mb-4 animate-pulse"
          >
            Get Ready!
          </p>
        )}

        {/* Countdown number or GO */}
        <div className="relative">
          {showGo ? (
            <div
              className="text-8xl md:text-9xl font-black animate-bounce"
              style={{
                color: 'var(--success-color)',
                textShadow: '0 0 60px var(--success-color), 0 0 100px var(--success-color)'
              }}
            >
              GO!
            </div>
          ) : (
            <div
              className="text-9xl md:text-[12rem] font-black transition-all duration-300 transform"
              style={{
                color: 'white',
                textShadow: '0 0 40px rgba(255,255,255,0.5), 0 0 80px rgba(255,255,255,0.3)',
                animation: 'countdown-pulse 1s ease-in-out infinite'
              }}
            >
              {count}
            </div>
          )}
        </div>

        {/* Circular progress indicator */}
        {!showGo && (
          <div className="mt-8">
            <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(count / startFrom) * 283} 283`}
                transform="rotate(-90 50 50)"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
          </div>
        )}
      </div>

      {/* CSS for custom animation */}
      <style>{`
        @keyframes countdown-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  )
}

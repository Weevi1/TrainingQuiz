// ReactionOverlay — Fullscreen reaction animation during answer feedback
// Shows custom video reactions when uploaded, or built-in CSS animations as defaults
import React, { useMemo, useEffect, useRef } from 'react'
import type { OrganizationBranding } from '../lib/firestore'

interface ReactionOverlayProps {
  type: 'correct' | 'incorrect' | 'celebration'
  reactions?: OrganizationBranding['reactions']
  visible: boolean
  children?: React.ReactNode
}

// Built-in animated reaction (CSS-only, no external assets needed)
const BuiltInReaction: React.FC<{ type: 'correct' | 'incorrect' | 'celebration' }> = ({ type }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Celebration confetti on canvas
  useEffect(() => {
    if (type !== 'celebration' || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFEAA7', '#DDA0DD', '#82E0AA', '#F7DC6F', '#BB8FCE']
    const particles: Array<{
      x: number; y: number; vx: number; vy: number
      color: string; size: number; rotation: number; rotationSpeed: number
      shape: 'rect' | 'circle'
    }> = []

    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2
      const velocity = Math.random() * 400 + 200
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 3,
        vx: Math.cos(angle) * velocity * (0.5 + Math.random()),
        vy: Math.sin(angle) * velocity * (0.5 + Math.random()) - 200,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      })
    }

    let startTime = performance.now()
    let animId: number

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000
      if (elapsed > 2.5) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        const x = p.x + p.vx * elapsed
        const y = p.y + p.vy * elapsed + 0.5 * 600 * elapsed * elapsed
        const opacity = Math.max(0, 1 - elapsed / 2.5)

        ctx.save()
        ctx.globalAlpha = opacity
        ctx.translate(x, y)
        ctx.rotate((p.rotation + p.rotationSpeed * elapsed * 60) * Math.PI / 180)
        ctx.fillStyle = p.color

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [type])

  if (type === 'correct') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Green radial pulse */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, rgba(34,197,94,0.3) 0%, transparent 70%)',
            animation: 'reactionPulse 0.8s ease-out',
          }}
        />
        {/* Floating sparkles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${20 + (i % 3) * 30}%`,
              top: `${15 + Math.floor(i / 3) * 50}%`,
              animation: `sparkleFloat 1.5s ease-out ${i * 0.1}s both`,
              opacity: 0,
            }}
          >
            ✨
          </div>
        ))}
      </div>
    )
  }

  if (type === 'incorrect') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Red pulse */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, rgba(239,68,68,0.25) 0%, transparent 70%)',
            animation: 'reactionPulse 0.6s ease-out',
          }}
        />
      </div>
    )
  }

  // Celebration
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  type,
  reactions,
  visible,
  children
}) => {
  // Pick a random reaction for this type (stable per render)
  const reaction = useMemo(() => {
    const list = reactions?.[type]
    if (!list?.length) return null
    return list[Math.floor(Math.random() * list.length)]
  }, [reactions, type])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      {/* Custom reaction video (when tenant has uploaded one) */}
      {reaction && (
        <video
          src={reaction.url}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-80"
          style={{ mixBlendMode: 'screen' }}
        />
      )}

      {/* Built-in animation (when no custom reaction exists) */}
      {!reaction && <BuiltInReaction type={type} />}

      {/* Feedback content on top */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Inject keyframe styles */}
      <style>{`
        @keyframes reactionPulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes sparkleFloat {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          30% { opacity: 1; transform: translateY(-20px) scale(1.2); }
          100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default ReactionOverlay

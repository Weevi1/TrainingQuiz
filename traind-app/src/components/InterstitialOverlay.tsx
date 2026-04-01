import React, { useEffect, useRef, useState, lazy, Suspense } from 'react'
import type { InterstitialConfig, MediaItem } from '../lib/firestore'
import { getBuiltInAnimation, getBuiltInAnimationUrl } from '../lib/builtInAnimations'
import { soundSystem } from '../lib/soundSystem'
import type { SoundType } from '../lib/soundSystem'

const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then(m => ({ default: m.DotLottieReact }))
)

interface InterstitialOverlayProps {
  config: InterstitialConfig
  onComplete: () => void
  customAnimations?: MediaItem[]
}

export const InterstitialOverlay: React.FC<InterstitialOverlayProps> = ({
  config,
  onComplete,
  customAnimations = []
}) => {
  const completedRef = useRef(false)

  // Slide mode — chapter break with title, body, optional image
  if (config.mode === 'slide') {
    return <SlideInterstitial config={config} onComplete={onComplete} completedRef={completedRef} />
  }

  // Legacy config detection: no animationId means v1 CSS-keyframe interstitial
  const isLegacy = !config.animationId

  if (isLegacy) {
    return <LegacyInterstitialOverlay config={config} onComplete={onComplete} />
  }

  if (config.animationType === 'builtin') {
    return <LottieInterstitial config={config} onComplete={onComplete} completedRef={completedRef} />
  }

  // Custom MP4
  const customItem = customAnimations.find(a => a.id === config.animationId)
  return (
    <CustomVideoInterstitial
      config={config}
      videoUrl={customItem?.url || ''}
      onComplete={onComplete}
      completedRef={completedRef}
    />
  )
}

// --- Built-in Lottie rendering ---

const LottieInterstitial: React.FC<{
  config: InterstitialConfig
  onComplete: () => void
  completedRef: React.MutableRefObject<boolean>
}> = ({ config, onComplete, completedRef }) => {
  const builtIn = getBuiltInAnimation(config.animationId)
  const duration = config.durationMs || builtIn?.defaultDurationMs || 3000
  const lottieUrl = getBuiltInAnimationUrl(config.animationId)

  useEffect(() => {
    // Play sound
    const sound = config.sound || builtIn?.defaultSound
    if (sound) {
      soundSystem.play(sound as SoundType)
    }

    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, duration)

    return () => clearTimeout(timer)
  }, [])

  return (
    <InterstitialShell duration={duration} text={config.text}>
      {lottieUrl && (
        <Suspense fallback={<div className="w-64 h-64" />}>
          <DotLottieReact
            src={lottieUrl}
            autoplay
            loop={false}
            style={{ width: 280, height: 280 }}
          />
        </Suspense>
      )}
    </InterstitialShell>
  )
}

// --- Custom MP4 video rendering ---

const CustomVideoInterstitial: React.FC<{
  config: InterstitialConfig
  videoUrl: string
  onComplete: () => void
  completedRef: React.MutableRefObject<boolean>
}> = ({ config, videoUrl, onComplete, completedRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasAudio, setHasAudio] = useState(false)
  const duration = config.durationMs || 5000

  useEffect(() => {
    // Check if video has audio tracks once metadata loads
    const video = videoRef.current
    if (video) {
      const handleLoaded = () => {
        // HTMLVideoElement doesn't expose audioTracks in all browsers
        // If no audio detected and a sound is configured, play the sound
        const audioTracksAvailable = (video as any).audioTracks?.length > 0
        setHasAudio(audioTracksAvailable)
        if (!audioTracksAvailable && config.sound) {
          soundSystem.play(config.sound as SoundType)
        }
      }
      video.addEventListener('loadedmetadata', handleLoaded)
      return () => video.removeEventListener('loadedmetadata', handleLoaded)
    }
  }, [])

  useEffect(() => {
    // Play configured sound if video has no audio
    if (!hasAudio && config.sound) {
      soundSystem.play(config.sound as SoundType)
    }

    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, duration)

    return () => clearTimeout(timer)
  }, [])

  return (
    <InterstitialShell duration={duration} text={config.text}>
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          playsInline
          muted={false}
          className="max-w-[80vw] max-h-[60vh] rounded-2xl shadow-2xl"
          style={{ objectFit: 'contain' }}
          onEnded={() => {
            if (!completedRef.current) {
              completedRef.current = true
              onComplete()
            }
          }}
        />
      ) : (
        <div className="w-64 h-64 flex items-center justify-center text-white/50 text-sm">
          Animation not found
        </div>
      )}
    </InterstitialShell>
  )
}

// --- Slide interstitial (chapter break) ---

/** Detect if a URL points to a video (MP4/WebM) vs image */
const isVideoUrl = (url: string): boolean => /\.(mp4|webm|mov)(\?|$)/i.test(url)

const SlideInterstitial: React.FC<{
  config: InterstitialConfig
  onComplete: () => void
  completedRef: React.MutableRefObject<boolean>
}> = ({ config, onComplete, completedRef }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoAdvance = config.slideAutoAdvance
  const duration = config.slideAutoAdvanceMs || 5000
  const hasMedia = !!config.slideImage
  const hasText = !!(config.slideTitle || config.slideBody)

  // Play audio layer when slide mounts
  useEffect(() => {
    if (!config.slideAudio) return
    const audio = new Audio(config.slideAudio)
    audioRef.current = audio
    audio.play().catch(() => {})
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!autoAdvance) return
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, duration)
    return () => clearTimeout(timer)
  }, [])

  const handleTap = () => {
    if (!completedRef.current) {
      completedRef.current = true
      // Stop audio on dismiss
      if (audioRef.current) {
        audioRef.current.pause()
      }
      onComplete()
    }
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50 cursor-pointer"
      style={{ background: 'rgba(0, 0, 0, 0.92)' }}
      onClick={handleTap}
    >
      {/* Media area — up to 80vh when present */}
      {hasMedia && (
        <div
          className="flex items-center justify-center"
          style={{
            maxHeight: hasText ? '65vh' : '80vh',
            maxWidth: '90vw',
            animation: 'interstitial-fade-up 0.5s ease-out both'
          }}
        >
          {isVideoUrl(config.slideImage!) ? (
            <video
              src={config.slideImage}
              autoPlay
              muted={!!config.slideAudio}
              playsInline
              loop
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            />
          ) : (
            <img
              src={config.slideImage}
              alt=""
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            />
          )}
        </div>
      )}

      {/* Text area — below media or centered when no media */}
      <div className={`text-center relative z-10 px-8 max-w-2xl flex flex-col items-center ${hasMedia && hasText ? 'mt-4' : ''}`}>
        {config.slideTitle && (
          <h1
            className={`font-bold text-white leading-tight ${hasMedia ? 'text-2xl md:text-3xl mb-2' : 'text-3xl md:text-5xl mb-4'}`}
            style={{
              textShadow: '0 2px 20px rgba(0,0,0,0.3)',
              animation: 'interstitial-fade-up 0.6s ease-out 0.1s both'
            }}
          >
            {config.slideTitle}
          </h1>
        )}

        {config.slideBody && (
          <p
            className={`text-white/80 leading-relaxed ${hasMedia ? 'text-base md:text-lg' : 'text-lg md:text-xl'}`}
            style={{ animation: 'interstitial-fade-up 0.6s ease-out 0.2s both' }}
          >
            {config.slideBody}
          </p>
        )}
      </div>

      {/* Footer: progress bar or tap prompt — pinned to bottom */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center" style={{ animation: 'interstitial-fade-up 0.6s ease-out 0.3s both' }}>
        {autoAdvance ? (
          <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/70 rounded-full"
              style={{ animation: `interstitial-progress ${duration}ms linear forwards` }}
            />
          </div>
        ) : (
          <p className="text-sm text-white/40">Tap anywhere to continue</p>
        )}
      </div>

      <style>{`
        @keyframes interstitial-fade-up {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes interstitial-progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}

// --- Shared shell (backdrop + text + progress bar) ---

const InterstitialShell: React.FC<{
  duration: number
  text?: string
  children: React.ReactNode
}> = ({ duration, text, children }) => (
  <div
    className="fixed inset-0 flex items-center justify-center z-50"
    style={{ background: 'rgba(0, 0, 0, 0.85)' }}
  >
    <div className="text-center relative z-10 px-6 max-w-lg flex flex-col items-center">
      {/* Animation area */}
      <div className="mb-4">
        {children}
      </div>

      {/* Optional text overlay */}
      {text && (
        <h1
          className="text-3xl md:text-5xl font-bold text-white leading-tight"
          style={{
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            animation: 'interstitial-fade-up 0.6s ease-out both'
          }}
        >
          {text}
        </h1>
      )}

      {/* Progress bar */}
      <div className="mt-8 w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/70 rounded-full"
          style={{
            animation: `interstitial-progress ${duration}ms linear forwards`
          }}
        />
      </div>
    </div>

    <style>{`
      @keyframes interstitial-fade-up {
        0% { transform: translateY(30px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      @keyframes interstitial-progress {
        0% { width: 0%; }
        100% { width: 100%; }
      }
    `}</style>
  </div>
)

// --- Legacy v1 CSS-keyframe fallback ---

const LegacyInterstitialOverlay: React.FC<{
  config: InterstitialConfig
  onComplete: () => void
}> = ({ config, onComplete }) => {
  const completedRef = useRef(false)
  const duration = config.durationMs || 2500

  useEffect(() => {
    if (config.sound) {
      soundSystem.play(config.sound as SoundType)
    }

    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, duration)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}
    >
      <div className="text-center relative z-10 px-6 max-w-lg">
        {config.emoji && (
          <div
            className="text-7xl md:text-8xl mb-6"
            style={{ animation: 'interstitial-bounce 0.6s ease-out forwards' }}
          >
            {config.emoji}
          </div>
        )}
        <h1
          className="text-3xl md:text-5xl font-bold text-white leading-tight"
          style={{
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
            animation: 'interstitial-bounce 0.6s ease-out 0.15s both'
          }}
        >
          {config.text}
        </h1>
        <div className="mt-8 mx-auto w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full"
            style={{ animation: `interstitial-progress ${duration}ms linear forwards` }}
          />
        </div>
      </div>

      <style>{`
        @keyframes interstitial-bounce {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes interstitial-progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}

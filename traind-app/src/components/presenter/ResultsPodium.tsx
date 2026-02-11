import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import type { AwardRecipient } from '../../lib/awardCalculator'

interface ResultsPodiumProps {
  topPerformers: AwardRecipient[]
  scoreFormatter: (value: number | string) => string
  animate?: boolean
}

interface PodiumBlockConfig {
  performer: AwardRecipient
  rank: number
  widthClass: string
  heightClass: string
  gradient: string
  glowShadow: string
  borderColor: string
  rankSize: string
  nameSize: string
  scoreSize: string
  delay: number // animation delay in ms
}

function getPodiumConfig(performer: AwardRecipient, rank: number): PodiumBlockConfig {
  switch (rank) {
    case 1:
      return {
        performer,
        rank: 1,
        widthClass: 'w-48 md:w-56',
        heightClass: 'h-44 md:h-52',
        gradient: 'linear-gradient(to top, var(--gold-color, #fbbf24), #fde68a)',
        glowShadow: '0 0 30px rgba(251, 191, 36, 0.3)',
        borderColor: '#fde68a',
        rankSize: 'text-4xl',
        nameSize: 'text-xl md:text-2xl',
        scoreSize: 'text-lg md:text-xl',
        delay: 800,
      }
    case 2:
      return {
        performer,
        rank: 2,
        widthClass: 'w-40 md:w-48',
        heightClass: 'h-32 md:h-40',
        gradient: 'linear-gradient(to top, var(--silver-color, #9ca3af), #d1d5db)',
        glowShadow: '0 0 20px rgba(156, 163, 175, 0.25)',
        borderColor: '#d1d5db',
        rankSize: 'text-3xl',
        nameSize: 'text-lg md:text-xl',
        scoreSize: 'text-base md:text-lg',
        delay: 400,
      }
    case 3:
    default:
      return {
        performer,
        rank: 3,
        widthClass: 'w-36 md:w-44',
        heightClass: 'h-24 md:h-32',
        gradient: 'linear-gradient(to top, var(--bronze-color, #d97706), #f59e0b)',
        glowShadow: '0 0 20px rgba(217, 119, 6, 0.25)',
        borderColor: '#f59e0b',
        rankSize: 'text-3xl',
        nameSize: 'text-base md:text-lg',
        scoreSize: 'text-sm md:text-base',
        delay: 0,
      }
  }
}

function PodiumBlock({
  config,
  scoreFormatter,
  visible,
  isSoloFirst,
}: {
  config: PodiumBlockConfig
  scoreFormatter: (value: number | string) => string
  visible: boolean
  isSoloFirst: boolean
}) {
  const { performer, rank, widthClass, heightClass, gradient, glowShadow, borderColor, rankSize, nameSize, scoreSize } = config

  return (
    <div
      className={`flex flex-col items-center ${isSoloFirst ? 'w-56 md:w-64' : widthClass}`}
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 500ms ease-out, opacity 500ms ease-out',
      }}
    >
      {/* Trophy icon above 1st place block */}
      {rank === 1 && (
        <div className="mb-3">
          <Trophy
            size={40}
            style={{ color: 'var(--gold-color, #fbbf24)' }}
            strokeWidth={2}
          />
        </div>
      )}

      {/* Podium block */}
      <div
        className={`${isSoloFirst ? 'w-full h-48 md:h-56' : `w-full ${heightClass}`} rounded-t-xl flex flex-col items-center justify-center`}
        style={{
          background: gradient,
          boxShadow: glowShadow,
          borderTop: `4px solid ${borderColor}`,
        }}
      >
        <span className={`${rankSize} font-bold text-white drop-shadow-md`}>
          {rank}
        </span>
      </div>

      {/* Name and score below block */}
      <div className="mt-3 text-center w-full px-1">
        <p
          className={`${nameSize} font-bold truncate`}
          style={{ color: 'var(--text-color)' }}
          title={performer.participantName}
        >
          {performer.participantName}
        </p>
        <p
          className={`${scoreSize} font-semibold mt-1`}
          style={{ color: 'var(--primary-color)' }}
        >
          {scoreFormatter(performer.value)}
        </p>
      </div>
    </div>
  )
}

export default function ResultsPodium({
  topPerformers,
  scoreFormatter,
  animate = true,
}: ResultsPodiumProps) {
  const [revealedRanks, setRevealedRanks] = useState<Set<number>>(
    animate ? new Set() : new Set([1, 2, 3])
  )

  useEffect(() => {
    if (!animate) {
      setRevealedRanks(new Set([1, 2, 3]))
      return
    }

    // 3rd place appears first, then 2nd, then 1st
    const timers: ReturnType<typeof setTimeout>[] = []

    // 3rd place: 0ms (immediate after mount)
    timers.push(
      setTimeout(() => {
        setRevealedRanks(prev => new Set([...prev, 3]))
      }, 100)
    )

    // 2nd place: 500ms later
    timers.push(
      setTimeout(() => {
        setRevealedRanks(prev => new Set([...prev, 2]))
      }, 500)
    )

    // 1st place: 900ms (400ms after 2nd)
    timers.push(
      setTimeout(() => {
        setRevealedRanks(prev => new Set([...prev, 1]))
      }, 900)
    )

    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [animate])

  if (topPerformers.length === 0) {
    return null
  }

  // Build ordered configs: always display as [2nd, 1st, 3rd] visually
  const first = topPerformers.find(p => p.rank === 1) || topPerformers[0]
  const second = topPerformers.find(p => p.rank === 2) || topPerformers[1]
  const third = topPerformers.find(p => p.rank === 3) || topPerformers[2]

  const firstConfig = getPodiumConfig(first, 1)
  const secondConfig = second ? getPodiumConfig(second, 2) : null
  const thirdConfig = third ? getPodiumConfig(third, 3) : null

  const isSoloFirst = topPerformers.length === 1

  return (
    <div className="w-full">
      <div
        className={`flex items-end gap-6 md:gap-10 ${
          isSoloFirst ? 'justify-center' : 'justify-center'
        }`}
      >
        {/* 2nd place (left) */}
        {secondConfig && (
          <PodiumBlock
            config={secondConfig}
            scoreFormatter={scoreFormatter}
            visible={revealedRanks.has(2)}
            isSoloFirst={false}
          />
        )}

        {/* 1st place (center) */}
        <PodiumBlock
          config={firstConfig}
          scoreFormatter={scoreFormatter}
          visible={revealedRanks.has(1)}
          isSoloFirst={isSoloFirst}
        />

        {/* 3rd place (right) */}
        {thirdConfig && (
          <PodiumBlock
            config={thirdConfig}
            scoreFormatter={scoreFormatter}
            visible={revealedRanks.has(3)}
            isSoloFirst={false}
          />
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Medal } from 'lucide-react'
import type { Award, AwardRecipient } from '../../lib/awardCalculator'

interface AwardsCeremonyProps {
  awards: Award[]
  animate?: boolean
  getAwardIcon: (iconType: string, size?: number) => React.ReactNode
}

/** How many recipients to show inline before collapsing to "+N more" */
const MAX_VISIBLE_RECIPIENTS = 3

/** Interval between sequential award reveals (ms) */
const REVEAL_INTERVAL = 1500

/** Duration for each award's entrance transition (ms) */
const ENTRANCE_DURATION = 500

function formatRecipients(recipients: AwardRecipient[]): {
  visible: AwardRecipient[]
  overflowCount: number
} {
  if (recipients.length <= MAX_VISIBLE_RECIPIENTS) {
    return { visible: recipients, overflowCount: 0 }
  }
  return {
    visible: recipients.slice(0, MAX_VISIBLE_RECIPIENTS),
    overflowCount: recipients.length - MAX_VISIBLE_RECIPIENTS,
  }
}

function AwardBanner({
  award,
  visible,
  getAwardIcon,
}: {
  award: Award
  visible: boolean
  getAwardIcon: AwardsCeremonyProps['getAwardIcon']
}) {
  const { visible: shownRecipients, overflowCount } = formatRecipients(award.recipients)
  const primaryRecipient = shownRecipients[0]

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-20px)',
        transition: `opacity ${ENTRANCE_DURATION}ms ease-out, transform ${ENTRANCE_DURATION}ms ease-out`,
        backgroundColor: 'var(--surface-color)',
        borderLeftColor: award.color,
      }}
      className="flex items-center p-5 md:p-6 rounded-xl shadow-sm border-l-4 relative overflow-hidden"
    >
      {/* Subtle gradient overlay from the award color */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to right, ${award.color}, transparent)`,
          opacity: 0.06,
        }}
      />

      {/* Icon circle */}
      <div
        className="relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: award.color, color: 'white' }}
      >
        {getAwardIcon(award.icon, 24)}
      </div>

      {/* Award info — middle section */}
      <div className="relative flex-1 min-w-0 ml-5">
        <h3
          className="text-xl font-bold truncate"
          style={{ color: 'var(--text-color)' }}
        >
          {award.name}
        </h3>
        <p
          className="text-lg truncate"
          style={{ color: 'var(--text-secondary-color)' }}
        >
          {award.description}
        </p>
      </div>

      {/* Recipients — right section */}
      <div className="relative flex-shrink-0 text-right ml-5 min-w-0 max-w-[40%]">
        {/* Primary recipient name */}
        <p
          className="text-xl font-bold truncate"
          style={{ color: award.color }}
          title={primaryRecipient.participantName}
        >
          {primaryRecipient.participantName}
        </p>

        {/* Additional recipients inline */}
        {shownRecipients.length > 1 && (
          <p
            className="text-lg truncate"
            style={{ color: award.color }}
            title={shownRecipients
              .slice(1)
              .map(r => r.participantName)
              .join(' \u2022 ')}
          >
            {shownRecipients
              .slice(1)
              .map(r => r.participantName)
              .join(' \u2022 ')}
          </p>
        )}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <p
            className="text-lg"
            style={{ color: 'var(--text-secondary-color)' }}
          >
            +{overflowCount} more
          </p>
        )}

        {/* Value */}
        <p
          className="text-lg font-medium mt-0.5"
          style={{ color: 'var(--text-secondary-color)' }}
        >
          {typeof primaryRecipient.value === 'number'
            ? primaryRecipient.value.toLocaleString()
            : primaryRecipient.value}
        </p>
      </div>
    </div>
  )
}

export default function AwardsCeremony({
  awards,
  animate = true,
  getAwardIcon,
}: AwardsCeremonyProps) {
  const [revealedCount, setRevealedCount] = useState(animate ? 0 : awards.length)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Cleanup any existing timers
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []

    if (!animate || awards.length === 0) {
      setRevealedCount(awards.length)
      return
    }

    // Reset for fresh animation run
    setRevealedCount(0)

    // Schedule sequential reveals
    for (let i = 0; i < awards.length; i++) {
      const timer = setTimeout(() => {
        setRevealedCount(i + 1)
      }, (i + 1) * REVEAL_INTERVAL)
      timersRef.current.push(timer)
    }

    return () => {
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current = []
    }
  }, [animate, awards.length])

  if (awards.length === 0) {
    return null
  }

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center mb-6">
        <Medal size={24} style={{ color: 'var(--text-color)' }} />
        <h2
          className="text-2xl font-bold ml-3"
          style={{ color: 'var(--text-color)' }}
        >
          Session Awards
        </h2>
      </div>

      {/* Award banners */}
      <div className="space-y-4">
        {awards.map((award, index) => (
          <AwardBanner
            key={award.id}
            award={award}
            visible={index < revealedCount}
            getAwardIcon={getAwardIcon}
          />
        ))}
      </div>
    </div>
  )
}

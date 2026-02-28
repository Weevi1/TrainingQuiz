import React from 'react'

interface PresenterStatsProps {
  stats: {
    totalParticipants: number
    averageScore: number
    completionRate: number
    averageTime: number
    completedCount: number
  }
  isBingoSession: boolean
  bingoWinners?: number
  scoreFormatter: (value: number | string) => string
  timeFormatter: (seconds: number) => string
  animate?: boolean
}

interface StatBoxConfig {
  value: string
  label: string
  color: string
}

function buildStatBoxes(
  stats: PresenterStatsProps['stats'],
  isBingoSession: boolean,
  bingoWinners: number,
  scoreFormatter: (value: number | string) => string,
  timeFormatter: (seconds: number) => string
): StatBoxConfig[] {
  const boxes: StatBoxConfig[] = [
    {
      value: String(stats.totalParticipants),
      label: 'Participants',
      color: 'var(--primary-color)',
    },
    {
      value: scoreFormatter(stats.averageScore),
      label: 'Avg Score',
      color: 'var(--success-color)',
    },
  ]

  if (isBingoSession) {
    boxes.push({
      value: String(bingoWinners),
      label: 'BINGOs',
      color: 'var(--gold-color, #fbbf24)',
    })
  } else {
    boxes.push({
      value: `${stats.completionRate}%`,
      label: 'Completion',
      color: 'var(--info-color, #2563eb)',
    })
  }

  boxes.push({
    value: timeFormatter(stats.averageTime),
    label: isBingoSession ? 'Avg Time' : 'Avg Response',
    color: 'var(--accent-color, #9333ea)',
  })

  return boxes
}

export const PresenterStats: React.FC<PresenterStatsProps> = ({
  stats,
  isBingoSession,
  bingoWinners = 0,
  scoreFormatter,
  timeFormatter,
}) => {
  const boxes = buildStatBoxes(stats, isBingoSession, bingoWinners, scoreFormatter, timeFormatter)

  return (
    <div
      className="rounded-xl p-5 mt-4"
      style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
    >
      <div className="grid grid-cols-4 gap-4">
        {boxes.map((box) => (
          <div key={box.label} className="text-center">
            <div
              className="text-4xl font-bold"
              style={{ color: box.color }}
            >
              {box.value}
            </div>
            <div
              className="text-lg"
              style={{ color: 'var(--text-secondary-color)' }}
            >
              {box.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PresenterStats

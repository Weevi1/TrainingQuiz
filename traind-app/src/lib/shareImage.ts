// Social share image generation using html2canvas
import html2canvas from 'html2canvas'

interface ShareImageData {
  participantName: string
  quizTitle: string
  percentage: number
  correctAnswers: number
  totalQuestions: number
  passed: boolean
  achievements?: Array<{ emoji: string; name: string }>
  organizationName?: string
  organizationLogo?: string
  gameType?: 'quiz' | 'bingo'
  // Bingo-specific
  cellsMarked?: number
  totalCells?: number
}

// Create a temporary DOM element for the share card
const createShareCardElement = (data: ShareImageData): HTMLElement => {
  const card = document.createElement('div')
  card.style.cssText = `
    width: 600px;
    height: 400px;
    padding: 40px;
    background: linear-gradient(135deg, #1e3a8a, #3b82f6, #1e40af);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    position: fixed;
    left: -9999px;
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  `

  // Performance color based on score
  const performanceColor = data.percentage >= 80 ? '#22c55e' :
    data.percentage >= 60 ? '#f59e0b' : '#ef4444'

  // Generate achievement badges HTML
  const achievementBadges = data.achievements && data.achievements.length > 0
    ? data.achievements.slice(0, 3).map(a =>
        `<span style="background: rgba(251, 191, 36, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 14px; margin-right: 8px;">${a.emoji} ${a.name}</span>`
      ).join('')
    : ''

  const isBingo = data.gameType === 'bingo'
  const headerLabel = isBingo ? 'Bingo Results' : 'Quiz Results'
  const subDetail = isBingo
    ? `${data.cellsMarked ?? data.correctAnswers}/${data.totalCells ?? data.totalQuestions} cells marked`
    : `${data.correctAnswers}/${data.totalQuestions}`
  const statusText = isBingo
    ? (data.passed ? '🎯 BINGO!' : '📋 Completed')
    : (data.passed ? '✅ Passed' : '📚 Completed')

  card.innerHTML = `
    <div>
      <!-- Header with title -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 14px; opacity: 0.8; margin-bottom: 4px;">${headerLabel}</div>
        <div style="font-size: 24px; font-weight: bold;">${data.quizTitle}</div>
      </div>

      <!-- Score circle -->
      <div style="display: flex; align-items: center; gap: 30px; margin-bottom: 20px;">
        <div style="
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${performanceColor}, ${performanceColor}88);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 4px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        ">
          <div style="font-size: 40px; font-weight: bold;">${data.percentage}%</div>
          <div style="font-size: 12px; opacity: 0.9;">${subDetail}</div>
        </div>

        <div>
          <div style="font-size: 28px; font-weight: bold; margin-bottom: 4px;">${data.participantName}</div>
          <div style="font-size: 16px; opacity: 0.9;">
            ${statusText}
          </div>
        </div>
      </div>

      <!-- Achievements -->
      ${achievementBadges ? `
        <div style="margin-bottom: 20px;">
          ${achievementBadges}
        </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="display: flex; justify-content: space-between; align-items: center; opacity: 0.7; font-size: 12px;">
      <div>${data.organizationName || 'Trained Platform'}</div>
      <div>trained.fifo.systems</div>
    </div>
  `

  return card
}

// Generate share image from data
export const generateShareImage = async (data: ShareImageData): Promise<Blob> => {
  const card = createShareCardElement(data)
  document.body.appendChild(card)

  try {
    const canvas = await html2canvas(card, {
      scale: 2, // Higher resolution
      backgroundColor: null,
      logging: false,
      useCORS: true
    })

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to generate image'))
        }
      }, 'image/png', 1.0)
    })
  } finally {
    document.body.removeChild(card)
  }
}

// Share image using Web Share API or download as fallback
export const shareResultsImage = async (data: ShareImageData): Promise<void> => {
  try {
    const blob = await generateShareImage(data)
    const isBingo = data.gameType === 'bingo'
    const fileLabel = isBingo ? 'bingo-results' : 'quiz-results'
    const file = new File([blob], `${fileLabel}.png`, { type: 'image/png' })

    // Try Web Share API first (works on mobile)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      const shareTitle = isBingo
        ? `${data.participantName}'s Bingo Results`
        : `${data.participantName}'s Quiz Results`
      const shareText = isBingo
        ? `I scored ${data.percentage}% on ${data.quizTitle}! ${data.passed ? '🎯 BINGO!' : ''}`
        : `I scored ${data.percentage}% on ${data.quizTitle}! ${data.passed ? '✅ Passed!' : ''}`
      await navigator.share({
        title: shareTitle,
        text: shareText,
        files: [file]
      })
    } else {
      // Fallback: Download the image
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const downloadLabel = isBingo ? 'Bingo_Results' : 'Quiz_Results'
      link.download = `${data.participantName.replace(/\s+/g, '_')}_${downloadLabel}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Show a message that the image was downloaded
      console.log('Image downloaded - share it on your favorite platform!')
    }
  } catch (error) {
    console.error('Error generating share image:', error)
    throw error
  }
}

// Download image without trying to share
export const downloadShareImage = async (data: ShareImageData): Promise<void> => {
  try {
    const blob = await generateShareImage(data)
    const url = URL.createObjectURL(blob)

    const downloadLabel = data.gameType === 'bingo' ? 'Bingo_Results' : 'Quiz_Results'
    const link = document.createElement('a')
    link.href = url
    link.download = `${data.participantName.replace(/\s+/g, '_')}_${downloadLabel}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading share image:', error)
    throw error
  }
}

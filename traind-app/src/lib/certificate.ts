// Certificate PDF generation for quiz completion
import jsPDF from 'jspdf'

interface CertificateData {
  participantName: string
  quizTitle: string
  score: number
  percentage: number
  passed: boolean
  passingScore: number
  totalQuestions: number
  correctAnswers: number
  completionDate: Date
  organizationName?: string
  organizationLogo?: string // base64 or URL
  achievements?: string[]
  gameType?: 'quiz' | 'bingo'
  // Bingo-specific fields
  cellsMarked?: number
  totalCells?: number
}

// Format date in a readable format
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const generateCertificate = async (data: CertificateData): Promise<Blob> => {
  // Create landscape A4 PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Background gradient effect (using rectangles)
  doc.setFillColor(15, 23, 42) // Dark blue
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // Decorative border
  doc.setDrawColor(59, 130, 246) // Blue
  doc.setLineWidth(2)
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20)

  // Inner decorative border
  doc.setDrawColor(147, 197, 253) // Light blue
  doc.setLineWidth(0.5)
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30)

  // Corner decorations
  const cornerSize = 20
  doc.setDrawColor(251, 191, 36) // Gold
  doc.setLineWidth(1.5)

  // Top-left corner
  doc.line(15, 15, 15 + cornerSize, 15)
  doc.line(15, 15, 15, 15 + cornerSize)

  // Top-right corner
  doc.line(pageWidth - 15, 15, pageWidth - 15 - cornerSize, 15)
  doc.line(pageWidth - 15, 15, pageWidth - 15, 15 + cornerSize)

  // Bottom-left corner
  doc.line(15, pageHeight - 15, 15 + cornerSize, pageHeight - 15)
  doc.line(15, pageHeight - 15, 15, pageHeight - 15 - cornerSize)

  // Bottom-right corner
  doc.line(pageWidth - 15, pageHeight - 15, pageWidth - 15 - cornerSize, pageHeight - 15)
  doc.line(pageWidth - 15, pageHeight - 15, pageWidth - 15, pageHeight - 15 - cornerSize)

  // Title - "Certificate of Completion" or "Certificate of Achievement"
  const titleText = data.passed ? 'Certificate of Achievement' : 'Certificate of Completion'
  doc.setTextColor(251, 191, 36) // Gold
  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.text(titleText, pageWidth / 2, 45, { align: 'center' })

  // Decorative line under title
  doc.setDrawColor(251, 191, 36)
  doc.setLineWidth(1)
  doc.line(pageWidth / 2 - 60, 52, pageWidth / 2 + 60, 52)

  // "This is to certify that"
  doc.setTextColor(255, 255, 255) // White
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', pageWidth / 2, 68, { align: 'center' })

  // Participant Name
  doc.setTextColor(59, 130, 246) // Blue
  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.text(data.participantName, pageWidth / 2, 85, { align: 'center' })

  // "has successfully completed"
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(data.passed ? 'has successfully passed' : 'has completed', pageWidth / 2, 100, { align: 'center' })

  // Quiz Title
  doc.setTextColor(147, 197, 253) // Light blue
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(data.quizTitle, pageWidth / 2, 115, { align: 'center' })

  // Score information
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')

  const isBingo = data.gameType === 'bingo'
  const scoreText = isBingo
    ? `Score: ${data.score} points | ${data.cellsMarked ?? data.correctAnswers}/${data.totalCells ?? data.totalQuestions} cells marked`
    : `Score: ${data.percentage}% (${data.correctAnswers}/${data.totalQuestions} correct)`
  doc.text(scoreText, pageWidth / 2, 130, { align: 'center' })

  // Pass/Fail status with color
  if (data.passed) {
    doc.setTextColor(34, 197, 94) // Green
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(isBingo ? 'BINGO ACHIEVED' : 'PASSED', pageWidth / 2, 142, { align: 'center' })
  }

  // Achievements (if any)
  if (data.achievements && data.achievements.length > 0) {
    doc.setTextColor(251, 191, 36) // Gold
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const achievementsText = `Achievements: ${data.achievements.join(' | ')}`
    doc.text(achievementsText, pageWidth / 2, 155, { align: 'center' })
  }

  // Date of completion
  doc.setTextColor(156, 163, 175) // Gray
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Completed on ${formatDate(data.completionDate)}`, pageWidth / 2, 168, { align: 'center' })

  // Organization name (if provided)
  if (data.organizationName) {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Issued by: ${data.organizationName}`, pageWidth / 2, 180, { align: 'center' })
  }

  // Footer - verification line
  doc.setTextColor(100, 116, 139) // Slate
  doc.setFontSize(8)
  doc.text(
    `Certificate ID: ${generateCertificateId(data)} | Generated by Trained Platform`,
    pageWidth / 2,
    pageHeight - 20,
    { align: 'center' }
  )

  // Return as Blob
  return doc.output('blob')
}

// Generate a unique certificate ID based on data
const generateCertificateId = (data: CertificateData): string => {
  const timestamp = data.completionDate.getTime()
  const nameHash = data.participantName.split('').reduce((a, b) => {
    const charCode = b.charCodeAt(0)
    return ((a << 5) - a) + charCode
  }, 0)
  return `CERT-${Math.abs(nameHash).toString(36).toUpperCase()}-${timestamp.toString(36).toUpperCase().slice(-6)}`
}

// Download the certificate
export const downloadCertificate = async (data: CertificateData, filename?: string): Promise<void> => {
  const blob = await generateCertificate(data)
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || `${data.participantName.replace(/\s+/g, '_')}_Certificate.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

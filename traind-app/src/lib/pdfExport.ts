// PDF Export utility for session results
// Generates professional training reports with participant analysis

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Participant, Quiz, GameSession } from './firestore'
import type { AwardResults } from './awardCalculator'

interface ParticipantWithAnalysis {
  id: string
  name: string
  score: number
  correctAnswers: number
  totalQuestions: number
  wrongAnswers: WrongAnswer[]
  avgResponseTime: number
  bestStreak: number
}

interface WrongAnswer {
  questionIndex: number
  questionText: string
  selectedAnswer: string
  correctAnswer: string
}

interface SessionStats {
  totalParticipants: number
  completedCount: number
  averageScore: number
  completionRate: number
  highestScore: number
  lowestScore: number
}

// Color definitions for PDF
const DEFAULT_COLORS = {
  primary: [59, 130, 246] as const,      // Blue
  primaryDark: [37, 99, 235] as const,   // Darker blue for gradient
  secondary: [30, 64, 175] as const,     // Dark blue
  success: [16, 185, 129] as const,      // Green
  successDark: [5, 150, 105] as const,   // Darker green
  error: [239, 68, 68] as const,         // Red
  warning: [245, 158, 11] as const,      // Amber
  gold: [251, 191, 36] as const,         // Gold
  white: [255, 255, 255] as const,
  lightGray: [248, 249, 250] as const,
  mediumGray: [229, 231, 235] as const,
  darkGray: [75, 85, 99] as const,
  text: [31, 41, 55] as const,
  textLight: [107, 114, 128] as const,   // Lighter text for labels
  accentBg: [239, 246, 255] as const,    // Very light blue background
}

// Page layout constants
const PAGE = {
  marginLeft: 15,
  marginRight: 15,
  contentWidth: 180,  // 210 - 15 - 15
  contentLeft: 15,
  contentRight: 195,
  center: 105,
  sectionGap: 14,     // Consistent gap between sections
  maxY: 278,          // Usable height (297 - footer area ~19mm)
  newPageTopY: 15,    // Starting Y when adding a new page
}

/**
 * Ensures enough vertical space remains on the current page.
 * If `needed` mm won't fit below `yPos`, adds a new page and returns the top Y.
 */
function ensureSpace(pdf: jsPDF, yPos: number, needed: number): number {
  if (yPos + needed > PAGE.maxY) {
    pdf.addPage()
    return PAGE.newPageTopY
  }
  return yPos
}

export async function generateSessionPDF(
  session: GameSession,
  quiz: Quiz | null,
  participants: Participant[],
  awardResults: AwardResults,
  organizationName: string = 'Trained Platform'
): Promise<void> {
  const pdf = new jsPDF('portrait', 'mm', 'a4')
  const isBingo = session.gameType === 'bingo'

  // Process participants for detailed analysis
  const participantsWithAnalysis = isBingo
    ? processBingoParticipants(participants)
    : processParticipants(participants, quiz!)

  // Calculate session stats
  const stats = isBingo
    ? calculateBingoStats(participantsWithAnalysis)
    : calculateStats(participantsWithAnalysis)

  let yPos = 12

  // Header (always fits on first page)
  yPos = addHeader(pdf, organizationName, yPos)
  yPos += PAGE.sectionGap

  // Document Title
  yPos = addTitle(pdf, yPos, isBingo)
  yPos += PAGE.sectionGap

  // Session Information (needs ~36mm)
  yPos = ensureSpace(pdf, yPos, 36)
  yPos = isBingo
    ? addBingoSessionInfo(pdf, session, yPos)
    : addSessionInfo(pdf, session, quiz!, yPos)
  yPos += PAGE.sectionGap

  // Performance Summary (needs ~42mm)
  yPos = ensureSpace(pdf, yPos, 42)
  yPos = addPerformanceSummary(pdf, stats, yPos, isBingo)
  yPos += PAGE.sectionGap

  // Awards Section (if any)
  if (awardResults.awards.length > 0) {
    yPos = addAwardsSection(pdf, awardResults, yPos)
    yPos += PAGE.sectionGap
  }

  // Participant Results Table — needs at least header + 2 data rows (~40mm)
  yPos = ensureSpace(pdf, yPos, 40)
  yPos = isBingo
    ? addBingoParticipantTable(pdf, participantsWithAnalysis, yPos)
    : addParticipantTable(pdf, participantsWithAnalysis, yPos)

  if (!isBingo && quiz) {
    // Question analysis — start on new page for clean layout, or continue if space
    yPos += PAGE.sectionGap
    yPos = ensureSpace(pdf, yPos, 60)
    yPos = addQuestionAnalysis(pdf, participants, quiz, yPos)
  }

  // Add footer to all pages
  addFooter(pdf, session)

  // Save PDF
  const fileName = isBingo
    ? generateBingoFileName(session)
    : generateFileName(session, quiz!)
  pdf.save(fileName)
}

export async function generateDetailedAnalysisPDF(
  session: GameSession,
  quiz: Quiz,
  participants: Participant[],
  organizationName: string = 'Trained Platform'
): Promise<void> {
  const pdf = new jsPDF('portrait', 'mm', 'a4')

  const participantsWithAnalysis = processParticipants(participants, quiz)

  let yPos = 12
  yPos = addHeader(pdf, organizationName, yPos)
  yPos += PAGE.sectionGap

  // Title
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DETAILED PARTICIPANT ANALYSIS', PAGE.center, yPos + 10, { align: 'center' })
  const titleWidth = pdf.getTextWidth('DETAILED PARTICIPANT ANALYSIS')
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(PAGE.center - titleWidth / 2, yPos + 13, titleWidth, 0.8, 'F')
  yPos += 18 + PAGE.sectionGap

  // Session context line
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  const sessionDate = formatDate(session.endTime || session.createdAt)
  pdf.text(`${quiz.title || session.title}  •  ${session.code}  •  ${sessionDate}`, PAGE.center, yPos, { align: 'center' })
  yPos += 10

  yPos = addDetailedAnalysis(pdf, participantsWithAnalysis, yPos)

  addFooter(pdf, session)

  const date = new Date().toISOString().split('T')[0]
  const title = (quiz.title || session.title || 'Training').replace(/[^a-zA-Z0-9]/g, '-')
  pdf.save(`Detailed-Analysis-${session.code}-${title}-${date}.pdf`)
}

function processParticipants(participants: Participant[], quiz: Quiz): ParticipantWithAnalysis[] {
  return participants
    .filter(p => p.gameState && p.gameState.answers && p.gameState.answers.length > 0)
    .map(p => {
      const answers = p.gameState!.answers
      const correctAnswers = answers.filter(a => a.isCorrect).length
      // Use totalQuestions from session-time gameState (not live quiz, which may have been edited since)
      const totalQuestions = p.gameState!.totalQuestions || quiz.questions.length

      // Calculate wrong answers with details
      const wrongAnswers: WrongAnswer[] = answers
        .filter(a => !a.isCorrect)
        .map((a, idx) => {
          const questionIndex = answers.indexOf(a)
          const question = quiz.questions.find(q => q.id === a.questionId) || quiz.questions[questionIndex]
          return {
            questionIndex: questionIndex + 1,
            questionText: question?.questionText || `Question ${questionIndex + 1}`,
            selectedAnswer: a.selectedAnswer >= 0 ? (question?.options?.[a.selectedAnswer] || 'No answer') : 'No answer',
            correctAnswer: question?.options?.[question?.correctAnswer] || 'N/A'
          }
        })

      // Calculate average response time
      const avgResponseTime = answers.length > 0
        ? answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length
        : 0

      // Calculate best streak
      let bestStreak = 0
      let currentStreak = 0
      for (const answer of answers) {
        if (answer.isCorrect) {
          currentStreak++
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }

      return {
        id: p.id,
        name: p.name,
        score: p.gameState!.score || p.finalScore || 0,
        correctAnswers,
        totalQuestions,
        wrongAnswers,
        avgResponseTime,
        bestStreak
      }
    })
    .sort((a, b) => b.score - a.score || a.avgResponseTime - b.avgResponseTime)
}

function processBingoParticipants(participants: Participant[]): ParticipantWithAnalysis[] {
  return participants
    .filter(p => p.gameState && p.gameState.gameType === 'bingo')
    .map(p => ({
      id: p.id,
      name: p.name,
      score: p.gameState!.score || p.finalScore || 0,
      correctAnswers: p.gameState!.cellsMarked || 0,
      totalQuestions: p.gameState!.totalCells || 25,
      wrongAnswers: [], // Bingo has no wrong answers
      avgResponseTime: p.gameState!.timeSpent || 0,
      bestStreak: p.gameState!.bestStreak || 0
    }))
    .sort((a, b) => b.score - a.score || a.avgResponseTime - b.avgResponseTime)
}

function calculateBingoStats(participants: ParticipantWithAnalysis[]): SessionStats {
  if (participants.length === 0) {
    return {
      totalParticipants: 0,
      completedCount: 0,
      averageScore: 0,
      completionRate: 0,
      highestScore: 0,
      lowestScore: 0
    }
  }

  const scores = participants.map(p =>
    p.totalQuestions > 0 ? Math.round((p.correctAnswers / p.totalQuestions) * 100) : 0
  )

  return {
    totalParticipants: participants.length,
    completedCount: participants.length,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    completionRate: 100,
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores)
  }
}

function calculateStats(participants: ParticipantWithAnalysis[]): SessionStats {
  if (participants.length === 0) {
    return {
      totalParticipants: 0,
      completedCount: 0,
      averageScore: 0,
      completionRate: 0,
      highestScore: 0,
      lowestScore: 0
    }
  }

  const scores = participants.map(p =>
    Math.round((p.correctAnswers / p.totalQuestions) * 100)
  )

  return {
    totalParticipants: participants.length,
    completedCount: participants.filter(p => p.correctAnswers >= 0).length,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    completionRate: 100, // All processed participants completed
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores)
  }
}

function addHeader(pdf: jsPDF, organizationName: string, yPos: number): number {
  const headerHeight = 30

  // Two-tone gradient header: darker top half, lighter bottom half
  pdf.setFillColor(...DEFAULT_COLORS.secondary)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, headerHeight / 2, 'F')
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(PAGE.contentLeft, yPos + headerHeight / 2, PAGE.contentWidth, headerHeight / 2, 'F')

  // Organization name — large, spaced
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(organizationName.toUpperCase(), 22, yPos + 13)

  // Subtitle
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Training Department', 22, yPos + 21)

  // Trained branding — right-aligned, vertically centered
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'italic')
  pdf.text('Powered by Trained', PAGE.contentRight - 5, yPos + 18, { align: 'right' })

  // Gold accent line under header
  pdf.setFillColor(...DEFAULT_COLORS.gold)
  pdf.rect(PAGE.contentLeft, yPos + headerHeight, PAGE.contentWidth, 1.5, 'F')

  return yPos + headerHeight + 2
}

function addTitle(pdf: jsPDF, yPos: number, isBingo: boolean = false): number {
  const titleText = isBingo ? 'BINGO SESSION REPORT' : 'TRAINING SESSION REPORT'

  // Title text
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text(titleText, PAGE.center, yPos + 10, { align: 'center' })

  // Subtle accent underline centered beneath title
  const titleWidth = pdf.getTextWidth(titleText)
  const lineX = PAGE.center - titleWidth / 2
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(lineX, yPos + 13, titleWidth, 0.8, 'F')

  return yPos + 18
}

function addSessionInfo(pdf: jsPDF, session: GameSession, quiz: Quiz, yPos: number): number {
  // Section background
  pdf.setFillColor(...DEFAULT_COLORS.accentBg)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 32, 'F')

  // Left accent bar
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(PAGE.contentLeft, yPos, 2.5, 32, 'F')

  // Section title
  pdf.setTextColor(...DEFAULT_COLORS.secondary)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SESSION DETAILS', 22, yPos + 8)

  // Thin separator line under title
  pdf.setDrawColor(...DEFAULT_COLORS.mediumGray)
  pdf.setLineWidth(0.2)
  pdf.line(22, yPos + 10.5, PAGE.contentRight - 5, yPos + 10.5)

  const sessionDate = formatDate(session.createdAt)
  const completedDate = session.endTime ? formatDate(session.endTime) : sessionDate

  // Two-column layout with bold labels
  const col1X = 22
  const col2X = 115
  const val1X = 48
  const val2X = 142

  pdf.setFontSize(9)

  // Row 1
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Quiz:', col1X, yPos + 18)
  pdf.text('Date:', col2X, yPos + 18)
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFont('helvetica', 'normal')
  pdf.text(quiz.title || session.title, val1X, yPos + 18)
  pdf.text(completedDate, val2X, yPos + 18)

  // Row 2
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Code:', col1X, yPos + 26)
  pdf.text('Questions:', col2X, yPos + 26)
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFont('helvetica', 'normal')
  pdf.text(session.code, val1X, yPos + 26)
  pdf.text(String(quiz.questions.length), val2X, yPos + 26)

  return yPos + 36
}

function addBingoSessionInfo(pdf: jsPDF, session: GameSession, yPos: number): number {
  // Section background
  pdf.setFillColor(...DEFAULT_COLORS.accentBg)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 32, 'F')

  // Left accent bar
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(PAGE.contentLeft, yPos, 2.5, 32, 'F')

  // Section title
  pdf.setTextColor(...DEFAULT_COLORS.secondary)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SESSION DETAILS', 22, yPos + 8)

  // Thin separator line under title
  pdf.setDrawColor(...DEFAULT_COLORS.mediumGray)
  pdf.setLineWidth(0.2)
  pdf.line(22, yPos + 10.5, PAGE.contentRight - 5, yPos + 10.5)

  const sessionDate = formatDate(session.createdAt)
  const completedDate = session.endTime ? formatDate(session.endTime) : sessionDate

  // Two-column layout with bold labels
  const col1X = 22
  const col2X = 115
  const val1X = 48
  const val2X = 142

  pdf.setFontSize(9)

  // Row 1
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Activity:', col1X, yPos + 18)
  pdf.text('Date:', col2X, yPos + 18)
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`${session.title} (Bingo)`, val1X, yPos + 18)
  pdf.text(completedDate, val2X, yPos + 18)

  // Row 2
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Code:', col1X, yPos + 26)
  pdf.text('Time Limit:', col2X, yPos + 26)
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFont('helvetica', 'normal')
  pdf.text(session.code, val1X, yPos + 26)
  pdf.text(`${Math.floor((session.settings?.timeLimit || 900) / 60)} minutes`, val2X, yPos + 26)

  return yPos + 36
}

function addPerformanceSummary(pdf: jsPDF, stats: SessionStats, yPos: number, isBingo: boolean = false): number {
  // Section background
  pdf.setFillColor(...DEFAULT_COLORS.accentBg)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 38, 'F')

  // Left accent bar
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(PAGE.contentLeft, yPos, 2.5, 38, 'F')

  // Section title
  pdf.setTextColor(...DEFAULT_COLORS.secondary)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PERFORMANCE SUMMARY', 22, yPos + 8)

  // Thin separator line under title
  pdf.setDrawColor(...DEFAULT_COLORS.mediumGray)
  pdf.setLineWidth(0.2)
  pdf.line(22, yPos + 10.5, PAGE.contentRight - 5, yPos + 10.5)

  // Stat cards in a 3-column layout — large value over small label
  const statCols = [
    { x: 35, value: String(stats.totalParticipants), label: 'Participants' },
    { x: 65, value: String(stats.completedCount), label: 'Completed' },
    { x: 100, value: `${stats.averageScore}%`, label: isBingo ? 'Avg Coverage' : 'Average Score' },
    { x: 135, value: `${stats.highestScore}%`, label: isBingo ? 'Best Coverage' : 'Highest Score' },
    { x: 170, value: `${stats.lowestScore}%`, label: isBingo ? 'Lowest Coverage' : 'Lowest Score' },
  ]

  for (const stat of statCols) {
    // Large value
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text(stat.value, stat.x, yPos + 24, { align: 'center' })

    // Small label below
    pdf.setTextColor(...DEFAULT_COLORS.textLight)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.text(stat.label, stat.x, yPos + 30, { align: 'center' })
  }

  // Completion rate as a subtle note
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'italic')
  pdf.text(`Completion Rate: ${stats.completionRate}%`, PAGE.contentRight - 5, yPos + 36, { align: 'right' })

  return yPos + 42
}

function addAwardsSection(pdf: jsPDF, awardResults: AwardResults, yPos: number): number {
  // Estimate height: header (13) + rows (each pair of awards = 1 row of ~16mm)
  const awardRows = Math.ceil(awardResults.awards.length / 2)
  const estimatedHeight = 13 + awardRows * 16 + 4
  yPos = ensureSpace(pdf, yPos, estimatedHeight)

  // Gold header bar
  pdf.setFillColor(...DEFAULT_COLORS.gold)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 9, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SESSION AWARDS', 22, yPos + 6.5)

  yPos += 13

  // Add awards in a 2-column grid
  let xPos = 22
  let rowY = yPos

  awardResults.awards.forEach((award) => {
    if (xPos > 120) {
      xPos = 22
      rowY += 16
    }

    // Check space for next row
    if (rowY + 14 > PAGE.maxY) {
      pdf.addPage()
      rowY = PAGE.newPageTopY
      xPos = 22
    }

    // Small gold bullet
    pdf.setFillColor(...DEFAULT_COLORS.gold)
    pdf.circle(xPos + 1, rowY - 1.2, 1.2, 'F')

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.text(award.name, xPos + 5, rowY)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...DEFAULT_COLORS.darkGray)
    pdf.text(award.recipients.map(r => r.participantName).join(', '), xPos + 5, rowY + 5)

    xPos += 90
  })

  return rowY + 14
}

function getScoreColor(percentage: number): readonly [number, number, number] {
  if (percentage >= 80) return DEFAULT_COLORS.successDark
  if (percentage >= 60) return DEFAULT_COLORS.warning
  return DEFAULT_COLORS.error
}

function addParticipantTable(pdf: jsPDF, participants: ParticipantWithAnalysis[], yPos: number): number {
  // Section header
  pdf.setFillColor(...DEFAULT_COLORS.secondary)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 9, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PARTICIPANT RESULTS', 22, yPos + 6.5)

  // Table data
  const tableData = participants.map((p, idx) => {
    const percentage = Math.round((p.correctAnswers / p.totalQuestions) * 100)
    return [
      `#${idx + 1}`,
      p.name,
      `${percentage}%`,
      `${p.correctAnswers}/${p.totalQuestions}`,
      p.bestStreak.toString(),
      `${p.avgResponseTime.toFixed(1)}s`
    ]
  })

  autoTable(pdf, {
    head: [['Rank', 'Participant', 'Score', 'Correct', 'Streak', 'Avg Time']],
    body: tableData,
    startY: yPos + 11,
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: {
      fillColor: [...DEFAULT_COLORS.secondary] as [number, number, number],
      textColor: [...DEFAULT_COLORS.white] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: [...DEFAULT_COLORS.text] as [number, number, number],
      lineColor: [...DEFAULT_COLORS.mediumGray] as [number, number, number],
      lineWidth: 0.2,
      minCellHeight: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18, fontStyle: 'bold', fontSize: 10 },
      1: { cellWidth: 57 },
      2: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 25 },
    },
    margin: { left: PAGE.contentLeft, right: PAGE.marginRight, bottom: 22 },
    alternateRowStyles: {
      fillColor: [...DEFAULT_COLORS.lightGray] as [number, number, number],
    },
    // Prevent orphaned header: ensure at least 2 body rows accompany the header on each page
    rowPageBreak: 'avoid',
    didParseCell: (data: any) => {
      // Color-code the score column
      if (data.section === 'body' && data.column.index === 2) {
        const percentage = parseInt(data.cell.raw as string)
        if (!isNaN(percentage)) {
          data.cell.styles.textColor = [...getScoreColor(percentage)]
        }
      }
      // Style the rank column
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = [...DEFAULT_COLORS.secondary]
      }
    },
  })

  return (pdf as any).lastAutoTable?.finalY || yPos + 50
}

function addBingoParticipantTable(pdf: jsPDF, participants: ParticipantWithAnalysis[], yPos: number): number {
  // Section header
  pdf.setFillColor(...DEFAULT_COLORS.secondary)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 9, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PARTICIPANT RESULTS', 22, yPos + 6.5)

  // Table data - adapted for bingo
  const tableData = participants.map((p, idx) => {
    const coverage = p.totalQuestions > 0
      ? Math.round((p.correctAnswers / p.totalQuestions) * 100)
      : 0
    return [
      `#${idx + 1}`,
      p.name,
      `${p.score}`,
      `${p.correctAnswers}/${p.totalQuestions}`,
      `${coverage}%`,
      p.bestStreak.toString()
    ]
  })

  autoTable(pdf, {
    head: [['Rank', 'Participant', 'Score', 'Cells Marked', 'Coverage', 'Streak']],
    body: tableData,
    startY: yPos + 11,
    showHead: 'everyPage',
    theme: 'grid',
    headStyles: {
      fillColor: [...DEFAULT_COLORS.secondary] as [number, number, number],
      textColor: [...DEFAULT_COLORS.white] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 4,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: [...DEFAULT_COLORS.text] as [number, number, number],
      lineColor: [...DEFAULT_COLORS.mediumGray] as [number, number, number],
      lineWidth: 0.2,
      minCellHeight: 8,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18, fontStyle: 'bold', fontSize: 10 },
      1: { cellWidth: 52 },
      2: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'center', cellWidth: 20 },
    },
    margin: { left: PAGE.contentLeft, right: PAGE.marginRight, bottom: 22 },
    alternateRowStyles: {
      fillColor: [...DEFAULT_COLORS.lightGray] as [number, number, number],
    },
    rowPageBreak: 'avoid',
    didParseCell: (data: any) => {
      // Style the rank column
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = [...DEFAULT_COLORS.secondary]
      }
      // Color-code the coverage column
      if (data.section === 'body' && data.column.index === 4) {
        const percentage = parseInt(data.cell.raw as string)
        if (!isNaN(percentage)) {
          data.cell.styles.textColor = [...getScoreColor(percentage)]
        }
      }
    },
  })

  return (pdf as any).lastAutoTable?.finalY || yPos + 50
}

function addQuestionAnalysis(pdf: jsPDF, participants: Participant[], quiz: Quiz, yPos: number): number {
  // Section header — full-width bar
  pdf.setFillColor(...DEFAULT_COLORS.secondary)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 13, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('QUESTION ANALYSIS', 22, yPos + 9)
  yPos += 18

  // Subtitle
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'italic')
  pdf.text('Correct answer rate per question — sorted weakest first to highlight areas needing reinforcement', 22, yPos)
  yPos += 10

  // Aggregate correct counts per question
  const questionStats: { questionText: string; questionIndex: number; correctCount: number; totalAttempts: number }[] = []

  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i]
    let correctCount = 0
    let totalAttempts = 0

    for (const p of participants) {
      if (!p.gameState?.answers) continue
      const answer = p.gameState.answers.find(a => a.questionId === q.id)
      if (answer) {
        totalAttempts++
        if (answer.isCorrect) correctCount++
      }
    }

    questionStats.push({
      questionText: q.questionText,
      questionIndex: i + 1,
      correctCount,
      totalAttempts,
    })
  }

  // Sort by correct rate ascending (weakest first)
  const sorted = [...questionStats].sort((a, b) => {
    const rateA = a.totalAttempts > 0 ? a.correctCount / a.totalAttempts : 0
    const rateB = b.totalAttempts > 0 ? b.correctCount / b.totalAttempts : 0
    return rateA - rateB
  })

  // Layout constants
  const barMaxWidth = 130   // Bar width (leaves room for percentage text on right)
  const barX = 25           // Left edge of bar (after Q number)
  const barHeight = 5       // Taller bar for better readability
  const statsX = barX + barMaxWidth + 3  // Percentage text right of bar

  for (const stat of sorted) {
    const rate = stat.totalAttempts > 0 ? stat.correctCount / stat.totalAttempts : 0
    const percentage = Math.round(rate * 100)
    const barColor = getScoreColor(percentage)

    // Calculate wrapped question text height
    pdf.setFontSize(8.5)
    pdf.setFont('helvetica', 'normal')
    const maxTextWidth = PAGE.contentWidth - 14  // Leave room for Q number
    const textLines = pdf.splitTextToSize(stat.questionText, maxTextWidth)
    const lineHeight = 3.8
    const textHeight = textLines.length * lineHeight

    // Total height for this question entry: text + gap + bar + bottom gap
    const entryHeight = textHeight + 4 + barHeight + 8

    // Page break check — keep question text and bar together
    yPos = ensureSpace(pdf, yPos, entryHeight)

    // Question number
    pdf.setTextColor(...DEFAULT_COLORS.secondary)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Q${stat.questionIndex}`, PAGE.contentLeft + 2, yPos + 3.5)

    // Question text (wrapped)
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(8.5)
    pdf.setFont('helvetica', 'normal')
    pdf.text(textLines, barX, yPos + 3.5)

    // Bar sits below the question text with a small gap
    const barY = yPos + textHeight + 3

    // Bar background (light gray track)
    pdf.setFillColor(...DEFAULT_COLORS.mediumGray)
    pdf.rect(barX, barY, barMaxWidth, barHeight, 'F')

    // Bar fill (colored by score)
    const barWidth = Math.max(rate * barMaxWidth, rate > 0 ? 2 : 0)
    pdf.setFillColor(...barColor)
    pdf.rect(barX, barY, barWidth, barHeight, 'F')

    // Percentage text right of bar — vertically centered with bar
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${percentage}%`, statsX, barY + barHeight - 0.8)

    // Fraction count below percentage
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...DEFAULT_COLORS.textLight)
    pdf.text(`${stat.correctCount}/${stat.totalAttempts}`, statsX + 14, barY + barHeight - 0.8)

    // Subtle separator line between questions
    yPos = barY + barHeight + 4
    pdf.setDrawColor(...DEFAULT_COLORS.mediumGray)
    pdf.setLineWidth(0.15)
    pdf.line(PAGE.contentLeft + 2, yPos, PAGE.contentRight - 2, yPos)
    yPos += 4
  }

  // Summary callout
  yPos += 2
  const weakQuestions = sorted.filter(s => s.totalAttempts > 0 && (s.correctCount / s.totalAttempts) < 0.5)

  if (weakQuestions.length > 0) {
    const boxHeight = 12 + weakQuestions.length * 5
    yPos = ensureSpace(pdf, yPos, boxHeight + 4)

    pdf.setFillColor(254, 243, 199)
    pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, boxHeight, 'F')
    pdf.setFillColor(...DEFAULT_COLORS.warning)
    pdf.rect(PAGE.contentLeft, yPos, 2.5, boxHeight, 'F')

    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Areas Needing Reinforcement', 22, yPos + 7)

    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...DEFAULT_COLORS.darkGray)
    let lineY = yPos + 13
    for (const wq of weakQuestions) {
      // Page break within callout if needed (many weak questions)
      if (lineY + 5 > PAGE.maxY) {
        pdf.addPage()
        lineY = PAGE.newPageTopY
      }
      const wqRate = Math.round((wq.correctCount / wq.totalAttempts) * 100)
      const truncText = wq.questionText.length > 90 ? wq.questionText.slice(0, 90) + '...' : wq.questionText
      pdf.text(`  Q${wq.questionIndex}: ${truncText} (${wqRate}%)`, 22, lineY)
      lineY += 5
    }

    yPos += boxHeight + 4
  } else {
    yPos = ensureSpace(pdf, yPos, 18)

    pdf.setFillColor(...DEFAULT_COLORS.accentBg)
    pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 14, 'F')
    pdf.setFillColor(...DEFAULT_COLORS.success)
    pdf.rect(PAGE.contentLeft, yPos, 2.5, 14, 'F')

    pdf.setTextColor(...DEFAULT_COLORS.successDark)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Strong Overall Understanding', 22, yPos + 6)
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text('All questions had a correct rate above 50%. No immediate reinforcement areas identified.', 22, yPos + 11)

    yPos += 18
  }

  return yPos
}

function addDetailedAnalysis(pdf: jsPDF, participants: ParticipantWithAnalysis[], yPos: number): number {
  // Section header — full-width bar
  pdf.setFillColor(...DEFAULT_COLORS.secondary)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 13, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DETAILED PARTICIPANT ANALYSIS', 22, yPos + 9)
  yPos += 20

  // Subtitle
  pdf.setTextColor(...DEFAULT_COLORS.textLight)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'italic')
  pdf.text('Areas Requiring Follow-up Training by Participant', 22, yPos)
  yPos += 12

  // Filter to participants with wrong answers
  const participantsWithErrors = participants.filter(p => p.wrongAnswers.length > 0)

  if (participantsWithErrors.length === 0) {
    // All perfect scores
    pdf.setFillColor(...DEFAULT_COLORS.accentBg)
    pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 22, 'F')
    // Left green accent
    pdf.setFillColor(...DEFAULT_COLORS.success)
    pdf.rect(PAGE.contentLeft, yPos, 2.5, 22, 'F')

    pdf.setTextColor(...DEFAULT_COLORS.successDark)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('EXCELLENT PERFORMANCE', 22, yPos + 9)
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text('All participants achieved perfect or near-perfect scores.', 22, yPos + 16)
    return yPos + 28
  }

  // Process each participant with errors
  for (const participant of participantsWithErrors) {
    // Participant header bar (10mm) + at least one wrong-answer box (~32mm) + spacing
    const minFirstBlock = 10 + 15 + 32
    yPos = ensureSpace(pdf, yPos, minFirstBlock)

    // Participant header bar
    const percentage = Math.round((participant.correctAnswers / participant.totalQuestions) * 100)
    pdf.setFillColor(...DEFAULT_COLORS.gold)
    pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 10, 'F')
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(participant.name, 22, yPos + 7)

    // Score and error count right-aligned
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...DEFAULT_COLORS.darkGray)
    pdf.text(
      `Score: ${percentage}%  |  ${participant.wrongAnswers.length} incorrect`,
      PAGE.contentRight - 5,
      yPos + 7,
      { align: 'right' }
    )
    yPos += 15

    // Wrong answers
    for (const wrongAnswer of participant.wrongAnswers) {
      // Calculate box height based on content
      const questionLines = pdf.splitTextToSize(wrongAnswer.questionText, 145)
      const boxHeight = Math.max(26, 12 + questionLines.length * 4 + 14)
      const continuedLabelHeight = 10

      // Check if box fits; if not, add page with "continued" label
      if (yPos + boxHeight + 6 > PAGE.maxY) {
        pdf.addPage()
        yPos = PAGE.newPageTopY
        pdf.setTextColor(...DEFAULT_COLORS.darkGray)
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'italic')
        pdf.text(`${participant.name} (continued)`, 22, yPos)
        yPos += continuedLabelHeight
      }

      // Question box — light background with thick left accent border
      pdf.setFillColor(...DEFAULT_COLORS.lightGray)
      pdf.rect(22, yPos, 168, boxHeight, 'F')
      pdf.setFillColor(...DEFAULT_COLORS.gold)
      pdf.rect(22, yPos, 2.5, boxHeight, 'F')

      // Question number badge
      pdf.setTextColor(...DEFAULT_COLORS.secondary)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Q${wrongAnswer.questionIndex}`, 28, yPos + 6)

      // Question text
      pdf.setTextColor(...DEFAULT_COLORS.text)
      pdf.setFont('helvetica', 'normal')
      pdf.text(questionLines, 38, yPos + 6)

      // Answer section — indented, with clear visual separation
      const answerY = yPos + 10 + questionLines.length * 3.5

      // Thin separator line
      pdf.setDrawColor(...DEFAULT_COLORS.mediumGray)
      pdf.setLineWidth(0.15)
      pdf.line(28, answerY - 2, 185, answerY - 2)

      // Correct answer (green)
      pdf.setFillColor(220, 252, 231)
      pdf.rect(28, answerY - 0.5, 157, 5.5, 'F')
      pdf.setTextColor(5, 150, 105)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('CORRECT', 30, answerY + 3.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(wrongAnswer.correctAnswer, 52, answerY + 3.5)

      // Given answer (red)
      pdf.setFillColor(254, 226, 226)
      pdf.rect(28, answerY + 5.5, 157, 5.5, 'F')
      pdf.setTextColor(220, 38, 38)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('GIVEN', 30, answerY + 9.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(wrongAnswer.selectedAnswer, 52, answerY + 9.5)

      yPos += boxHeight + 6
    }

    yPos += 10 // More space between participants
  }

  // Follow-up summary — header (9mm) + intro line (8mm) + at least a few entries
  const summaryHeaderHeight = 9 + 14 + 8 + 6
  yPos = ensureSpace(pdf, yPos, summaryHeaderHeight)

  // Summary header
  pdf.setFillColor(...DEFAULT_COLORS.secondary)
  pdf.rect(PAGE.contentLeft, yPos, PAGE.contentWidth, 9, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('FOLLOW-UP SUMMARY', 22, yPos + 6.5)
  yPos += 14

  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`${participantsWithErrors.length} participant${participantsWithErrors.length === 1 ? '' : 's'} require follow-up training:`, 22, yPos)
  yPos += 8

  // List participants needing help
  participantsWithErrors
    .sort((a, b) => b.wrongAnswers.length - a.wrongAnswers.length)
    .forEach(p => {
      const percentage = Math.round((p.wrongAnswers.length / p.totalQuestions) * 100)

      // Each bullet line needs ~6mm
      yPos = ensureSpace(pdf, yPos, 6)

      // Small bullet
      pdf.setFillColor(...DEFAULT_COLORS.primary)
      pdf.circle(25, yPos - 1.2, 1, 'F')

      pdf.setTextColor(...DEFAULT_COLORS.text)
      pdf.setFont('helvetica', 'bold')
      pdf.text(p.name, 29, yPos)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...DEFAULT_COLORS.darkGray)
      pdf.text(` — ${p.wrongAnswers.length} questions incorrect (${percentage}% error rate)`, 29 + pdf.getTextWidth(p.name), yPos)
      yPos += 6
    })

  return yPos
}

function addFooter(pdf: jsPDF, session: GameSession): void {
  const pageHeight = pdf.internal.pageSize.height
  const totalPages = pdf.internal.getNumberOfPages()

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)

    const footerY = pageHeight - 12

    // Thin top border line
    pdf.setDrawColor(...DEFAULT_COLORS.mediumGray)
    pdf.setLineWidth(0.3)
    pdf.line(PAGE.contentLeft, footerY - 3, PAGE.contentRight, footerY - 3)

    // Footer content — light and understated
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')

    // Left - generation date
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    const timeStr = now.toLocaleTimeString('en-ZA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
    pdf.setTextColor(...DEFAULT_COLORS.textLight)
    pdf.text(`Generated: ${dateStr} at ${timeStr}`, PAGE.contentLeft, footerY)

    // Center - page number
    pdf.setTextColor(...DEFAULT_COLORS.darkGray)
    pdf.text(`Page ${i} of ${totalPages}`, PAGE.center, footerY, { align: 'center' })

    // Right - branding
    pdf.setTextColor(...DEFAULT_COLORS.textLight)
    pdf.setFont('helvetica', 'italic')
    pdf.text('Powered by Trained', PAGE.contentRight, footerY, { align: 'right' })
  }
}

function formatDate(date: Date | undefined): string {
  if (!date) return 'N/A'
  try {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return 'Invalid date'
  }
}

function generateFileName(session: GameSession, quiz: Quiz): string {
  const date = new Date().toISOString().split('T')[0]
  const title = (quiz.title || session.title || 'Training').replace(/[^a-zA-Z0-9]/g, '-')
  return `Training-Report-${session.code}-${title}-${date}.pdf`
}

function generateBingoFileName(session: GameSession): string {
  const date = new Date().toISOString().split('T')[0]
  const title = (session.title || 'Bingo').replace(/[^a-zA-Z0-9]/g, '-')
  return `Bingo-Report-${session.code}-${title}-${date}.pdf`
}

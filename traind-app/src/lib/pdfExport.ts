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
  primary: [59, 130, 246],      // Blue
  secondary: [30, 64, 175],     // Dark blue
  success: [16, 185, 129],      // Green
  error: [239, 68, 68],         // Red
  gold: [251, 191, 36],         // Gold
  white: [255, 255, 255],
  lightGray: [248, 249, 250],
  mediumGray: [229, 231, 235],
  darkGray: [75, 85, 99],
  text: [31, 41, 55]
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

  let yPos = 15

  // Header
  yPos = addHeader(pdf, organizationName, yPos)
  yPos += 15

  // Document Title
  yPos = addTitle(pdf, yPos, isBingo)
  yPos += 10

  // Session Information
  yPos = isBingo
    ? addBingoSessionInfo(pdf, session, yPos)
    : addSessionInfo(pdf, session, quiz!, yPos)
  yPos += 10

  // Performance Summary
  yPos = addPerformanceSummary(pdf, stats, yPos, isBingo)
  yPos += 10

  // Awards Section (if any)
  if (awardResults.awards.length > 0) {
    yPos = addAwardsSection(pdf, awardResults, yPos)
    yPos += 10
  }

  // Participant Results Table
  yPos = isBingo
    ? addBingoParticipantTable(pdf, participantsWithAnalysis, yPos)
    : addParticipantTable(pdf, participantsWithAnalysis, yPos)

  if (!isBingo) {
    // New page for detailed analysis (quiz only - bingo has no wrong answers)
    pdf.addPage()
    yPos = 15
    yPos = addDetailedAnalysis(pdf, participantsWithAnalysis, yPos)
  }

  // Add footer to all pages
  addFooter(pdf, session)

  // Save PDF
  const fileName = isBingo
    ? generateBingoFileName(session)
    : generateFileName(session, quiz!)
  pdf.save(fileName)
}

function processParticipants(participants: Participant[], quiz: Quiz): ParticipantWithAnalysis[] {
  return participants
    .filter(p => p.gameState && p.gameState.answers && p.gameState.answers.length > 0)
    .map(p => {
      const answers = p.gameState!.answers
      const correctAnswers = answers.filter(a => a.isCorrect).length
      const totalQuestions = quiz.questions.length

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
    .sort((a, b) => b.score - a.score) // Sort by score descending
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
    .sort((a, b) => b.score - a.score)
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
  // Header background
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(15, yPos, 180, 25, 'F')

  // Organization name
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text(organizationName.toUpperCase(), 20, yPos + 12)

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Training Department', 20, yPos + 18)

  // Trained branding
  pdf.setFontSize(9)
  pdf.text('Powered by Trained', 175, yPos + 15, { align: 'right' })

  // Accent line
  pdf.setFillColor(...DEFAULT_COLORS.gold)
  pdf.rect(15, yPos + 25, 180, 2, 'F')

  return yPos + 30
}

function addTitle(pdf: jsPDF, yPos: number, isBingo: boolean = false): number {
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(isBingo ? 'BINGO SESSION REPORT' : 'TRAINING SESSION REPORT', 105, yPos + 10, { align: 'center' })

  return yPos + 18
}

function addSessionInfo(pdf: jsPDF, session: GameSession, quiz: Quiz, yPos: number): number {
  pdf.setFillColor(...DEFAULT_COLORS.lightGray)
  pdf.rect(15, yPos, 180, 25, 'F')

  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SESSION DETAILS', 20, yPos + 8)

  const sessionDate = formatDate(session.createdAt)
  const completedDate = session.endTime ? formatDate(session.endTime) : sessionDate

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Quiz: ${quiz.title || session.title}`, 20, yPos + 14)
  pdf.text(`Date: ${completedDate}`, 120, yPos + 14)
  pdf.text(`Session Code: ${session.code}`, 20, yPos + 20)
  pdf.text(`Questions: ${quiz.questions.length}`, 120, yPos + 20)

  return yPos + 30
}

function addBingoSessionInfo(pdf: jsPDF, session: GameSession, yPos: number): number {
  pdf.setFillColor(...DEFAULT_COLORS.lightGray)
  pdf.rect(15, yPos, 180, 25, 'F')

  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SESSION DETAILS', 20, yPos + 8)

  const sessionDate = formatDate(session.createdAt)
  const completedDate = session.endTime ? formatDate(session.endTime) : sessionDate

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Activity: ${session.title} (Bingo)`, 20, yPos + 14)
  pdf.text(`Date: ${completedDate}`, 120, yPos + 14)
  pdf.text(`Session Code: ${session.code}`, 20, yPos + 20)
  pdf.text(`Time Limit: ${Math.floor((session.settings?.timeLimit || 900) / 60)} minutes`, 120, yPos + 20)

  return yPos + 30
}

function addPerformanceSummary(pdf: jsPDF, stats: SessionStats, yPos: number, isBingo: boolean = false): number {
  pdf.setFillColor(...DEFAULT_COLORS.lightGray)
  pdf.rect(15, yPos, 180, 28, 'F')

  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PERFORMANCE SUMMARY', 20, yPos + 8)

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  // Row 1
  pdf.text(`Total Participants: ${stats.totalParticipants}`, 20, yPos + 16)
  pdf.text(`Completed: ${stats.completedCount}`, 85, yPos + 16)
  pdf.text(isBingo ? `Avg Coverage: ${stats.averageScore}%` : `Average Score: ${stats.averageScore}%`, 140, yPos + 16)

  // Row 2
  pdf.text(isBingo ? `Best Coverage: ${stats.highestScore}%` : `Highest Score: ${stats.highestScore}%`, 20, yPos + 23)
  pdf.text(isBingo ? `Lowest Coverage: ${stats.lowestScore}%` : `Lowest Score: ${stats.lowestScore}%`, 85, yPos + 23)
  pdf.text(`Completion Rate: ${stats.completionRate}%`, 140, yPos + 23)

  return yPos + 33
}

function addAwardsSection(pdf: jsPDF, awardResults: AwardResults, yPos: number): number {
  pdf.setFillColor(...DEFAULT_COLORS.gold)
  pdf.rect(15, yPos, 180, 8, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SESSION AWARDS', 20, yPos + 5.5)

  yPos += 12

  // Add awards in a grid
  let xPos = 20
  let rowY = yPos

  awardResults.awards.forEach((award, idx) => {
    if (xPos > 120) {
      xPos = 20
      rowY += 18
    }

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${award.name}:`, xPos, rowY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(award.recipients.map(r => r.participantName).join(', '), xPos, rowY + 5)

    xPos += 90
  })

  return rowY + 12
}

function addParticipantTable(pdf: jsPDF, participants: ParticipantWithAnalysis[], yPos: number): number {
  // Section header
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(15, yPos, 180, 8, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PARTICIPANT RESULTS', 20, yPos + 5.5)

  // Table data
  const tableData = participants.map((p, idx) => {
    const percentage = Math.round((p.correctAnswers / p.totalQuestions) * 100)
    return [
      idx + 1,
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
    startY: yPos + 10,
    theme: 'grid',
    headStyles: {
      fillColor: DEFAULT_COLORS.secondary,
      textColor: DEFAULT_COLORS.white,
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: DEFAULT_COLORS.text
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 60 },
      2: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 25 }
    },
    margin: { left: 15, right: 15 },
    alternateRowStyles: {
      fillColor: DEFAULT_COLORS.lightGray
    }
  })

  return (pdf as any).lastAutoTable?.finalY || yPos + 50
}

function addBingoParticipantTable(pdf: jsPDF, participants: ParticipantWithAnalysis[], yPos: number): number {
  // Section header
  pdf.setFillColor(...DEFAULT_COLORS.primary)
  pdf.rect(15, yPos, 180, 8, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PARTICIPANT RESULTS', 20, yPos + 5.5)

  // Table data - adapted for bingo
  const tableData = participants.map((p, idx) => {
    const coverage = p.totalQuestions > 0
      ? Math.round((p.correctAnswers / p.totalQuestions) * 100)
      : 0
    return [
      idx + 1,
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
    startY: yPos + 10,
    theme: 'grid',
    headStyles: {
      fillColor: DEFAULT_COLORS.secondary,
      textColor: DEFAULT_COLORS.white,
      fontStyle: 'bold',
      fontSize: 9
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: DEFAULT_COLORS.text
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 55 },
      2: { halign: 'center', cellWidth: 25, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'center', cellWidth: 20 }
    },
    margin: { left: 15, right: 15 },
    alternateRowStyles: {
      fillColor: DEFAULT_COLORS.lightGray
    }
  })

  return (pdf as any).lastAutoTable?.finalY || yPos + 50
}

function addDetailedAnalysis(pdf: jsPDF, participants: ParticipantWithAnalysis[], yPos: number): number {
  // Section header
  pdf.setFillColor(...DEFAULT_COLORS.secondary)
  pdf.rect(15, yPos, 180, 12, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.white)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DETAILED PARTICIPANT ANALYSIS', 20, yPos + 8)
  yPos += 18

  // Subtitle
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'italic')
  pdf.text('Areas Requiring Follow-up Training by Participant', 20, yPos)
  yPos += 10

  // Filter to participants with wrong answers
  const participantsWithErrors = participants.filter(p => p.wrongAnswers.length > 0)

  if (participantsWithErrors.length === 0) {
    // All perfect scores
    pdf.setFillColor(...DEFAULT_COLORS.lightGray)
    pdf.rect(15, yPos, 180, 20, 'F')
    pdf.setTextColor(...DEFAULT_COLORS.success)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('EXCELLENT PERFORMANCE', 20, yPos + 8)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text('All participants achieved perfect or near-perfect scores!', 20, yPos + 14)
    return yPos + 25
  }

  // Process each participant with errors
  for (const participant of participantsWithErrors) {
    // Check for page break
    if (yPos > 240) {
      pdf.addPage()
      yPos = 20
    }

    // Participant header
    const percentage = Math.round((participant.correctAnswers / participant.totalQuestions) * 100)
    pdf.setFillColor(...DEFAULT_COLORS.gold)
    pdf.rect(15, yPos, 180, 8, 'F')
    pdf.setTextColor(...DEFAULT_COLORS.text)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(
      `${participant.name} - Score: ${percentage}% (${participant.wrongAnswers.length} incorrect)`,
      20,
      yPos + 5.5
    )
    yPos += 12

    // Wrong answers
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')

    for (const wrongAnswer of participant.wrongAnswers) {
      // Check for page break
      if (yPos > 265) {
        pdf.addPage()
        yPos = 20
        pdf.setTextColor(...DEFAULT_COLORS.text)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'italic')
        pdf.text(`${participant.name} (continued)`, 20, yPos)
        yPos += 8
      }

      // Question box
      pdf.setDrawColor(...DEFAULT_COLORS.gold)
      pdf.setLineWidth(0.3)

      // Calculate box height based on content
      const questionLines = pdf.splitTextToSize(wrongAnswer.questionText, 150)
      const boxHeight = Math.max(22, 10 + questionLines.length * 4 + 12)

      pdf.rect(20, yPos, 170, boxHeight, 'S')

      // Question number and text
      pdf.setTextColor(...DEFAULT_COLORS.text)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Q${wrongAnswer.questionIndex}:`, 25, yPos + 5)
      pdf.setFont('helvetica', 'normal')
      pdf.text(questionLines, 35, yPos + 5)

      // Answers
      const answerY = yPos + 8 + questionLines.length * 3.5

      // Correct answer (green)
      pdf.setTextColor(0, 128, 0)
      pdf.text(`Correct: ${wrongAnswer.correctAnswer}`, 25, answerY)

      // Given answer (red)
      pdf.setTextColor(220, 38, 38)
      pdf.text(`Given: ${wrongAnswer.selectedAnswer}`, 25, answerY + 5)

      yPos += boxHeight + 5
    }

    yPos += 8 // Space between participants
  }

  // Follow-up summary
  if (yPos > 250) {
    pdf.addPage()
    yPos = 20
  }

  pdf.setFillColor(...DEFAULT_COLORS.lightGray)
  pdf.rect(15, yPos, 180, 8, 'F')
  pdf.setTextColor(...DEFAULT_COLORS.text)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('FOLLOW-UP SUMMARY', 20, yPos + 5.5)
  yPos += 12

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`${participantsWithErrors.length} participants require follow-up training:`, 20, yPos)
  yPos += 6

  // List participants needing help
  participantsWithErrors
    .sort((a, b) => b.wrongAnswers.length - a.wrongAnswers.length)
    .forEach(p => {
      const percentage = Math.round((p.wrongAnswers.length / p.totalQuestions) * 100)
      pdf.text(
        `- ${p.name}: ${p.wrongAnswers.length} questions incorrect (${percentage}% error rate)`,
        25,
        yPos
      )
      yPos += 5
    })

  return yPos
}

function addFooter(pdf: jsPDF, session: GameSession): void {
  const pageHeight = pdf.internal.pageSize.height
  const totalPages = pdf.internal.getNumberOfPages()

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)

    const footerY = pageHeight - 15

    // Footer background
    pdf.setFillColor(...DEFAULT_COLORS.secondary)
    pdf.rect(0, footerY - 5, 210, 20, 'F')

    // Footer content
    pdf.setTextColor(...DEFAULT_COLORS.gold)
    pdf.setFontSize(8)
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
    pdf.text(`Generated: ${dateStr} at ${timeStr}`, 15, footerY)

    // Center - page number
    pdf.text(`Page ${i} of ${totalPages}`, 105, footerY, { align: 'center' })

    // Right - branding
    pdf.text('Powered by Trained', 195, footerY, { align: 'right' })
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

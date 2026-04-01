// Attendance Register PDF generation - landscape A4 with org branding
// Generates a professional attendance register table for training sessions

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ref, getBlob } from 'firebase/storage'
import { storage } from './firebase'
import type { GameSession } from './firestore'

export interface ProcessedParticipant {
  name: string
  joinedAt?: Date
  completed: boolean
  scorePercent: number
  totalTime: number
}

// Color definitions matching pdfExport.ts
const COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  secondary: [30, 64, 175] as [number, number, number],
  gold: [251, 191, 36] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [248, 249, 250] as [number, number, number],
  text: [31, 41, 55] as [number, number, number],
}

const GAME_TYPE_LABELS: Record<string, string> = {
  quiz: 'Interactive Quiz',
  millionaire: 'Millionaire',
  bingo: 'Bingo',
  speedround: 'Speed Round',
  spotdifference: 'Spot the Difference',
}

/** Load an image from Firebase Storage (or fallback to fetch) as a base64 data URL */
const loadImageForPdf = async (url: string): Promise<string | null> => {
  try {
    const storageRef = ref(storage, url)
    const blob = await getBlob(storageRef)
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    // Fallback to fetch for non-Firebase URLs (e.g. base64 or external)
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }
}

/** Get natural dimensions of a base64/data URL image */
const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1, height: 1 })
    img.src = dataUrl
  })
}

/** Fit width x height into maxW x maxH preserving aspect ratio */
const fitInBox = (w: number, h: number, maxW: number, maxH: number) => {
  const scale = Math.min(maxW / w, maxH / h)
  return { width: w * scale, height: h * scale }
}

/** Format a date for display */
const formatDate = (date: Date | undefined): string => {
  if (!date) return 'N/A'
  try {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return 'Invalid date'
  }
}

/** Format a time for display */
const formatTime = (date: Date | undefined): string => {
  if (!date) return '-'
  try {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleTimeString('en-ZA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

/** Format seconds into mm:ss */
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export async function generateAttendanceRegisterPDF(
  session: GameSession,
  participants: ProcessedParticipant[],
  organizationName: string,
  organizationLogo?: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // ── Load logo ──
  let logoBase64: string | null = null
  if (organizationLogo) {
    try {
      if (organizationLogo.startsWith('http')) {
        logoBase64 = await loadImageForPdf(organizationLogo)
      } else {
        logoBase64 = organizationLogo // already base64
      }
    } catch { /* skip */ }
  }

  let yPos = 15

  // ── Header background ──
  const headerHeight = 22
  doc.setFillColor(...COLORS.primary)
  doc.rect(15, yPos, pageWidth - 30, headerHeight, 'F')

  // Logo (top-left of header)
  let textStartX = 20
  if (logoBase64) {
    try {
      const logoDims = await getImageDimensions(logoBase64)
      const logoFit = fitInBox(logoDims.width, logoDims.height, 35, 18)
      const logoX = 18
      const logoY = yPos + (headerHeight - logoFit.height) / 2
      doc.addImage(logoBase64, 'PNG', logoX, logoY, logoFit.width, logoFit.height)
      textStartX = logoX + logoFit.width + 5
    } catch {
      // Skip logo on error
    }
  }

  // Organization name
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(organizationName.toUpperCase(), textStartX, yPos + 10)

  // Subtitle
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Training Department', textStartX, yPos + 16)

  // Powered by Trained (right side)
  doc.setFontSize(9)
  doc.text('Powered by Trained', pageWidth - 18, yPos + 13, { align: 'right' })

  // Gold accent line
  doc.setFillColor(...COLORS.gold)
  doc.rect(15, yPos + headerHeight, pageWidth - 30, 2, 'F')

  yPos += headerHeight + 8

  // ── Title ──
  doc.setTextColor(...COLORS.text)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('ATTENDANCE REGISTER', pageWidth / 2, yPos + 8, { align: 'center' })
  yPos += 16

  // ── Session information bar ──
  doc.setFillColor(...COLORS.lightGray)
  doc.rect(15, yPos, pageWidth - 30, 18, 'F')

  doc.setTextColor(...COLORS.text)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')

  const sessionDate = formatDate(session.createdAt)
  const gameTypeLabel = GAME_TYPE_LABELS[session.gameType] || session.gameType

  // Row 1
  doc.text(`Session: ${session.title}`, 20, yPos + 7)
  doc.text(`Code: ${session.code}`, pageWidth / 2, yPos + 7, { align: 'center' })
  doc.text(`Date: ${sessionDate}`, pageWidth - 20, yPos + 7, { align: 'right' })

  // Row 2
  doc.setFont('helvetica', 'normal')
  doc.text(`Game Type: ${gameTypeLabel}`, 20, yPos + 14)
  doc.text(`Total Participants: ${participants.length}`, pageWidth - 20, yPos + 14, { align: 'right' })

  yPos += 24

  // ── Participant table ──
  // Section header
  doc.setFillColor(...COLORS.primary)
  doc.rect(15, yPos, pageWidth - 30, 8, 'F')
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('PARTICIPANTS', 20, yPos + 5.5)

  // Sort participants by name for the register
  const sortedParticipants = [...participants].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  // Build table data
  const tableData = sortedParticipants.map((p, idx) => [
    (idx + 1).toString(),
    p.name,
    p.joinedAt ? formatTime(p.joinedAt) : '-',
    p.completed ? 'Yes' : 'No',
    `${Math.round(p.scorePercent)}%`,
    formatDuration(p.totalTime),
  ])

  autoTable(doc, {
    head: [['#', 'Name', 'Joined At', 'Completed', 'Score %', 'Total Time']],
    body: tableData,
    startY: yPos + 10,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.secondary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 80 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 30 },
    },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    margin: { left: 15, right: 15, bottom: 22 },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
  })

  // ── Footer on all pages ──
  addFooter(doc, pageWidth)

  // ── Save PDF ──
  const date = new Date().toISOString().split('T')[0]
  const fileName = `Attendance-Register-${session.code}-${date}.pdf`
  doc.save(fileName)
}

function addFooter(doc: jsPDF, pageWidth: number): void {
  const pageHeight = doc.internal.pageSize.height
  const totalPages = doc.internal.getNumberOfPages()

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    const footerY = pageHeight - 15

    // Footer background
    doc.setFillColor(...COLORS.secondary)
    doc.rect(0, footerY - 5, pageWidth, 20, 'F')

    // Footer content
    doc.setTextColor(...COLORS.gold)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')

    // Left — generation date
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const timeStr = now.toLocaleTimeString('en-ZA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })
    doc.text(`Generated: ${dateStr} at ${timeStr}`, 15, footerY)

    // Center — page number
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, footerY, { align: 'center' })

    // Right — branding
    doc.text('Powered by Trained', pageWidth - 15, footerY, { align: 'right' })
  }
}

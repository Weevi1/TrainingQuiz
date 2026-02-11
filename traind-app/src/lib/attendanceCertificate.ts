// Attendance Certificate PDF generation - print-friendly with tenant branding
import jsPDF from 'jspdf'

export interface AttendanceCertificateData {
  participantName: string
  sessionTitle: string
  completionDate: Date
  organizationName?: string
  organizationLogo?: string // URL or base64
  sessionCode?: string
  primaryColor?: string    // hex e.g. "#1e3a5f"
  secondaryColor?: string  // hex e.g. "#c9a227"
  // Certificate signature block
  signatureImage?: string   // URL or base64
  signerName?: string       // e.g. "John Smith"
  signerTitle?: string      // e.g. "Training Manager"
  // Optional score data
  score?: number
  totalQuestions?: number
  correctAnswers?: number
  passingScore?: number
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const generateCertificateId = (data: AttendanceCertificateData): string => {
  const timestamp = data.completionDate.getTime()
  const nameHash = data.participantName.split('').reduce((a, b) => {
    const charCode = b.charCodeAt(0)
    return ((a << 5) - a) + charCode
  }, 0)
  return `ATT-${Math.abs(nameHash).toString(36).toUpperCase()}-${timestamp.toString(36).toUpperCase().slice(-6)}`
}

const hexToRgb = (hex: string): [number, number, number] => {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return [r, g, b]
}

// Strip emoji and other non-Latin characters that jsPDF's built-in fonts can't render
const sanitizeForPdf = (text: string): string => {
  return text
    // Remove emoji (surrogate pairs, variation selectors, ZWJ sequences)
    .replace(/[\u{1F600}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/[\u{20E3}]/gu, '')
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{E000}-\u{F8FF}]/gu, '')
    .trim()
}

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url)
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

// Draw a thin decorative divider with small diamond center
const drawDivider = (doc: jsPDF, y: number, centerX: number, halfWidth: number, color: [number, number, number]) => {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.4)
  doc.line(centerX - halfWidth, y, centerX - 4, y)
  doc.line(centerX + 4, y, centerX + halfWidth, y)
  // Small diamond in center
  doc.setFillColor(...color)
  doc.setLineWidth(0)
  const d = 2.2
  doc.triangle(centerX, y - d, centerX + d, y, centerX, y + d, 'F')
  doc.triangle(centerX, y - d, centerX - d, y, centerX, y + d, 'F')
}

export const generateAttendanceCertificate = async (data: AttendanceCertificateData): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const centerX = pageWidth / 2

  // Resolve colours — fallback to navy/dark-gold if no branding
  const primary = hexToRgb(data.primaryColor || '#1e3a5f')
  const secondary = hexToRgb(data.secondaryColor || '#8b6914')
  // Sanitize text for PDF rendering (strip emoji etc.)
  const participantName = sanitizeForPdf(data.participantName)
  const sessionTitle = sanitizeForPdf(data.sessionTitle)

  // ── Background ──
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // ── Border design: single elegant border with inset corner ornaments ──
  // Outer border — secondary colour, thick
  doc.setDrawColor(...secondary)
  doc.setLineWidth(1.8)
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16)

  // Inner border — primary colour, thin
  doc.setDrawColor(...primary)
  doc.setLineWidth(0.3)
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24)

  // Corner ornaments — secondary colour, L-shaped brackets inset from inner border
  const cInset = 16 // offset from page edge
  const cLen = 18   // arm length
  doc.setDrawColor(...secondary)
  doc.setLineWidth(1.2)
  // Top-left
  doc.line(cInset, cInset, cInset + cLen, cInset)
  doc.line(cInset, cInset, cInset, cInset + cLen)
  // Top-right
  doc.line(pageWidth - cInset, cInset, pageWidth - cInset - cLen, cInset)
  doc.line(pageWidth - cInset, cInset, pageWidth - cInset, cInset + cLen)
  // Bottom-left
  doc.line(cInset, pageHeight - cInset, cInset + cLen, pageHeight - cInset)
  doc.line(cInset, pageHeight - cInset, cInset, pageHeight - cInset - cLen)
  // Bottom-right
  doc.line(pageWidth - cInset, pageHeight - cInset, pageWidth - cInset - cLen, pageHeight - cInset)
  doc.line(pageWidth - cInset, pageHeight - cInset, pageWidth - cInset, pageHeight - cInset - cLen)

  // ── Content area — vertically centered between borders ──
  const contentTop = 26
  const contentBottom = pageHeight - 26
  const contentHeight = contentBottom - contentTop

  // Calculate total content height to center everything
  const hasLogo = !!data.organizationLogo
  const hasScore = data.totalQuestions !== undefined && data.correctAnswers !== undefined
  const hasOrg = !!data.organizationName
  const hasSignature = !!data.signatureImage
  const hasSignerName = !!data.signerName
  const hasSignerTitle = !!data.signerTitle

  // Estimate block heights
  const logoH = hasLogo ? 28 : 0
  const titleH = 16     // "Certificate of Attendance"
  const divider1H = 10
  const certifyH = 8
  const nameH = 16
  const attendedH = 8
  const sessionH = 12
  const divider2H = 10
  const scoreH = hasScore ? 12 : 0
  const dateH = 8
  const signatureH = hasSignature ? 20 : 0  // space for signature image
  const signerNameH = hasSignerName ? 7 : 0
  const signerTitleH = hasSignerTitle ? 6 : 0
  const issuedH = hasOrg || hasSignerName ? 22 : 0  // includes signature line
  const totalH = logoH + titleH + divider1H + certifyH + nameH + attendedH + sessionH + divider2H + scoreH + dateH + signatureH + issuedH + signerNameH + signerTitleH

  let y = contentTop + (contentHeight - totalH) / 2

  // ── Organization logo ──
  if (data.organizationLogo) {
    try {
      let logoData = data.organizationLogo
      if (logoData.startsWith('http')) {
        const base64 = await loadImageAsBase64(logoData)
        if (base64) logoData = base64
        else logoData = ''
      }
      if (logoData) {
        const logoMaxW = 45
        const logoMaxH = 22
        doc.addImage(logoData, 'AUTO', centerX - logoMaxW / 2, y, logoMaxW, logoMaxH)
        y += logoH
      }
    } catch {
      // Skip logo on error
    }
  }

  // ── Title ──
  doc.setTextColor(...primary)
  doc.setFontSize(34)
  doc.setFont('helvetica', 'bold')
  doc.text('Certificate of Attendance', centerX, y + 10, { align: 'center' })
  y += titleH

  // ── Decorative divider ──
  drawDivider(doc, y + 4, centerX, 55, secondary)
  y += divider1H

  // ── "This is to certify that" ──
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', centerX, y + 5, { align: 'center' })
  y += certifyH

  // ── Participant Name ──
  doc.setTextColor(...primary)
  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.text(participantName, centerX, y + 12, { align: 'center' })
  y += nameH

  // ── "attended and participated in" ──
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text('attended and participated in', centerX, y + 5, { align: 'center' })
  y += attendedH

  // ── Session Title ──
  doc.setTextColor(...secondary)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bolditalic')
  doc.text(sessionTitle, centerX, y + 8, { align: 'center' })
  y += sessionH

  // ── Decorative divider ──
  drawDivider(doc, y + 4, centerX, 40, secondary)
  y += divider2H

  // ── Score line (if available) ──
  if (hasScore) {
    const pct = Math.round((data.correctAnswers! / data.totalQuestions!) * 100)
    const passed = data.passingScore ? pct >= data.passingScore : pct >= 60
    const resultText = passed
      ? `Score: ${pct}% (${data.correctAnswers}/${data.totalQuestions}) — Passed`
      : `Score: ${pct}% (${data.correctAnswers}/${data.totalQuestions})`
    doc.setTextColor(passed ? 34 : 100, passed ? 120 : 100, passed ? 69 : 100)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(resultText, centerX, y + 5, { align: 'center' })
    y += scoreH
  }

  // ── Date ──
  doc.setTextColor(120, 120, 120)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(data.completionDate), centerX, y + 5, { align: 'center' })
  y += dateH

  // ── Signature image (if provided) ──
  if (hasSignature) {
    try {
      let sigData = data.signatureImage!
      if (sigData.startsWith('http')) {
        const base64 = await loadImageAsBase64(sigData)
        if (base64) sigData = base64
        else sigData = ''
      }
      if (sigData) {
        const sigW = 50
        const sigH = 15
        doc.addImage(sigData, 'AUTO', centerX - sigW / 2, y + 2, sigW, sigH)
        y += signatureH
      }
    } catch {
      // Skip signature on error
    }
  }

  // ── Issued by / Signature area ──
  if (hasOrg || hasSignerName) {
    y += 6
    // Signature line
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(centerX - 40, y + 5, centerX + 40, y + 5)
    y += 5

    // Signer name (bold, primary colour)
    if (hasSignerName) {
      doc.setTextColor(...primary)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(sanitizeForPdf(data.signerName!), centerX, y + 7, { align: 'center' })
      y += signerNameH
    }

    // Signer title (lighter, smaller)
    if (hasSignerTitle) {
      doc.setTextColor(120, 120, 120)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.text(sanitizeForPdf(data.signerTitle!), centerX, y + 6, { align: 'center' })
      y += signerTitleH
    }

    // Org name under signer info
    if (hasOrg) {
      doc.setTextColor(...primary)
      doc.setFontSize(hasSignerName ? 10 : 12)
      doc.setFont('helvetica', hasSignerName ? 'normal' : 'bold')
      doc.text(data.organizationName!, centerX, y + 7, { align: 'center' })
    }
  }

  // ── Footer — subtle, near bottom border ──
  doc.setTextColor(180, 180, 180)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Certificate ID: ${generateCertificateId(data)} | Generated by Trained Platform`,
    centerX,
    pageHeight - 18,
    { align: 'center' }
  )

  return doc.output('blob')
}

export const downloadAttendanceCertificate = async (data: AttendanceCertificateData, filename?: string): Promise<void> => {
  const blob = await generateAttendanceCertificate(data)
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || `${data.participantName.replace(/\s+/g, '_')}_Attendance_Certificate.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

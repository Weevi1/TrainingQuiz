// Attendance Certificate PDF generation - print-friendly with tenant branding
import jsPDF from 'jspdf'
import { ref, getBlob } from 'firebase/storage'
import { storage } from './firebase'

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
  // CPD (Continuing Professional Development)
  cpdPoints?: number          // Number of CPD points available
  cpdRequiresPass?: boolean   // Whether pass was required to earn CPD
  cpdEarned?: boolean         // Whether this participant actually earned CPD
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

const loadImageForPdf = async (url: string): Promise<string | null> => {
  try {
    // Use Firebase Storage SDK to download (bypasses CORS, uses storage rules: allow read if true)
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

/** Fit width×height into maxW×maxH preserving aspect ratio */
const fitInBox = (w: number, h: number, maxW: number, maxH: number) => {
  const scale = Math.min(maxW / w, maxH / h)
  return { width: w * scale, height: h * scale }
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

  // ── Pre-load images before calculating layout ──
  let logoBase64: string | null = null
  let signatureBase64: string | null = null

  if (data.organizationLogo) {
    try {
      if (data.organizationLogo.startsWith('http')) {
        logoBase64 = await loadImageForPdf(data.organizationLogo)
      } else {
        logoBase64 = data.organizationLogo // already base64
      }
    } catch { /* skip */ }
  }

  if (data.signatureImage) {
    try {
      if (data.signatureImage.startsWith('http')) {
        signatureBase64 = await loadImageForPdf(data.signatureImage)
      } else {
        signatureBase64 = data.signatureImage
      }
    } catch { /* skip */ }
  }

  // ── Content area — vertically centered between borders ──
  // Corner ornaments extend to y=34 (top) and y=176 (bottom on A4 landscape 210mm)
  // Footer text at y=192. Keep content clear of all decorative elements.
  const contentTop = 36
  const contentBottom = pageHeight - 38
  const contentHeight = contentBottom - contentTop

  // Calculate heights based on what ACTUALLY loaded (not what was requested)
  const hasLogo = !!logoBase64
  const hasScore = data.totalQuestions !== undefined && data.correctAnswers !== undefined
  const hasCpd = !!data.cpdEarned && !!data.cpdPoints
  const hasOrg = !!data.organizationName
  const hasSignature = !!signatureBase64
  const hasSignerName = !!data.signerName
  const hasSignerTitle = !!data.signerTitle

  // Compact block heights — matched to actual rendered content per section
  const logoH = hasLogo ? 26 : 0
  const titleH = 15
  const divider1H = 10
  const certifyH = 8
  const nameH = 15
  const attendedH = 8
  const sessionH = 12
  const divider2H = 10
  const scoreH = hasScore ? 8 : 0
  const cpdH = hasCpd ? 10 : 0
  const dateH = 8
  // Signature block: image sits above line, name/title/org below — treated as one unit
  const sigBlockH = (hasSignature || hasSignerName || hasOrg) ? (
    (hasSignature ? 16 : 0) +  // signature image (bottom-aligned above line)
    2 +                         // line itself
    (hasSignerName ? 5 : 0) +  // signer name
    (hasSignerTitle ? 4 : 0) + // signer title
    (hasOrg ? 4 : 0)           // org name
  ) : 0
  const totalH = logoH + titleH + divider1H + certifyH + nameH + attendedH + sessionH + divider2H + scoreH + cpdH + dateH + sigBlockH

  // Center vertically, but never go above contentTop
  let y = Math.max(contentTop, contentTop + (contentHeight - totalH) / 2)

  // ── Organization logo ──
  if (logoBase64) {
    try {
      const logoDims = await getImageDimensions(logoBase64)
      const logoFit = fitInBox(logoDims.width, logoDims.height, 45, 22)
      doc.addImage(logoBase64, 'PNG', centerX - logoFit.width / 2, y + (22 - logoFit.height) / 2, logoFit.width, logoFit.height)
      y += logoH
    } catch {
      // Skip logo on error
    }
  }

  // ── Title ──
  doc.setTextColor(...primary)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('Certificate of Attendance', centerX, y + 10, { align: 'center' })
  y += titleH

  // ── Decorative divider ──
  drawDivider(doc, y + 4, centerX, 55, secondary)
  y += divider1H

  // ── "This is to certify that" ──
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', centerX, y + 5, { align: 'center' })
  y += certifyH

  // ── Participant Name ──
  doc.setTextColor(...primary)
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text(participantName, centerX, y + 10, { align: 'center' })
  y += nameH

  // ── "attended and participated in" ──
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('attended and participated in', centerX, y + 5, { align: 'center' })
  y += attendedH

  // ── Session Title ──
  doc.setTextColor(...secondary)
  doc.setFontSize(18)
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
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(resultText, centerX, y + 5, { align: 'center' })
    y += scoreH
  }

  // ── CPD Points (if earned) ──
  if (hasCpd) {
    doc.setTextColor(...primary)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    const pointsLabel = data.cpdPoints === 1 ? '1 CPD Point Awarded' : `${data.cpdPoints} CPD Points Awarded`
    doc.text(pointsLabel, centerX, y + 5, { align: 'center' })
    const basisLabel = data.cpdRequiresPass ? '(Pass Required)' : '(Attendance Based)'
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(basisLabel, centerX, y + 9, { align: 'center' })
    y += cpdH
  }

  // ── Date ──
  doc.setTextColor(120, 120, 120)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(data.completionDate), centerX, y + 5, { align: 'center' })
  y += dateH

  // ── Signature block: image → line → name → title → org ──
  if (hasSignature || hasSignerName || hasOrg) {
    // Signature image — bottom-aligned so it sits right above the line
    if (signatureBase64) {
      try {
        const sigDims = await getImageDimensions(signatureBase64)
        const sigFit = fitInBox(sigDims.width, sigDims.height, 45, 14)
        // Place image so its bottom edge is 1mm above where the line will be
        doc.addImage(signatureBase64, 'PNG', centerX - sigFit.width / 2, y + (16 - sigFit.height) - 1, sigFit.width, sigFit.height)
        y += 16
      } catch {
        // Skip signature on error
      }
    }

    // Signature line
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(centerX - 35, y, centerX + 35, y)
    y += 2

    // Signer name — directly below line
    if (hasSignerName) {
      doc.setTextColor(...primary)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(sanitizeForPdf(data.signerName!), centerX, y + 4, { align: 'center' })
      y += 5
    }

    // Signer title — tight below name
    if (hasSignerTitle) {
      doc.setTextColor(120, 120, 120)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text(sanitizeForPdf(data.signerTitle!), centerX, y + 3.5, { align: 'center' })
      y += 4
    }

    // Org name — tight below title
    if (hasOrg) {
      doc.setTextColor(...primary)
      doc.setFontSize(hasSignerName ? 8 : 10)
      doc.setFont('helvetica', hasSignerName ? 'normal' : 'bold')
      doc.text(data.organizationName!, centerX, y + 3.5, { align: 'center' })
      y += 4
    }
  }

  // ── Footer — between inner border (y=198) and outer border (y=202), well below content ──
  doc.setTextColor(190, 190, 190)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Certificate ID: ${generateCertificateId(data)} | Generated by Trained Platform`,
    centerX,
    pageHeight - 14,
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

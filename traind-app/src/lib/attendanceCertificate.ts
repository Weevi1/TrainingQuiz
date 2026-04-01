// Attendance Certificate PDF generation - print-friendly with tenant branding
import jsPDF from 'jspdf'
import { ref, getBlob } from 'firebase/storage'
import { storage } from './firebase'

export type CertificateTemplate = 'elegant' | 'cpd-professional' | 'minimal'

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
  cpdVerifiable?: boolean     // Whether CPD points are verifiable or non-verifiable
  // Template selection
  template?: CertificateTemplate
  // CPD-professional template fields
  companyDescriptor?: string    // e.g. "Attorneys Notaries Conveyancers" — subtitle under org name
  speaker?: string              // Speaker/presenter name
  venue?: string                // Training venue
  cpdCategory?: string          // e.g. "Personal Development", "Legal Practice"
  attendeeLabel?: string        // e.g. "Estate Agent", "Attendee" — label for participant field
  websiteUrl?: string           // e.g. "www.abgross.co.za" — shown in footer
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

/**
 * Convert a transparent PNG to JPEG with white background.
 * jsPDF renders transparent PNG pixels as black. JPEG has no alpha channel,
 * so white fills naturally. The JPEG is drawn AFTER the signature line,
 * overlapping it like a real pen signature on paper.
 */
const flattenToJpeg = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.95))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
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

/**
 * CPD Professional template — matches Abrahams & Gross Inc. physical certificates exactly.
 * Layout (landscape A4):
 * - LEFT edge: "CERTIFICATE" written vertically (rotated 90° CCW, bottom to top)
 * - TOP area (right of vertical text): Org block — logo | org name, rule, descriptor
 * - Below org: Large CPD points number left, category + "CPD Points Earned" text right
 * - Form fields with underlines (attendee, topic, date, venue, speaker)
 * - CPD qualification statement
 * - Signature line + "Signed on behalf of..." bottom-left
 * - Website URL bottom-right
 * No decorative borders — clean professional look.
 */
const drawCpdProfessionalPage = async (
  doc: jsPDF,
  data: AttendanceCertificateData,
  logoBase64: string | null,
  signatureBase64: string | null
): Promise<void> => {
  const pageWidth = doc.internal.pageSize.getWidth()  // 297mm landscape
  const pageHeight = doc.internal.pageSize.getHeight() // 210mm landscape

  const primary = hexToRgb(data.primaryColor || '#1a2744')
  const participantName = sanitizeForPdf(data.participantName)
  const sessionTitle = sanitizeForPdf(data.sessionTitle)

  // White background
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // ── "CERTIFICATE" — vertical text along the left edge, light grey watermark style ──
  // Physical reference: single rotated word in silver/light-grey serif, bottom-to-top, with letter-spacing
  // "CERTIFICATE" — centered in the left margin strip (0 to contentLeft=50mm)
  const certFontSize = 76
  const certText = 'CERTIFICATE'
  doc.setFontSize(certFontSize)
  doc.setFont('helvetica', 'bold')
  // Measure text height (ascender) to find true center — approximate cap height as 70% of font size in mm
  const capHeightMm = certFontSize * 0.353 * 0.72 // pt → mm, then cap height ratio
  const verticalX = (50 - capHeightMm) / 2 + capHeightMm // center the glyph block in 0–50mm margin
  // Per-letter shadow — two light sources: top edge and bottom edge of page
  // Letters near the top get shadow pushed DOWN (light from above)
  // Letters near the bottom get shadow pushed UP (light from below)
  // Middle letters: shadows cancel, minimal offset
  const letters = certText.split('')
  const letterWidths = letters.map(l => { doc.setFontSize(certFontSize); return doc.getTextWidth(l) })
  const totalWidth = letterWidths.reduce((a, b) => a + b, 0)
  let startY = (pageHeight + totalWidth) / 2 // bottom of first letter (word reads bottom-to-top)

  for (let i = 0; i < letters.length; i++) {
    const letterY = startY
    // Normalized position: -1 at bottom of page, +1 at top
    const normalizedPos = ((pageHeight - letterY) / pageHeight) * 2 - 1
    // Shadow Y offset: positive = shadow falls down page (toward bottom), negative = toward top
    // Top light pushes shadow down, bottom light pushes shadow up
    // Blend: near top → shadow down, near bottom → shadow up
    const shadowOffsetY = normalizedPos * 1.5
    const shadowOffsetX = 0.8

    // Shadow layer
    doc.setTextColor(170, 172, 178)
    doc.text(letters[i], verticalX + shadowOffsetX, letterY + shadowOffsetY, { angle: 90 })

    // Main letter
    doc.setTextColor(0, 0, 0)
    doc.text(letters[i], verticalX, letterY, { angle: 90 })

    startY -= letterWidths[i]
  }

  // Content area starts to the right of the vertical text
  const contentLeft = 50
  const contentRight = pageWidth - 25
  const contentTop = 22

  // ── Org block — top area ──
  // If logo is present, show logo ONLY (logo already contains org name + descriptor).
  // If no logo, show org name text + rule + descriptor as fallback.
  let y = contentTop

  if (logoBase64) {
    // Logo contains org name + descriptor — just show the logo, larger
    try {
      const logoDims = await getImageDimensions(logoBase64)
      // Logo should sit prominently — allow up to ~60% of content width, tall enough to be proud
      const maxLogoW = (contentRight - contentLeft) * 0.6
      const logoFit = fitInBox(logoDims.width, logoDims.height, maxLogoW, 42)
      doc.addImage(logoBase64, 'PNG', contentLeft, y, logoFit.width, logoFit.height)
      y += logoFit.height + 10
    } catch {
      y += 30
    }
  } else if (data.organizationName) {
    const orgName = sanitizeForPdf(data.organizationName).toUpperCase()
    const descriptor = data.companyDescriptor
      ? sanitizeForPdf(data.companyDescriptor).toUpperCase()
      : ''

    doc.setTextColor(...primary)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(orgName, contentLeft, y + 12)

    // Thin horizontal rule under org name
    const ruleY = y + 17
    doc.setDrawColor(...primary)
    doc.setLineWidth(0.5)
    doc.line(contentLeft, ruleY, contentRight, ruleY)

    // Descriptor below the rule
    if (descriptor) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...primary)
      doc.text(descriptor, contentLeft, ruleY + 7)
    }

    y = ruleY + 14
  } else {
    y += 30
  }

  // ── CPD row: large number left, category + "CPD Points Earned" right ──
  const category = data.cpdCategory || 'Personal Development'
  const hasPoints = !!data.cpdPoints && data.cpdEarned

  if (hasPoints) {
    // Large CPD points number — left side, black bold
    const pointsStr = String(data.cpdPoints)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(pointsStr, contentLeft, y + 8)

    // Category + "CPD Points Earned (verifiable/non-verifiable)" — right of number, black normal
    const numWidth = doc.getTextWidth(pointsStr)
    const textX = contentLeft + numWidth + 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(category, textX, y + 2)
    doc.text(
      `CPD Points Earned (${data.cpdVerifiable ? 'verifiable' : 'non-verifiable'})`,
      textX, y + 8
    )
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(category, contentLeft, y + 4)
  }

  y += 10

  // ── Form fields — label: value with underline extending to right margin ──
  // Physical ref: generous spacing between fields, heavier underlines
  const fieldSpacing = 14
  const attendeeLabel = data.attendeeLabel || 'Attendee'

  const drawField = (label: string, value: string, fieldY: number) => {
    // Label — regular weight, smaller than value for visual hierarchy
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const labelText = label.toUpperCase() + ':'
    doc.text(labelText, contentLeft, fieldY)

    const labelWidth = doc.getTextWidth(labelText)
    const lineStartX = contentLeft + labelWidth + 2

    // Value — bold, larger
    if (value) {
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(sanitizeForPdf(value), lineStartX + 4, fieldY)
    }

    // Underline from after label to right margin
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(lineStartX, fieldY + 3, contentRight, fieldY + 3)
  }

  y += fieldSpacing
  drawField(attendeeLabel, participantName, y)

  y += fieldSpacing
  drawField('Topic', sessionTitle, y)

  y += fieldSpacing
  drawField('Date', formatDate(data.completionDate), y)

  y += fieldSpacing
  drawField('Venue', data.venue || '', y)

  y += fieldSpacing
  const speakerName = data.speaker || data.signerName || ''
  drawField('Speaker', speakerName, y)

  // Score line (if available)
  if (data.totalQuestions !== undefined && data.correctAnswers !== undefined) {
    y += fieldSpacing
    const pct = Math.round((data.correctAnswers / data.totalQuestions) * 100)
    const passed = data.passingScore ? pct >= data.passingScore : pct >= 60
    drawField('Score', `${pct}% (${data.correctAnswers}/${data.totalQuestions})${passed ? ' - Passed' : ''}`, y)
  }

  // ── CPD qualification statement — above signature, matching physical order ──
  if (hasPoints) {
    y += fieldSpacing
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(
      'THIS TRAINING SESSION QUALIFIES THE ATTENDEE TO EARN CPD POINTS',
      contentLeft, y
    )
  }

  // ── Signature block — image sits above the line, text below it ──
  // Image top starts below CPD text with a small gap
  const sigImageTop = y + 6
  let sigLineY = sigImageTop + 18 // default line position if no image

  // Signature image — placed first, line drawn on top at the bottom edge
  if (signatureBase64) {
    try {
      const flatSig = await flattenToJpeg(signatureBase64)
      const sigDims = await getImageDimensions(flatSig)
      const sigFit = fitInBox(sigDims.width, sigDims.height, 55, 18)
      doc.addImage(flatSig, 'JPEG', contentLeft, sigImageTop, sigFit.width, sigFit.height)
      sigLineY = sigImageTop + sigFit.height
    } catch { /* skip */ }
  }

  // Signature line — drawn ON TOP of the image at its bottom edge
  const sigLineWidth = 120
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(contentLeft, sigLineY, contentLeft + sigLineWidth, sigLineY)

  // Signer name + title below signature line
  let sigTextY = sigLineY + 2
  if (data.signerName) {
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(sanitizeForPdf(data.signerName), contentLeft, sigTextY + 6)
    sigTextY += 6
    if (data.signerTitle) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(sanitizeForPdf(data.signerTitle), contentLeft, sigTextY + 5)
      sigTextY += 5
    }
  }

  // "Signed on behalf of [Org]" — below signer details
  const signedOnBehalfY = data.signerName ? sigTextY + 5 : sigLineY + 6
  doc.setTextColor(80, 80, 80)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  const signedText = data.organizationName
    ? `Signed on behalf of ${sanitizeForPdf(data.organizationName)}`
    : 'Authorized Signature'
  doc.text(signedText, contentLeft, signedOnBehalfY)

  // ── Footer — website URL pinned to bottom-right of page ──
  const footerY = pageHeight - 8
  if (data.websiteUrl) {
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(sanitizeForPdf(data.websiteUrl), contentRight, footerY, { align: 'right' })
  }
}

/** Load a logo or signature image from URL, returning base64 data URL or null */
// Module-level image cache — avoids re-downloading the same logo/signature
// across multiple individual certificate downloads in the same session
const imageCache = new Map<string, string | null>()

const resolveImageToBase64 = async (urlOrBase64: string | undefined): Promise<string | null> => {
  if (!urlOrBase64) return null
  try {
    if (urlOrBase64.startsWith('http')) {
      if (imageCache.has(urlOrBase64)) return imageCache.get(urlOrBase64)!
      const result = await loadImageForPdf(urlOrBase64)
      imageCache.set(urlOrBase64, result)
      return result
    }
    return urlOrBase64 // already base64
  } catch {
    return null
  }
}

/**
 * Draw a single certificate on the CURRENT page, dispatching to the correct template.
 */
const drawCertificatePage = async (
  doc: jsPDF,
  data: AttendanceCertificateData,
  logoBase64: string | null,
  signatureBase64: string | null
): Promise<void> => {
  const template = data.template || 'elegant'
  switch (template) {
    case 'cpd-professional':
      return drawCpdProfessionalPage(doc, data, logoBase64, signatureBase64)
    case 'minimal':
      // TODO: minimal template — falls through to elegant for now
      return drawElegantPage(doc, data, logoBase64, signatureBase64)
    case 'elegant':
    default:
      return drawElegantPage(doc, data, logoBase64, signatureBase64)
  }
}

/**
 * Elegant template — centered layout with decorative borders and diamond dividers.
 * The original certificate design.
 */
const drawElegantPage = async (
  doc: jsPDF,
  data: AttendanceCertificateData,
  logoBase64: string | null,
  signatureBase64: string | null
): Promise<void> => {
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

  // ── Signature block: line first, then image on top, then name/title/org ──
  if (hasSignature || hasSignerName || hasOrg) {
    y += 16 // space for signature image

    // Signature line — drawn first so the image overlaps it
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(centerX - 35, y, centerX + 35, y)

    // Signature image — drawn AFTER line, centered vertically on it
    if (signatureBase64) {
      try {
        const flatSig = await flattenToJpeg(signatureBase64)
        const sigDims = await getImageDimensions(flatSig)
        const sigFit = fitInBox(sigDims.width, sigDims.height, 45, 16)
        doc.addImage(flatSig, 'JPEG', centerX - sigFit.width / 2, y - sigFit.height / 2, sigFit.width, sigFit.height)
      } catch {
        // Skip signature on error
      }
    }
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
}

export const generateAttendanceCertificate = async (data: AttendanceCertificateData): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  // Load images for this single certificate
  const logoBase64 = await resolveImageToBase64(data.organizationLogo)
  const signatureBase64 = await resolveImageToBase64(data.signatureImage)

  await drawCertificatePage(doc, data, logoBase64, signatureBase64)

  return doc.output('blob')
}

/**
 * Generate a single PDF containing all certificates (one per page).
 * Logo and signature images are loaded ONCE from Firebase Storage,
 * then reused for every participant — avoids N redundant network calls.
 */
export const generateMergedCertificatesPDF = async (
  allData: AttendanceCertificateData[],
  filename?: string
): Promise<void> => {
  if (allData.length === 0) return

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  // Pre-load logo and signature ONCE from the first entry that has them
  // (all participants in the same session share the same org branding)
  const logoSource = allData.find(d => d.organizationLogo)?.organizationLogo
  const signatureSource = allData.find(d => d.signatureImage)?.signatureImage
  const [logoBase64, signatureBase64] = await Promise.all([
    resolveImageToBase64(logoSource),
    resolveImageToBase64(signatureSource)
  ])

  for (let i = 0; i < allData.length; i++) {
    if (i > 0) {
      doc.addPage()
    }
    await drawCertificatePage(doc, allData[i], logoBase64, signatureBase64)
  }

  // Save the merged PDF
  doc.save(filename || 'Attendance_Certificates.pdf')
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

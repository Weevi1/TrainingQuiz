/**
 * Generate a sample CPD Professional certificate for Abrahams & Gross.
 * Matches the physical A&G certificate layout:
 *   - "CERTIFICATE" vertical on left edge (bottom to top)
 *   - Logo + org name + descriptor top area
 *   - CPD category + big points number
 *   - Form fields with ALL CAPS labels and underlines
 *   - CPD statement as bold text
 *   - "Signed on behalf of" at bottom
 *
 * Run: node scripts/generate-sample-cert.cjs
 * Output: scripts/AG_Sample_Certificate.pdf
 */
const { jsPDF } = require('../traind-app/node_modules/jspdf')
const fs = require('fs')
const path = require('path')

const hexToRgb = (hex) => {
  const cleaned = hex.replace('#', '')
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16)
  ]
}

const formatDate = (date) =>
  date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

const generateCertificateId = (name, date) => {
  const timestamp = date.getTime()
  const nameHash = name.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)
  return `ATT-${Math.abs(nameHash).toString(36).toUpperCase()}-${timestamp.toString(36).toUpperCase().slice(-6)}`
}

// ── A&G sample data ──
const data = {
  participantName: 'Sarah van der Merwe',
  sessionTitle: 'Professional Ethics and Legal Practice Management',
  completionDate: new Date('2026-03-09'),
  organizationName: 'Abrahams & Gross',
  companyDescriptor: 'Attorneys Notaries Conveyancers',
  primaryColor: '#1a2744',   // Navy
  secondaryColor: '#8b6914', // Gold
  signerName: 'Jacques Memory',
  signerTitle: 'Training Coordinator',
  cpdCategory: 'Personal Development',
  cpdPoints: 2,
  cpdEarned: true,
  cpdRequiresPass: true,
  speaker: 'Adv. Michael Petersen',
  venue: 'Abrahams & Gross Boardroom, Cape Town',
  score: 85,
  totalQuestions: 20,
  correctAnswers: 17,
  passingScore: 60,
  sessionCode: 'A7'
}

const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
const pageWidth = doc.internal.pageSize.getWidth()   // 297mm
const pageHeight = doc.internal.pageSize.getHeight()  // 210mm

const primary = hexToRgb(data.primaryColor)

// Content area starts after the vertical "CERTIFICATE" strip
const contentLeft = 45
const contentRight = pageWidth - 15

// ── White background ──
doc.setFillColor(255, 255, 255)
doc.rect(0, 0, pageWidth, pageHeight, 'F')

// ── 1. "CERTIFICATE" — vertical on left edge, bottom to top ──
doc.setTextColor(...primary)
doc.setFontSize(40)
doc.setFont('helvetica', 'bold')
// angle: 90 = counter-clockwise = reads bottom to top
doc.text('CERTIFICATE', 22, pageHeight - 20, { angle: 90 })

// Thin vertical line separating title strip from content
doc.setDrawColor(200, 200, 200)
doc.setLineWidth(0.3)
doc.line(38, 12, 38, pageHeight - 12)

// ── 2. Logo + Org name (top of content area) ──
let y = 22
// Logo placeholder — in production, logo image goes here (left side)
// Org name to the right of logo space
const orgNameX = contentLeft + 20  // leave room for logo
doc.setTextColor(...primary)
doc.setFontSize(18)
doc.setFont('helvetica', 'bold')
doc.text(data.organizationName.toUpperCase(), orgNameX, y)

// Descriptor below org name
doc.setFontSize(8.5)
doc.setFont('helvetica', 'normal')
doc.setTextColor(120, 120, 120)
doc.text(data.companyDescriptor.toUpperCase(), orgNameX, y + 6)

// Thin horizontal line under header
y += 14
doc.setDrawColor(200, 200, 200)
doc.setLineWidth(0.3)
doc.line(contentLeft, y, contentRight, y)

// ── 3. CPD Category + Points row ──
y += 12
const verifiableStr = data.cpdRequiresPass ? '(verifiable)' : '(non-verifiable)'

// Category name (left)
doc.setTextColor(...primary)
doc.setFontSize(11)
doc.setFont('helvetica', 'normal')
doc.text(data.cpdCategory, contentLeft, y)

// Big points number
doc.setFontSize(28)
doc.setFont('helvetica', 'bold')
doc.setTextColor(...primary)
const pointsX = contentLeft + 80
doc.text(`${data.cpdPoints}`, pointsX, y + 3)

// "CPD Points Earned (non-verifiable)" right of number
doc.setFontSize(10)
doc.setFont('helvetica', 'normal')
doc.setTextColor(120, 120, 120)
const labelX = pointsX + 14
doc.text('CPD Points Earned', labelX, y - 2)
doc.text(verifiableStr, labelX, y + 4)

// ── 4. Form fields — ALL CAPS labels, underlines ──
y += 18
const fieldSpacing = 16

const drawField = (label, value, fieldY) => {
  // ALL CAPS label in navy bold
  doc.setTextColor(...primary)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(label + ':', contentLeft, fieldY)

  // Value on the line
  const labelWidth = doc.getTextWidth(label + ':')
  const valueX = contentLeft + labelWidth + 4
  if (value) {
    doc.setTextColor(...primary)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(value, valueX, fieldY)
  }

  // Underline from after label to right edge
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.3)
  doc.line(valueX - 2, fieldY + 2, contentRight, fieldY + 2)
}

drawField('ATTENDEE', data.participantName, y)
y += fieldSpacing
drawField('TOPIC', data.sessionTitle, y)
y += fieldSpacing
drawField('DATE', formatDate(data.completionDate), y)
y += fieldSpacing
drawField('VENUE', data.venue, y)
y += fieldSpacing
drawField('SPEAKER', data.speaker, y)
y += fieldSpacing

// Score (our addition — not on physical cert)
const pct = Math.round((data.correctAnswers / data.totalQuestions) * 100)
drawField('SCORE', `${pct}% (${data.correctAnswers}/${data.totalQuestions}) — Passed`, y)
y += fieldSpacing

// ── 5. CPD statement — bold text (not a filled bar) ──
y += 4
doc.setTextColor(...primary)
doc.setFontSize(11)
doc.setFont('helvetica', 'bold')
doc.text(
  'THIS TRAINING SESSION QUALIFIES THE ATTENDEE TO EARN CPD POINTS',
  contentLeft, y
)

// ── 6. "Signed on behalf of" — left-aligned near bottom ──
y += 12
doc.setTextColor(120, 120, 120)
doc.setFontSize(9)
doc.setFont('helvetica', 'italic')
doc.text(`Signed on behalf of ${data.organizationName} Inc.`, contentLeft, y)

// ── 7. Footer ──
const footerY = pageHeight - 10
doc.setTextColor(190, 190, 190)
doc.setFontSize(6)
doc.setFont('helvetica', 'normal')
doc.text(
  `Certificate ID: ${generateCertificateId(data.participantName, data.completionDate)} | Generated by Trained Platform`,
  contentRight, footerY, { align: 'right' }
)

// ── Save ──
const outputPath = path.join(__dirname, 'AG_Sample_Certificate.pdf')
const buffer = Buffer.from(doc.output('arraybuffer'))
fs.writeFileSync(outputPath, buffer)
console.log(`Certificate saved to: ${outputPath}`)

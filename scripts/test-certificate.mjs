#!/usr/bin/env node
/**
 * Test script: generates a sample CPD Professional certificate PDF for visual inspection.
 * Usage: node scripts/test-certificate.mjs
 * Output: /tmp/test-certificate.pdf
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Use the project's jsPDF
const { jsPDF } = require('../traind-app/node_modules/jspdf/dist/jspdf.node.js')
import fs from 'fs'

const hexToRgb = (hex) => {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return [r, g, b]
}

const sanitizeForPdf = (text) => text.trim()

const formatDate = (date) => {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function drawCpdProfessionalPage(doc, data) {
  const pageWidth = doc.internal.pageSize.getWidth()   // 297mm landscape
  const pageHeight = doc.internal.pageSize.getHeight()  // 210mm landscape

  const primary = hexToRgb(data.primaryColor || '#1a2744')
  const participantName = sanitizeForPdf(data.participantName)
  const sessionTitle = sanitizeForPdf(data.sessionTitle)

  // White background
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // ── "CERTIFICATE" — vertical text along the left edge ──
  const certFontSize = 76
  const certText = 'CERTIFICATE'
  doc.setFontSize(certFontSize)
  doc.setFont('helvetica', 'bold')
  const capHeightMm = certFontSize * 0.353 * 0.72
  const verticalX = (50 - capHeightMm) / 2 + capHeightMm

  const letters = certText.split('')
  const letterWidths = letters.map(l => { doc.setFontSize(certFontSize); return doc.getTextWidth(l) })
  const totalWidth = letterWidths.reduce((a, b) => a + b, 0)
  let startY = (pageHeight + totalWidth) / 2

  for (let i = 0; i < letters.length; i++) {
    const letterY = startY
    const normalizedPos = ((pageHeight - letterY) / pageHeight) * 2 - 1
    const shadowOffsetY = normalizedPos * 1.5
    const shadowOffsetX = 0.8

    // Shadow
    doc.setTextColor(170, 172, 178)
    doc.text(letters[i], verticalX + shadowOffsetX, letterY + shadowOffsetY, { angle: 90 })

    // Main letter
    doc.setTextColor(0, 0, 0)
    doc.text(letters[i], verticalX, letterY, { angle: 90 })

    startY -= letterWidths[i]
  }

  // Content area
  const contentLeft = 50
  const contentRight = pageWidth - 25
  const contentTop = 22
  let y = contentTop

  // ── Org block (no logo — text fallback) ──
  const orgName = sanitizeForPdf(data.organizationName).toUpperCase()
  const descriptor = data.companyDescriptor
    ? sanitizeForPdf(data.companyDescriptor).toUpperCase()
    : ''

  doc.setTextColor(...primary)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(orgName, contentLeft, y + 12)

  const ruleY = y + 17
  doc.setDrawColor(...primary)
  doc.setLineWidth(0.5)
  doc.line(contentLeft, ruleY, contentRight, ruleY)

  if (descriptor) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...primary)
    doc.text(descriptor, contentLeft, ruleY + 7)
  }

  y = ruleY + 14

  // ── CPD row ──
  const category = data.cpdCategory || 'Personal Development'
  const hasPoints = !!data.cpdPoints && data.cpdEarned

  if (hasPoints) {
    const pointsStr = String(data.cpdPoints)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(pointsStr, contentLeft, y + 8)

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

  // ── Form fields ──
  const fieldSpacing = 14
  const attendeeLabel = data.attendeeLabel || 'Attendee'

  const drawField = (label, value, fieldY) => {
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

  // Score line
  if (data.totalQuestions !== undefined && data.correctAnswers !== undefined) {
    y += fieldSpacing
    const pct = Math.round((data.correctAnswers / data.totalQuestions) * 100)
    const passed = data.passingScore ? pct >= data.passingScore : pct >= 60
    drawField('Score', `${pct}% (${data.correctAnswers}/${data.totalQuestions})${passed ? ' - Passed' : ''}`, y)
  }

  // ── CPD qualification statement ──
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

  // ── Signature block ──
  const sigBlockY = y + 12

  // Signature line
  const sigLineWidth = 120
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(contentLeft, sigBlockY, contentLeft + sigLineWidth, sigBlockY)

  // Signer name + title below signature line
  if (data.signerName) {
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(sanitizeForPdf(data.signerName), contentLeft, sigBlockY + 6)
    if (data.signerTitle) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(sanitizeForPdf(data.signerTitle), contentLeft, sigBlockY + 11)
    }
  }

  // "Signed on behalf of [Org]" — below signer details
  const signedOnBehalfY = data.signerName ? sigBlockY + (data.signerTitle ? 15 : 10) : sigBlockY + 6
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

// ── Generate sample ──
const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

const sampleData = {
  participantName: 'Johan van der Merwe',
  sessionTitle: 'Advanced Property Law and Conveyancing Updates 2026',
  completionDate: new Date('2026-03-11'),
  organizationName: 'Abrahams & Gross Inc.',
  companyDescriptor: 'Attorneys Notaries Conveyancers',
  primaryColor: '#1a2744',
  cpdPoints: 3,
  cpdEarned: true,
  cpdVerifiable: true,
  cpdCategory: 'Legal Practice',
  attendeeLabel: 'Estate Agent',
  speaker: 'Adv. Jacques Abrahams',
  venue: 'Cape Town International Convention Centre',
  signerName: 'Jacques Abrahams',
  signerTitle: 'Senior Partner',
  websiteUrl: 'www.abgross.co.za',
  totalQuestions: 20,
  correctAnswers: 17,
  passingScore: 60,
  template: 'cpd-professional',
}

drawCpdProfessionalPage(doc, sampleData)

// Page 2: minimal variant (no CPD, no score, no descriptor)
doc.addPage('a4', 'landscape')
const minimalData = {
  participantName: 'Sarah Williams',
  sessionTitle: 'Workplace Safety Training',
  completionDate: new Date('2026-03-11'),
  organizationName: 'Cape Training Solutions',
  primaryColor: '#2d5a3d',
  attendeeLabel: 'Attendee',
  speaker: 'Dr. Mike Johnson',
  venue: 'Stellenbosch Conference Centre',
  signerName: 'Mike Johnson',
  websiteUrl: 'www.capetraining.co.za',
  template: 'cpd-professional',
}
drawCpdProfessionalPage(doc, minimalData)

const output = '/tmp/test-certificate.pdf'
const buffer = Buffer.from(doc.output('arraybuffer'))
fs.writeFileSync(output, buffer)
console.log(`Certificate written to ${output} (2 pages)`)
console.log(`Page size: ${doc.internal.pageSize.getWidth()}mm x ${doc.internal.pageSize.getHeight()}mm`)

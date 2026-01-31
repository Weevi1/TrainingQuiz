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

export const generateAttendanceCertificate = async (data: AttendanceCertificateData): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Resolve colours — fallback to navy/dark-gold if no branding
  const primary = hexToRgb(data.primaryColor || '#1e3a5f')
  const secondary = hexToRgb(data.secondaryColor || '#8b6914')

  // White background (print-friendly)
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // Outer border — org primary colour, 2px, at 10mm margin
  doc.setDrawColor(...primary)
  doc.setLineWidth(2)
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20)

  // Inner border — org secondary colour, 0.5px, at 15mm margin
  doc.setDrawColor(...secondary)
  doc.setLineWidth(0.5)
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30)

  // Corner accents — org secondary colour, 20mm lines at corners of inner border
  const cornerSize = 20
  doc.setDrawColor(...secondary)
  doc.setLineWidth(1.5)

  // Top-left
  doc.line(15, 15, 15 + cornerSize, 15)
  doc.line(15, 15, 15, 15 + cornerSize)
  // Top-right
  doc.line(pageWidth - 15, 15, pageWidth - 15 - cornerSize, 15)
  doc.line(pageWidth - 15, 15, pageWidth - 15, 15 + cornerSize)
  // Bottom-left
  doc.line(15, pageHeight - 15, 15 + cornerSize, pageHeight - 15)
  doc.line(15, pageHeight - 15, 15, pageHeight - 15 - cornerSize)
  // Bottom-right
  doc.line(pageWidth - 15, pageHeight - 15, pageWidth - 15 - cornerSize, pageHeight - 15)
  doc.line(pageWidth - 15, pageHeight - 15, pageWidth - 15, pageHeight - 15 - cornerSize)

  let yPos = 40

  // Organization logo (if provided) — centered, max 50x30mm
  if (data.organizationLogo) {
    try {
      let logoData = data.organizationLogo
      if (logoData.startsWith('http')) {
        const base64 = await loadImageAsBase64(logoData)
        if (base64) logoData = base64
        else logoData = ''
      }
      if (logoData) {
        const logoMaxW = 50
        const logoMaxH = 30
        doc.addImage(logoData, 'AUTO', pageWidth / 2 - logoMaxW / 2, yPos - 5, logoMaxW, logoMaxH)
        yPos += logoMaxH + 8
      }
    } catch {
      // Skip logo on error
    }
  }

  // Title — org primary colour, 32pt bold
  doc.setTextColor(...primary)
  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.text('Certificate of Attendance', pageWidth / 2, yPos, { align: 'center' })

  // Decorative line under title — org secondary colour
  doc.setDrawColor(...secondary)
  doc.setLineWidth(1)
  doc.line(pageWidth / 2 - 60, yPos + 7, pageWidth / 2 + 60, yPos + 7)

  yPos += 23

  // "This is to certify that" — dark gray
  doc.setTextColor(55, 65, 81) // #374151
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', pageWidth / 2, yPos, { align: 'center' })

  yPos += 17

  // Participant Name — org primary colour, 30pt bold
  doc.setTextColor(...primary)
  doc.setFontSize(30)
  doc.setFont('helvetica', 'bold')
  doc.text(data.participantName, pageWidth / 2, yPos, { align: 'center' })

  yPos += 15

  // "attended and participated in" — dark gray
  doc.setTextColor(55, 65, 81) // #374151
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('attended and participated in', pageWidth / 2, yPos, { align: 'center' })

  yPos += 15

  // Session Title — org secondary colour, 22pt bold
  doc.setTextColor(...secondary)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(data.sessionTitle, pageWidth / 2, yPos, { align: 'center' })

  yPos += 18

  // Date — medium gray
  doc.setTextColor(107, 114, 128) // #6b7280
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(data.completionDate), pageWidth / 2, yPos, { align: 'center' })

  yPos += 12

  // Organization name — dark gray
  if (data.organizationName) {
    doc.setTextColor(55, 65, 81) // #374151
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Issued by: ${data.organizationName}`, pageWidth / 2, yPos, { align: 'center' })
  }

  // Footer — light gray, small
  doc.setTextColor(156, 163, 175) // #9ca3af
  doc.setFontSize(8)
  doc.text(
    `Certificate ID: ${generateCertificateId(data)} | Generated by Trained Platform`,
    pageWidth / 2,
    pageHeight - 20,
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

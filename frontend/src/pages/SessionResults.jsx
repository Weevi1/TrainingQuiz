import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Users, TrendingUp, Eye, Trash2, Download } from 'lucide-react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, getDoc, deleteDoc, doc, orderBy, limit, Timestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function SessionResults() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const ENABLE_AUTO_CLEANUP = false // Set to true to enable automatic cleanup

  useEffect(() => {
    // Load sessions first, cleanup in background
    loadSessionResults()
    // Run cleanup in background after a delay to not block UI
    if (ENABLE_AUTO_CLEANUP) {
      setTimeout(() => {
        cleanupOldSessions()
      }, 2000)
    }
  }, [])

  const cleanupOldSessions = async () => {
    try {
      // Delete sessions older than 28 days
      const twentyEightDaysAgo = new Date()
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28)

      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('createdAt', '<', Timestamp.fromDate(twentyEightDaysAgo)),
        limit(10) // Limit cleanup to avoid blocking
      )

      const snapshot = await getDocs(sessionsQuery)

      if (snapshot.empty) {
        console.log('🧹 No old sessions to clean up')
        return
      }

      // Delete in small batches to avoid blocking
      const deletePromises = snapshot.docs.map(sessionDoc =>
        deleteDoc(doc(db, 'sessions', sessionDoc.id))
      )

      await Promise.all(deletePromises)
      console.log('🧹 Cleaned up', deletePromises.length, 'old sessions')
    } catch (error) {
      // Don't let cleanup errors block the UI
      console.warn('Cleanup error (non-blocking):', error)
    }
  }

  const loadSessionResults = async () => {
    try {
      setError(null)
      const trainerId = user?.uid

      if (!trainerId) {
        setError('Please log in to view session results')
        return
      }

      console.log('📊 Loading session results for trainer:', trainerId)

      // Try with createdBy filter first (for newer sessions)
      let sessionsQuery = query(
        collection(db, 'sessions'),
        where('status', '==', 'completed'),
        where('createdBy', '==', trainerId),
        orderBy('createdAt', 'desc'),
        limit(20)
      )

      let sessionsSnapshot = await getDocs(sessionsQuery)

      // If no results with createdBy, fallback to all completed sessions (legacy support)
      if (sessionsSnapshot.empty) {
        console.log('📊 No sessions with createdBy field, loading all completed sessions')
        sessionsQuery = query(
          collection(db, 'sessions'),
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc'),
          limit(30) // Slightly higher limit for legacy
        )
        sessionsSnapshot = await getDocs(sessionsQuery)
      }

      if (sessionsSnapshot.empty) {
        console.log('📊 No sessions found')
        setSessions([])
        return
      }

      // Batch process sessions for better performance
      const sessionsData = await batchProcessSessions(sessionsSnapshot.docs)

      console.log('✅ Loaded', sessionsData.length, 'session results')
      setSessions(sessionsData)
    } catch (error) {
      console.error('Error loading session results:', error)

      // Handle index not ready error
      if (error.message?.includes('index')) {
        console.log('📊 Index not ready, falling back to simple query')
        try {
          const fallbackQuery = query(
            collection(db, 'sessions'),
            where('status', '==', 'completed'),
            limit(30)
          )
          const fallbackSnapshot = await getDocs(fallbackQuery)
          const sessionsData = await batchProcessSessions(fallbackSnapshot.docs)
          setSessions(sessionsData)
          setError(null)
          return
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError)
        }
      }

      setError('Failed to load session results. Please try again.')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  // Optimized batch processing function
  const batchProcessSessions = async (sessionDocs) => {
    const sessionsData = []
    const uniqueQuizIds = new Set()

    // Extract unique quiz IDs for batch loading
    sessionDocs.forEach(doc => {
      const data = doc.data()
      if (data.quizId) {
        uniqueQuizIds.add(data.quizId)
      }
    })

    // Batch load all quiz data
    const quizCache = new Map()
    if (uniqueQuizIds.size > 0) {
      try {
        const quizPromises = Array.from(uniqueQuizIds).map(async (quizId) => {
          try {
            const quizDoc = await getDoc(doc(db, 'quizzes', quizId))
            return [quizId, quizDoc.exists() ? quizDoc.data() : null]
          } catch (error) {
            console.warn('Could not load quiz:', quizId)
            return [quizId, null]
          }
        })

        const quizResults = await Promise.all(quizPromises)
        quizResults.forEach(([quizId, quizData]) => {
          if (quizData) quizCache.set(quizId, quizData)
        })
      } catch (error) {
        console.warn('Error batch loading quizzes:', error)
      }
    }

    // Process sessions with cached quiz data - use Promise.all for parallel processing
    const sessionPromises = sessionDocs.map(async (sessionDoc) => {
      const sessionData = { id: sessionDoc.id, ...sessionDoc.data() }

      // Optimize participant counting - just get count, not all docs
      let participantCount = sessionData.participantCount || 0 // Use cached count if available

      if (!sessionData.participantCount) {
        try {
          // Just count, don't load all participant data
          const participantsSnapshot = await getDocs(
            collection(db, 'sessions', sessionDoc.id, 'participants')
          )
          participantCount = participantsSnapshot.size
        } catch (error) {
          console.warn('Could not count participants for session:', sessionDoc.id)
          participantCount = 0
        }
      }

      const quizData = sessionData.quizId ? quizCache.get(sessionData.quizId) : null
      const quizTitle = quizData?.title || sessionData.quizTitle || 'Unknown Quiz'

      return {
        ...sessionData,
        participantCount,
        quizTitle,
        createdAt: sessionData.createdAt?.toDate?.() || new Date(sessionData.createdAt),
        completedAt: sessionData.completedAt?.toDate?.() || sessionData.createdAt?.toDate?.() || new Date(sessionData.createdAt)
      }
    })

    // Wait for all sessions to be processed in parallel
    const processedSessions = await Promise.all(sessionPromises)
    sessionsData.push(...processedSessions)

    // Already ordered by Firestore query, but ensure sort
    return sessionsData.sort((a, b) => b.completedAt - a.completedAt)
  }

  const deleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }

    try {
      await deleteDoc(doc(db, 'sessions', sessionId))
      // Reload the sessions list
      setSessions(sessions.filter(s => s.id !== sessionId))
      console.log('🗑️ Session deleted successfully')
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Error deleting session. Please try again.')
    }
  }

  const exportSessionReport = async (session) => {
    try {
      console.log('📄 Generating professional training report for session:', session.id)

      // Load session data with proper error handling
      const { participants, quizDetails, stats } = await loadSessionData(session)

      // Create PDF with professional formatting
      const pdf = await createProfessionalPDF(session, participants, quizDetails, stats)

      // Generate filename and save
      const fileName = generateFileName(session)
      pdf.save(fileName)

      console.log('✅ Professional training report generated:', fileName)
    } catch (error) {
      console.error('❌ Error generating training report:', error)
      alert('Error generating training report. Please try again.')
    }
  }

  // Production-level data loading with proper error handling
  const loadSessionData = async (session) => {
    // Get participants
    const participantsQuery = query(collection(db, 'sessions', session.id, 'participants'))
    const participantsSnapshot = await getDocs(participantsQuery)

    // Get quiz details
    let quizDetails = null
    if (session.quizId) {
      try {
        const quizDoc = await getDoc(doc(db, 'quizzes', session.quizId))
        if (quizDoc.exists()) {
          quizDetails = quizDoc.data()
        }
      } catch (error) {
        console.warn('Failed to load quiz details:', error)
      }
    }

    // Get all answers once for efficiency
    const answersQuery = query(collection(db, 'sessions', session.id, 'answers'))
    const answersSnapshot = await getDocs(answersQuery)
    const allAnswers = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Process participants with detailed answer information
    const participants = []
    for (const participantDoc of participantsSnapshot.docs) {
      const participant = participantDoc.data()
      const participantId = participantDoc.id

      // Get this participant's answers
      let participantAnswers = allAnswers.filter(answer =>
        answer.participantId === participantId
      )

      // Deduplicate answers (keep latest per question)
      const uniqueAnswers = deduplicateAnswers(participantAnswers)

      // Map answers to questions for detailed tracking
      const detailedAnswers = uniqueAnswers.map(answer => {
        const questionId = answer.questionId || answer.question_id
        const question = quizDetails?.questions?.find(q => q.id === questionId)

        return {
          ...answer,
          questionText: question?.questionText || answer.questionText || 'Question not found',
          correctAnswer: question?.correctAnswer || answer.correctAnswer || '',
          selectedAnswer: answer.selectedAnswer || answer.answer || '',
          isCorrect: answer.isCorrect,
          timeTaken: answer.timeTaken || 0
        }
      })

      // Get wrong answers for this participant
      const wrongAnswers = detailedAnswers.filter(a => !a.isCorrect)

      // Calculate scores
      const totalQuestions = quizDetails?.questions?.length || Math.max(uniqueAnswers.length, 1)
      const correctAnswers = uniqueAnswers.filter(a => a.isCorrect).length
      const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

      participants.push({
        id: participantId,
        name: participant.name || 'Anonymous',
        completed: participant.completed || false,
        joinedAt: participant.joinedAt,
        score,
        correctAnswers,
        totalQuestions,
        answeredQuestions: uniqueAnswers.length,
        detailedAnswers,
        wrongAnswers
      })
    }

    // Calculate statistics
    const stats = calculateStats(participants)

    return { participants, quizDetails, stats }
  }

  // Deduplicate answers keeping the latest per question
  const deduplicateAnswers = (answers) => {
    const uniqueAnswers = new Map()

    answers
      .sort((a, b) => {
        const aTime = a.answeredAt?.toDate?.() || new Date(a.answeredAt || 0)
        const bTime = b.answeredAt?.toDate?.() || new Date(b.answeredAt || 0)
        return bTime - aTime // Latest first
      })
      .forEach(answer => {
        const questionId = answer.questionId || answer.question_id
        if (questionId && !uniqueAnswers.has(questionId)) {
          uniqueAnswers.set(questionId, answer)
        }
      })

    return Array.from(uniqueAnswers.values())
  }

  // Calculate comprehensive statistics
  const calculateStats = (participants) => {
    const total = participants.length
    const completed = participants.filter(p => p.completed).length
    const scores = participants.map(p => p.score).filter(s => s >= 0)

    return {
      totalParticipants: total,
      completedCount: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0,
      highestScore: Math.max(...scores, 0),
      lowestScore: Math.min(...scores, 0),
      medianScore: calculateMedian(scores)
    }
  }

  const calculateMedian = (scores) => {
    if (scores.length === 0) return 0
    const sorted = [...scores].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }

  // Create professional PDF with proper branding and structure
  const createProfessionalPDF = async (session, participants, quizDetails, stats) => {
    const pdf = new jsPDF('portrait', 'mm', 'a4')

    // Company brand colors (RGB values)
    const colors = {
      gbNavy: [8, 10, 33],        // gb-navy: rgba(8,10,33,1)
      gbGold: [212, 175, 55],     // gb-gold: #d4af37
      gbGoldLight: [230, 197, 90], // gb-gold-light: #e6c55a
      gbGoldDark: [184, 148, 31],  // gb-gold-dark: #b8941f
      white: [255, 255, 255],
      lightGray: [248, 249, 250],
      mediumGray: [229, 231, 235],
      darkGray: [75, 85, 99]
    }

    let yPosition = 15

    // Professional Header with Company Branding
    yPosition = await addProfessionalHeader(pdf, colors, yPosition)
    yPosition += 15

    // Document Title
    yPosition = addDocumentTitle(pdf, colors, yPosition)
    yPosition += 10

    // Training Information Section
    yPosition = addTrainingInfo(pdf, colors, session, quizDetails, yPosition)
    yPosition += 10

    // Performance Analytics Section
    yPosition = addPerformanceAnalytics(pdf, colors, stats, yPosition)
    yPosition += 10

    // Participant Results Table
    yPosition = await addParticipantTable(pdf, colors, participants, yPosition)
    yPosition += 15

    // Add new page for detailed participant analysis
    pdf.addPage()
    yPosition = 15

    // Add detailed participant wrong answers section
    yPosition = await addDetailedParticipantAnalysis(pdf, colors, participants, quizDetails, yPosition)

    // Professional Footer on last page
    await addProfessionalFooter(pdf, colors, session, quizDetails, yPosition)

    return pdf
  }

  // Add clean professional header
  const addProfessionalHeader = async (pdf, colors, yPos) => {
    // Clean header background
    pdf.setFillColor(...colors.gbNavy)
    pdf.rect(15, yPos, 180, 25, 'F')

    // Company name
    pdf.setTextColor(...colors.white)
    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text('GUSTAV BARKHUYSEN LAW', 20, yPos + 12)

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Training Department', 20, yPos + 18)

    // Simple contact info
    pdf.setFontSize(9)
    pdf.text('gblaw.capetown', 175, yPos + 15, { align: 'right' })

    // Gold accent line
    pdf.setFillColor(...colors.gbGold)
    pdf.rect(15, yPos + 25, 180, 2, 'F')

    return yPos + 30
  }

  // Add simple document title
  const addDocumentTitle = (pdf, colors, yPos) => {
    pdf.setTextColor(...colors.gbNavy)
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TRAINING REPORT', 105, yPos + 10, { align: 'center' })

    return yPos + 18
  }

  // Add simplified training information
  const addTrainingInfo = (pdf, colors, session, quizDetails, yPos) => {
    // Simple info box
    pdf.setFillColor(...colors.lightGray)
    pdf.rect(15, yPos, 180, 20, 'F')

    pdf.setTextColor(...colors.gbNavy)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TRAINING DETAILS', 20, yPos + 8)

    const sessionDate = formatProfessionalDate(session.completedAt || session.createdAt)

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Topic: ${session.quizTitle || quizDetails?.title || 'Training Session'}`, 20, yPos + 14)
    pdf.text(`Date: ${sessionDate}`, 100, yPos + 14)
    pdf.text(`Session Code: ${session.sessionCode || 'N/A'}`, 20, yPos + 18)
    pdf.text(`Questions: ${quizDetails?.questions?.length || 'N/A'}`, 100, yPos + 18)

    return yPos + 25
  }

  // Add simplified performance overview
  const addPerformanceAnalytics = (pdf, colors, stats, yPos) => {
    // Simple performance box
    pdf.setFillColor(...colors.lightGray)
    pdf.rect(15, yPos, 180, 25, 'F')

    pdf.setTextColor(...colors.gbNavy)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PERFORMANCE SUMMARY', 20, yPos + 8)

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Total Participants: ${stats.totalParticipants}`, 20, yPos + 16)
    pdf.text(`Completed: ${stats.completedCount}`, 80, yPos + 16)
    pdf.text(`Average Score: ${stats.averageScore}%`, 130, yPos + 16)
    pdf.text(`Highest Score: ${stats.highestScore}%`, 20, yPos + 22)

    return yPos + 30
  }

  // Add simplified participant results table
  const addParticipantTable = async (pdf, colors, participants, yPos) => {
    // Section header
    pdf.setFillColor(...colors.gbGold)
    pdf.rect(15, yPos, 180, 8, 'F')
    pdf.setTextColor(...colors.gbNavy)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PARTICIPANT RESULTS', 20, yPos + 5.5)

    // Prepare simplified table data without status
    const tableData = participants
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .map((participant, index) => [
        index + 1,
        participant.name,
        `${participant.score}%`,
        `${participant.correctAnswers}/${participant.totalQuestions}`
      ])

    // Create clean table without status column
    autoTable(pdf, {
      head: [['Rank', 'Participant Name', 'Score', 'Correct/Total']],
      body: tableData,
      startY: yPos + 10,
      theme: 'grid',
      headStyles: {
        fillColor: colors.gbNavy,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
        textColor: colors.gbNavy
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 25 },
        1: { cellWidth: 85 },
        2: { halign: 'center', cellWidth: 35, fontStyle: 'bold' },
        3: { halign: 'center', cellWidth: 30 }
      },
      margin: { left: 15, right: 15 },
      alternateRowStyles: {
        fillColor: colors.lightGray
      }
    })

    return (pdf.lastAutoTable?.finalY || yPos + 50) + 5
  }

  // Add detailed participant analysis with wrong answers
  const addDetailedParticipantAnalysis = async (pdf, colors, participants, quizDetails, yPos) => {
    // Section header
    pdf.setFillColor(...colors.gbNavy)
    pdf.rect(15, yPos, 180, 12, 'F')
    pdf.setTextColor(...colors.white)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('DETAILED PARTICIPANT ANALYSIS', 20, yPos + 8)
    yPos += 20

    // Subtitle
    pdf.setTextColor(...colors.gbNavy)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'italic')
    pdf.text('Areas Requiring Follow-up Training by Participant', 20, yPos)
    yPos += 10

    // Process each participant
    for (const participant of participants) {
      // Check if we need a new page (leaving space for participant section)
      if (yPos > 240) {
        pdf.addPage()
        yPos = 20
      }

      // Skip participants with perfect scores
      if (!participant.wrongAnswers || participant.wrongAnswers.length === 0) {
        continue
      }

      // Participant header
      pdf.setFillColor(...colors.gbGold)
      pdf.rect(15, yPos, 180, 8, 'F')
      pdf.setTextColor(...colors.gbNavy)
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${participant.name} - Score: ${participant.score}% (${participant.wrongAnswers.length} incorrect answers)`, 20, yPos + 5.5)
      yPos += 12

      // Wrong answers details
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')

      participant.wrongAnswers.forEach((wrongAnswer, index) => {
        // Check for page break
        if (yPos > 260) {
          pdf.addPage()
          yPos = 20
          // Repeat participant name on new page
          pdf.setTextColor(...colors.gbNavy)
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'italic')
          pdf.text(`${participant.name} (continued)`, 20, yPos)
          yPos += 8
        }

        // Question box
        pdf.setDrawColor(...colors.gbGold)
        pdf.setLineWidth(0.3)
        pdf.rect(20, yPos, 170, 20, 'S')

        // Question number and text
        pdf.setTextColor(...colors.gbNavy)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`Q${index + 1}:`, 25, yPos + 5)
        pdf.setFont('helvetica', 'normal')
        const questionLines = pdf.splitTextToSize(wrongAnswer.questionText, 150)
        pdf.text(questionLines, 35, yPos + 5)

        // Correct vs Given answer
        yPos += Math.max(10, questionLines.length * 4)
        pdf.setTextColor(...colors.darkGray)
        pdf.setFontSize(8)

        // Correct answer in green
        pdf.setTextColor(0, 128, 0)
        pdf.text('✓ Correct:', 25, yPos + 3)
        const correctLines = pdf.splitTextToSize(wrongAnswer.correctAnswer || 'N/A', 140)
        pdf.text(correctLines, 45, yPos + 3)

        // Given answer in red
        yPos += Math.max(5, correctLines.length * 3)
        pdf.setTextColor(220, 38, 38)
        pdf.text('✗ Given:', 25, yPos + 3)
        const givenLines = pdf.splitTextToSize(wrongAnswer.selectedAnswer || 'No answer', 140)
        pdf.text(givenLines, 45, yPos + 3)

        yPos += Math.max(8, givenLines.length * 3) + 5
      })

      yPos += 10 // Space between participants
    }

    // Add summary of participants needing follow-up
    const participantsNeedingHelp = participants.filter(p => p.wrongAnswers && p.wrongAnswers.length > 0)

    if (participantsNeedingHelp.length > 0) {
      // Check for page break
      if (yPos > 240) {
        pdf.addPage()
        yPos = 20
      }

      // Summary section
      pdf.setFillColor(...colors.lightGray)
      pdf.rect(15, yPos, 180, 8, 'F')
      pdf.setTextColor(...colors.gbNavy)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text('FOLLOW-UP SUMMARY', 20, yPos + 5.5)
      yPos += 12

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`${participantsNeedingHelp.length} participants require follow-up training:`, 20, yPos)
      yPos += 6

      // List participants needing help
      participantsNeedingHelp
        .sort((a, b) => b.wrongAnswers.length - a.wrongAnswers.length)
        .forEach(p => {
          pdf.setTextColor(...colors.gbNavy)
          const percentage = Math.round((p.wrongAnswers.length / p.totalQuestions) * 100)
          pdf.text(`• ${p.name}: ${p.wrongAnswers.length} questions incorrect (${percentage}% error rate)`, 25, yPos)
          yPos += 5
        })
    } else {
      // All participants got perfect scores
      pdf.setFillColor(...colors.lightGray)
      pdf.rect(15, yPos, 180, 20, 'F')
      pdf.setTextColor(0, 128, 0)
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.text('✓ EXCELLENT PERFORMANCE', 20, yPos + 8)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text('All participants achieved perfect or near-perfect scores!', 20, yPos + 14)
      yPos += 25
    }

    return yPos
  }

  // Add professional footer with disclaimers and branding
  const addProfessionalFooter = async (pdf, colors, session, quizDetails, yPos) => {
    const pageHeight = pdf.internal.pageSize.height
    const totalPages = pdf.internal.getNumberOfPages()

    // Add footer to all pages
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)

      // Professional footer
      const finalFooterY = pageHeight - 20

      // Footer background
      pdf.setFillColor(...colors.gbNavy)
      pdf.rect(0, finalFooterY - 5, 210, 20, 'F')

      // Footer content
      pdf.setTextColor(...colors.gbGold)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')

      // Left side - generation info
      const now = new Date()
      const reportDate = now.toLocaleDateString('en-ZA', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
      const reportTime = now.toLocaleTimeString('en-ZA', {
        hour12: false, hour: '2-digit', minute: '2-digit'
      })

      pdf.text(`Generated: ${reportDate} at ${reportTime}`, 15, finalFooterY)

      // Center - page number
      pdf.text(`Page ${i} of ${totalPages}`, 105, finalFooterY, { align: 'center' })

      // Right side - copyright
      pdf.text('© Gustav Barkhuysen Law', 195, finalFooterY, { align: 'right' })

      // Disclaimer (only on first page)
      if (i === 1) {
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(6)
        pdf.text('This document contains confidential training assessment data. Distribution restricted to authorized personnel.', 105, finalFooterY + 5, { align: 'center' })
      }
    }

    return pageHeight - 5
  }

  // Utility functions for professional date/time formatting
  const formatProfessionalDate = (date) => {
    if (!date) return 'Date not available'
    try {
      const dateObj = date?.toDate ? date.toDate() : new Date(date)
      return dateObj.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (error) {
      return 'Invalid date'
    }
  }

  const formatProfessionalTime = (date) => {
    if (!date) return 'Time not available'
    try {
      const dateObj = date?.toDate ? date.toDate() : new Date(date)
      return dateObj.toLocaleTimeString('en-ZA', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return 'Invalid time'
    }
  }

  // Generate professional filename
  const generateFileName = (session) => {
    const date = new Date()
    const dateStr = date.toISOString().split('T')[0]
    const sessionCode = session.sessionCode || session.id.slice(0, 8)
    return `GB-Training-Report-${sessionCode}-${dateStr}.pdf`
  }

  const formatDate = (date) => {
    if (!date) return 'Unknown'

    try {
      // Handle different date formats
      let dateObj = date
      if (typeof date === 'string') {
        dateObj = new Date(date)
      }
      if (date?.toDate) {
        dateObj = date.toDate()
      }

      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date'
      }

      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      console.warn('Error formatting date:', date, error)
      return 'Invalid Date'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gb-navy flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gb-gold"></div>
          <p className="mt-4 text-gb-gold">Loading session results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gb-navy">
      <header className="bg-gb-navy border-b border-gb-gold/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-gb-gold hover:bg-gb-gold/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <img
                src="/gblogo.png"
                alt="GB Logo"
                className="h-12"
              />
              <div>
                <h1 className="text-3xl font-bold text-gb-gold font-serif">Session Results</h1>
                <p className="text-gb-gold/80 mt-1">Review completed training sessions</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {error ? (
          <div
            className="rounded-lg p-6 text-center border"
            style={{ backgroundColor: 'var(--error-light-color)', borderColor: 'var(--error-border-color)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--error-border-color)' }}
            >
              <TrendingUp className="w-8 h-8" style={{ color: 'var(--error-color)' }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--error-text-color)' }}>Error Loading Results</h2>
            <p className="mb-6" style={{ color: 'var(--error-color)' }}>{error}</p>
            <button
              onClick={() => {
                setError(null)
                setLoading(true)
                loadSessionResults()
              }}
              className="px-6 py-3 rounded-lg font-medium transition-colors"
              style={{ color: 'var(--text-on-primary-color, #ffffff)' }}
              style={{ backgroundColor: 'var(--error-color)' }}
              onMouseOver={(e) => e.target.style.backgroundColor = 'var(--error-hover)'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'var(--error-color)'}
            >
              Try Again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg shadow border border-gb-gold/20 p-12 text-center" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
            <div className="w-16 h-16 bg-gb-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gb-gold/60" />
            </div>
            <h2 className="text-xl font-semibold text-gb-navy mb-2">No Session Results Yet</h2>
            <p className="text-gb-navy/60 mb-6">
              Complete some quiz sessions to see results and analytics here.
            </p>
            <button
              onClick={() => navigate('/admin/quizzes')}
              className="bg-gb-gold text-gb-navy px-6 py-3 rounded-lg hover:bg-gb-gold-light font-medium transition-colors"
            >
              Start a Quiz Session
            </button>
          </div>
        ) : (
          <div className="rounded-lg shadow border border-gb-gold/20 overflow-hidden" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
            <div className="p-6 border-b border-gb-gold/20">
              <h2 className="text-xl font-semibold text-gb-navy font-serif">Recent Sessions</h2>
              <p className="text-gb-navy/70 text-sm mt-1">
                Showing {sessions.length} completed training sessions
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gb-gold/10">
                    <th className="text-left p-4 font-semibold text-gb-navy">Quiz Title</th>
                    <th className="text-left p-4 font-semibold text-gb-navy">Date</th>
                    <th className="text-left p-4 font-semibold text-gb-navy">Participants</th>
                    <th className="text-left p-4 font-semibold text-gb-navy">Session Code</th>
                    <th className="text-left p-4 font-semibold text-gb-navy">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, index) => (
                    <tr key={session.id} className={index % 2 === 0 ? '' : 'bg-gb-gold/5'} style={index % 2 === 0 ? { backgroundColor: 'var(--surface-color, #ffffff)' } : {}}>
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-gb-navy">{session.quizTitle}</div>
                          <div className="text-sm text-gb-navy/60">Session ID: {session.id.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-gb-navy">{formatDate(session.completedAt)}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-gb-navy">
                          <Users className="w-4 h-4" />
                          {session.participantCount || 0}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-gb-navy bg-gb-gold/20 px-2 py-1 rounded text-sm inline-block">
                          {session.sessionCode || 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/admin/results/${session.id}`)}
                            className="p-2 text-gb-navy hover:bg-gb-navy/10 rounded-lg transition-colors"
                            title="View Session Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportSessionReport(session)}
                            className="p-2 text-gb-gold hover:bg-gb-gold/20 rounded-lg transition-colors"
                            title="Export Report"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: 'var(--error-color)' }}
                            onMouseOver={(e) => e.target.style.backgroundColor = 'var(--error-light-color)'}
                            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default SessionResults
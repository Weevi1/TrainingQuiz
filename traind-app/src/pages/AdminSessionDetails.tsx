import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Users, Calendar, HelpCircle, Trophy, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, Zap, Award, ClipboardList } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OrgLogo } from '../components/OrgLogo'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { FirestoreService, type GameSession, type Quiz, type Participant } from '../lib/firestore'
import { generateSessionPDF, generateDetailedAnalysisPDF } from '../lib/pdfExport'
import { calculateSessionAwards } from '../lib/awardCalculator'
import { generateAttendanceRegisterPDF } from '../lib/attendanceRegister'

export const AdminSessionDetails: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { currentOrganization } = useAuth()

  const [session, setSession] = useState<GameSession | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'rank' | 'name' | 'score' | 'time'>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [certProgress, setCertProgress] = useState<{ current: number; total: number } | null>(null)
  const [showCertModal, setShowCertModal] = useState(false)
  const [certSelection, setCertSelection] = useState<Set<string>>(new Set())

  const isBingo = session?.gameType === 'bingo'

  useEffect(() => {
    loadData()
  }, [sessionId, currentOrganization])

  const loadData = async () => {
    if (!sessionId || !currentOrganization) return

    setLoading(true)
    setError(null)
    setSortField('rank')
    setSortDir('asc')
    try {
      const sessionData = await FirestoreService.getSession(sessionId)
      if (!sessionData) {
        setError('Session not found')
        return
      }
      setSession(sessionData)

      // Load quiz: prefer session-time snapshot (immutable), fall back to live quiz (may have been edited)
      if (sessionData.gameData?.quizSnapshot) {
        setQuiz(sessionData.gameData.quizSnapshot as Quiz)
      } else if (sessionData.gameData?.quizId) {
        const quizData = await FirestoreService.getQuiz(currentOrganization.id, sessionData.gameData.quizId)
        setQuiz(quizData)
      }

      const participantList = await FirestoreService.getSessionParticipants(sessionId)
      setParticipants(participantList)
    } catch (err) {
      console.error('Error loading session data:', err)
      setError('Failed to load session data')
    } finally {
      setLoading(false)
    }
  }

  // Process participant data for display
  const processedParticipants = useMemo(() => {
    if (!session) return []

    const processed = participants
      .filter(p => {
        if (isBingo) return p.gameState && p.gameState.gameType === 'bingo'
        return p.gameState && p.gameState.answers && p.gameState.answers.length > 0
      })
      .map(p => {
        if (isBingo) {
          const gs = p.gameState!
          return {
            id: p.id,
            name: p.name,
            score: gs.score || p.finalScore || 0,
            scorePercent: gs.totalCells ? Math.round((gs.cellsMarked || 0) / gs.totalCells * 100) : 0,
            cellsMarked: gs.cellsMarked || 0,
            totalCells: gs.totalCells || 25,
            linesCompleted: gs.linesCompleted || 0,
            fullCard: gs.fullCardAchieved || false,
            bestStreak: gs.bestStreak || 0,
            avgTime: gs.timeSpent || 0,
            answers: [] as Participant['gameState'] extends { answers: infer A } ? A : never[],
            wrongAnswers: [] as { questionIndex: number; questionText: string; givenAnswer: string; correctAnswer: string }[],
            completed: p.completed || gs.completed || false,
            joinedAt: p.joinedAt,
            totalTime: p.totalTime || gs.timeSpent || 0
          }
        }

        const answers = p.gameState!.answers || []
        // Use totalQuestions from session-time gameState (not live quiz, which may have been edited since)
        const totalQuestions = p.gameState!.totalQuestions || quiz?.questions.length || answers.length
        const correctCount = answers.filter(a => a.isCorrect).length
        const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
        const avgTime = answers.length > 0
          ? answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length
          : 0

        // Best streak
        let bestStreak = 0, currentStreak = 0
        for (const a of answers) {
          if (a.isCorrect) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak) }
          else { currentStreak = 0 }
        }

        // Wrong answers with question details
        const wrongAnswers = answers
          .filter(a => !a.isCorrect)
          .map(a => {
            const qIdx = answers.indexOf(a)
            const q = quiz?.questions.find(q => q.id === a.questionId) || quiz?.questions[qIdx]
            return {
              questionIndex: qIdx + 1,
              questionText: q?.questionText || `Question ${qIdx + 1}`,
              givenAnswer: a.selectedAnswer >= 0 ? (q?.options?.[a.selectedAnswer] || 'No answer') : 'No answer',
              correctAnswer: q?.options?.[q?.correctAnswer] || 'N/A'
            }
          })

        return {
          id: p.id,
          name: p.name,
          score: p.gameState!.score || p.finalScore || 0,
          scorePercent,
          correctCount,
          totalQuestions,
          bestStreak,
          avgTime,
          answers,
          wrongAnswers,
          completed: p.completed || p.gameState!.completed || false,
          joinedAt: p.joinedAt,
          totalTime: p.totalTime || 0
        }
      })
      .sort((a, b) => b.score - a.score || a.avgTime - b.avgTime)
      // Assign ranks
      .map((p, idx) => ({ ...p, rank: idx + 1 }))

    return processed
  }, [participants, session, quiz, isBingo])

  // Apply sorting
  const sortedParticipants = useMemo(() => {
    const sorted = [...processedParticipants]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'rank': cmp = a.rank - b.rank; break
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'score': cmp = a.scorePercent - b.scorePercent; break
        case 'time': cmp = a.avgTime - b.avgTime; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [processedParticipants, sortField, sortDir])

  // Stats
  const stats = useMemo(() => {
    if (processedParticipants.length === 0) return { avgScore: 0, totalQuestions: 0 }
    const avgScore = Math.round(
      processedParticipants.reduce((sum, p) => sum + p.scorePercent, 0) / processedParticipants.length
    )
    const totalQuestions = isBingo ? 0 : (quiz?.questions.length || 0)
    return { avgScore, totalQuestions }
  }, [processedParticipants, quiz, isBingo])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 'asc' : 'asc')
    }
  }

  const handleDownloadPDF = async () => {
    if (!session || !currentOrganization) return
    const awardResults = calculateSessionAwards(
      participants,
      quiz?.questions.length || 0
    )
    await generateSessionPDF(
      session,
      quiz,
      participants,
      awardResults,
      currentOrganization.name
    )
  }

  const handleDownloadDetailedAnalysis = async () => {
    if (!session || !quiz || !currentOrganization) return
    await generateDetailedAnalysisPDF(
      session,
      quiz,
      participants,
      currentOrganization.name
    )
  }

  const handleDownloadAttendanceRegister = async () => {
    if (!session || !currentOrganization) return
    await generateAttendanceRegisterPDF(
      session,
      processedParticipants.map(p => ({
        name: p.name,
        joinedAt: p.joinedAt ? new Date(p.joinedAt) : undefined,
        completed: p.completed,
        scorePercent: p.scorePercent,
        totalTime: p.totalTime,
      })),
      currentOrganization.name,
      currentOrganization.branding?.logo
    )
  }

  const openCertModal = () => {
    // Pre-select all participants
    setCertSelection(new Set(processedParticipants.map(p => p.id)))
    setShowCertModal(true)
  }

  const handleDownloadCertificates = async (selectedIds?: Set<string>) => {
    if (!session || !currentOrganization || processedParticipants.length === 0) return

    const targetParticipants = selectedIds
      ? processedParticipants.filter(p => selectedIds.has(p.id))
      : processedParticipants

    if (targetParticipants.length === 0) return

    setShowCertModal(false)

    const { generateMergedCertificatesPDF } = await import('../lib/attendanceCertificate')
    const branding = currentOrganization.branding
    // CPD settings: prefer denormalized session.gameData.cpd, fall back to embedded quiz settings
    const sessionCpd = session.gameData?.cpd as { enabled: boolean; points: number; requiresPass: boolean; passingScore: number; verifiable?: boolean } | undefined
    const quizSettings = session.gameData?.quiz?.settings as { cpdEnabled?: boolean; cpdPoints?: number; cpdRequiresPass?: boolean; cpdVerifiable?: boolean; passingScore?: number } | undefined
    const cpd = sessionCpd ?? (quizSettings?.cpdEnabled ? {
      enabled: true,
      points: quizSettings.cpdPoints || 1,
      requiresPass: quizSettings.cpdRequiresPass || false,
      passingScore: quizSettings.passingScore || 60,
      verifiable: quizSettings.cpdVerifiable || false,
    } : undefined)
    setCertProgress({ current: 0, total: targetParticipants.length })

    const allData = targetParticipants.map(p => {
      const cpdEarned = cpd?.enabled
        ? (cpd.requiresPass ? p.scorePercent >= cpd.passingScore : true)
        : false

      return {
        participantName: p.name,
        sessionTitle: session.title,
        completionDate: session.endTime || session.createdAt || new Date(),
        organizationName: currentOrganization.name,
        organizationLogo: branding?.logo,
        sessionCode: session.code,
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
        signatureImage: branding?.signatureUrl,
        signerName: branding?.signerName,
        signerTitle: branding?.signerTitle,
        template: branding?.certificateTemplate,
        companyDescriptor: branding?.companyDescriptor,
        websiteUrl: branding?.websiteUrl,
        speaker: session.speaker,
        venue: session.venue,
        cpdCategory: session.cpdCategory,
        ...(cpd?.enabled ? {
          cpdPoints: cpd.points,
          cpdRequiresPass: cpd.requiresPass,
          cpdVerifiable: cpd.verifiable,
          cpdEarned
        } : {}),
      }
    })

    try {
      setCertProgress({ current: targetParticipants.length, total: targetParticipants.length })
      const date = new Date().toISOString().split('T')[0]
      await generateMergedCertificatesPDF(allData, `Certificates-${session.code}-${date}.pdf`)
    } catch (err) {
      console.error('Error generating merged certificates:', err)
    }

    setCertProgress(null)
  }

  const getScoreColor = (percent: number) => {
    if (percent >= 80) return '#166534' // green
    if (percent >= 60) return '#854d0e' // yellow/amber
    return '#991b1b' // red
  }

  const getScoreBg = (percent: number) => {
    if (percent >= 80) return '#dcfce7'
    if (percent >= 60) return '#fef9c3'
    return '#fef2f2'
  }

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-text-secondary mb-4">{error || 'Session not found'}</p>
          <button onClick={() => navigate('/sessions')} className="btn-primary">
            Back to Sessions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/sessions')}
                className="p-2 text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <OrgLogo
                logo={currentOrganization?.branding?.logo}
                orgName={currentOrganization?.name}
                size="md"
              />
              <h1 className="text-xl font-bold text-primary">Session Report</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadPDF}
                className="btn-primary flex items-center space-x-2"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Download PDF</span>
              </button>
              {session.gameType !== 'bingo' && quiz && (
                <button
                  onClick={handleDownloadDetailedAnalysis}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)',
                    backgroundColor: 'var(--surface-color)'
                  }}
                >
                  <ClipboardList size={16} />
                  <span className="hidden sm:inline">Detailed Analysis</span>
                </button>
              )}
              <button
                onClick={handleDownloadAttendanceRegister}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--surface-color)'
                }}
              >
                <FileText size={16} />
                <span className="hidden sm:inline">Attendance Register</span>
              </button>
              <button
                onClick={openCertModal}
                disabled={certProgress !== null || processedParticipants.length === 0}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors disabled:opacity-50"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--surface-color)'
                }}
              >
                <Award size={16} />
                <span className="hidden sm:inline">
                  {certProgress
                    ? `Certificates (${certProgress.current}/${certProgress.total})`
                    : 'Certificates'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Session Date</p>
                <p className="text-lg font-bold text-primary">
                  {(session.endTime || session.createdAt)?.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) || 'N/A'}
                </p>
              </div>
              <Calendar className="text-primary" size={24} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Participants</p>
                <p className="text-lg font-bold" style={{ color: 'var(--accent-color)' }}>
                  {processedParticipants.length}
                </p>
              </div>
              <Users size={24} style={{ color: 'var(--accent-color)' }} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Average Score</p>
                <p className="text-lg font-bold" style={{ color: 'var(--success-color)' }}>
                  {stats.avgScore}%
                </p>
              </div>
              <Trophy size={24} style={{ color: 'var(--success-color)' }} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  {isBingo ? 'Game Type' : 'Total Questions'}
                </p>
                <p className="text-lg font-bold" style={{ color: 'var(--info-color)' }}>
                  {isBingo ? 'Bingo' : stats.totalQuestions}
                </p>
              </div>
              <HelpCircle size={24} style={{ color: 'var(--info-color)' }} />
            </div>
          </div>
        </div>

        {/* Session Info Card */}
        <div className="card mb-8">
          <h2 className="text-lg font-bold mb-3">{session.title}</h2>
          {quiz?.description && (
            <p className="text-sm text-text-secondary mb-3">{quiz.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
            <span>Code: <strong style={{ color: 'var(--text-color)' }}>{session.code}</strong></span>
            <span>Type: <strong style={{ color: 'var(--text-color)' }}>{session.gameType === 'quiz' ? 'Quiz' : session.gameType === 'bingo' ? 'Bingo' : session.gameType}</strong></span>
            {session.endTime && (
              <span>Completed: <strong style={{ color: 'var(--text-color)' }}>
                {session.endTime.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </strong></span>
            )}
            {(session.gameData?.cpd?.enabled || session.gameData?.quiz?.settings?.cpdEnabled) && (
              <span>CPD: <strong style={{ color: 'var(--text-color)' }}>
                {session.gameData?.cpd?.points || session.gameData?.quiz?.settings?.cpdPoints || 1} point{(session.gameData?.cpd?.points || session.gameData?.quiz?.settings?.cpdPoints || 1) !== 1 ? 's' : ''} ({(session.gameData?.cpd?.requiresPass || session.gameData?.quiz?.settings?.cpdRequiresPass) ? 'pass required' : 'attendance'})
              </strong></span>
            )}
          </div>
        </div>

        {/* Participant Performance Table */}
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Participant Performance</h2>

          {sortedParticipants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-secondary-color)' }} />
              <h3 className="text-lg font-medium mb-2">No participants</h3>
              <p className="text-text-secondary">
                No participants completed this session.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <SortableHeader label="Rank" field="rank" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Name" field="name" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Score" field="score" current={sortField} dir={sortDir} onSort={handleSort} />
                    {isBingo ? (
                      <>
                        <th className="text-left py-3 px-4 font-medium text-sm">Cells</th>
                        <th className="text-left py-3 px-4 font-medium text-sm">Lines</th>
                        <th className="text-left py-3 px-4 font-medium text-sm">Full Card</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left py-3 px-4 font-medium text-sm">Correct</th>
                        <SortableHeader label="Avg Time" field="time" current={sortField} dir={sortDir} onSort={handleSort} />
                        <th className="text-left py-3 px-4 font-medium text-sm">Streak</th>
                      </>
                    )}
                    <th className="py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParticipants.map(p => (
                    <React.Fragment key={p.id}>
                      <tr
                        className="border-b border-border cursor-pointer"
                        style={{ transition: 'background-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-color)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => setExpandedParticipant(expandedParticipant === p.id ? null : p.id)}
                      >
                        <td className="py-3 px-4 text-center font-medium">{getRankDisplay(p.rank)}</td>
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4">
                          <span
                            className="px-2 py-1 rounded text-sm font-bold"
                            style={{ backgroundColor: getScoreBg(p.scorePercent), color: getScoreColor(p.scorePercent) }}
                          >
                            {p.scorePercent}%
                          </span>
                        </td>
                        {isBingo ? (
                          <>
                            <td className="py-3 px-4 text-sm">{(p as any).cellsMarked}/{(p as any).totalCells}</td>
                            <td className="py-3 px-4 text-sm">{(p as any).linesCompleted}</td>
                            <td className="py-3 px-4 text-sm">{(p as any).fullCard ? '✅' : '—'}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 text-sm">{(p as any).correctCount}/{(p as any).totalQuestions}</td>
                            <td className="py-3 px-4 text-sm">{p.avgTime.toFixed(1)}s</td>
                            <td className="py-3 px-4 text-sm">
                              <span className="flex items-center space-x-1">
                                <Zap size={14} style={{ color: 'var(--warning-color, #f59e0b)' }} />
                                <span>{p.bestStreak}</span>
                              </span>
                            </td>
                          </>
                        )}
                        <td className="py-3 px-4 text-center">
                          {expandedParticipant === p.id
                            ? <ChevronUp size={16} className="text-text-secondary" />
                            : <ChevronDown size={16} className="text-text-secondary" />
                          }
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      {expandedParticipant === p.id && !isBingo && (
                        <tr>
                          <td colSpan={7} className="px-4 py-4" style={{ backgroundColor: 'var(--hover-color)' }}>
                            <ExpandedParticipantDetail participant={p} quiz={quiz} />
                          </td>
                        </tr>
                      )}

                      {expandedParticipant === p.id && isBingo && (
                        <tr>
                          <td colSpan={7} className="px-4 py-4" style={{ backgroundColor: 'var(--hover-color)' }}>
                            <div className="text-sm text-text-secondary">
                              <p><strong>Score:</strong> {p.score} points</p>
                              <p><strong>Best Streak:</strong> {p.bestStreak} cells in a row</p>
                              <p><strong>Time Spent:</strong> {Math.round(p.avgTime)}s</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Certificate Selection Modal */}
      {showCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="w-full max-w-md rounded-xl shadow-2xl max-h-[80vh] flex flex-col"
            style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
              <h3 className="text-lg font-bold">Download Certificates</h3>
              <button
                onClick={() => setShowCertModal(false)}
                className="p-1 rounded-lg hover:opacity-70 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Select/Deselect controls */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary-color)' }}>
                {certSelection.size} of {processedParticipants.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCertSelection(new Set(processedParticipants.map(p => p.id)))}
                  className="px-2 py-1 rounded text-sm hover:opacity-80"
                  style={{ color: 'var(--primary-color)' }}
                >
                  Select All
                </button>
                <button
                  onClick={() => setCertSelection(new Set())}
                  className="px-2 py-1 rounded text-sm hover:opacity-80"
                  style={{ color: 'var(--text-secondary-color)' }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Participant list */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              {processedParticipants
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:opacity-80 transition-colors"
                  style={{
                    backgroundColor: certSelection.has(p.id) ? 'var(--primary-color)10' : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={certSelection.has(p.id)}
                    onChange={() => {
                      setCertSelection(prev => {
                        const next = new Set(prev)
                        if (next.has(p.id)) next.delete(p.id)
                        else next.add(p.id)
                        return next
                      })
                    }}
                    className="rounded"
                  />
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
                    {p.scorePercent}%
                  </span>
                </label>
              ))}
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-2" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => setShowCertModal(false)}
                className="flex-1 py-2 px-4 rounded-lg border font-medium"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDownloadCertificates(certSelection)}
                disabled={certSelection.size === 0}
                className="flex-1 py-2 px-4 rounded-lg font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                Download {certSelection.size === processedParticipants.length
                  ? 'All'
                  : `${certSelection.size}`} Certificate{certSelection.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sortable table header
function SortableHeader({ label, field, current, dir, onSort }: {
  label: string
  field: 'rank' | 'name' | 'score' | 'time'
  current: string
  dir: 'asc' | 'desc'
  onSort: (field: 'rank' | 'name' | 'score' | 'time') => void
}) {
  const isActive = current === field
  return (
    <th
      className="text-left py-3 px-4 font-medium text-sm cursor-pointer select-none"
      onClick={() => onSort(field)}
      style={{ color: isActive ? 'var(--primary-color)' : undefined }}
    >
      <span className="flex items-center space-x-1">
        <span>{label}</span>
        {isActive && (
          <span className="text-xs">{dir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  )
}

// Expanded detail for quiz participants
function ExpandedParticipantDetail({ participant, quiz }: {
  participant: {
    wrongAnswers: { questionIndex: number; questionText: string; givenAnswer: string; correctAnswer: string }[]
    answers: any[]
    scorePercent: number
  }
  quiz: Quiz | null
}) {
  const { wrongAnswers, answers } = participant

  if (wrongAnswers.length === 0) {
    return (
      <div className="flex items-center space-x-2 py-2">
        <Trophy size={18} style={{ color: 'var(--success-color)' }} />
        <span className="font-medium" style={{ color: '#166534' }}>Perfect Score!</span>
        <span className="text-sm text-text-secondary">All questions answered correctly.</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" style={{ color: '#991b1b' }}>
        Areas Requiring Follow-up ({wrongAnswers.length} question{wrongAnswers.length !== 1 ? 's' : ''})
      </p>
      {/* Question-by-question for wrong answers */}
      <div className="space-y-2">
        {wrongAnswers.map((wa, idx) => (
          <div
            key={idx}
            className="rounded-lg p-3 text-sm"
            style={{
              border: '1px solid #fca5a5',
              backgroundColor: 'rgba(254, 242, 242, 0.5)'
            }}
          >
            <p className="font-medium mb-1" style={{ color: 'var(--text-color)' }}>
              Q{wa.questionIndex}: {wa.questionText}
            </p>
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="flex items-center space-x-1">
                <XCircle size={14} style={{ color: '#dc2626' }} />
                <span style={{ color: '#991b1b' }}>Given: {wa.givenAnswer}</span>
              </span>
              <span className="flex items-center space-x-1">
                <CheckCircle size={14} style={{ color: '#16a34a' }} />
                <span style={{ color: '#166534' }}>Correct: {wa.correctAnswer}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Also show correct answers summary */}
      {quiz && answers.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium mb-2" style={{ color: '#166534' }}>
            Correct Answers ({answers.filter((a: any) => a.isCorrect).length})
          </p>
          <div className="space-y-1">
            {answers.filter((a: any) => a.isCorrect).map((a: any, idx: number) => {
              const qIdx = answers.indexOf(a)
              const q = quiz.questions.find(q => q.id === a.questionId) || quiz.questions[qIdx]
              return (
                <div
                  key={idx}
                  className="rounded-lg p-2 text-xs flex items-center space-x-2"
                  style={{
                    border: '1px solid #bbf7d0',
                    backgroundColor: 'rgba(220, 252, 231, 0.5)'
                  }}
                >
                  <CheckCircle size={12} style={{ color: '#16a34a' }} />
                  <span style={{ color: 'var(--text-color)' }}>
                    Q{qIdx + 1}: {q?.questionText || `Question ${qIdx + 1}`}
                  </span>
                  <span className="text-text-secondary">({a.timeSpent.toFixed(1)}s)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

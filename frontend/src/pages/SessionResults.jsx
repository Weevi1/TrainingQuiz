import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Users, TrendingUp, Eye, Trash2, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function SessionResults() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessionResults()
    // Auto-cleanup old sessions on page load
    cleanupOldSessions()
  }, [])

  const cleanupOldSessions = async () => {
    try {
      // Delete sessions older than 28 days
      const twentyEightDaysAgo = new Date()
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28)
      
      const { error } = await supabase
        .from('quiz_sessions')
        .delete()
        .lt('created_at', twentyEightDaysAgo.toISOString())
      
      if (error) console.error('Error cleaning up old sessions:', error)
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  const loadSessionResults = async () => {
    try {
      const trainerId = user?.id
      
      // Get all completed sessions from the last 28 days with quiz info and participant count
      const { data: sessionsData, error } = await supabase
        .from('quiz_sessions')
        .select(`
          *,
          quizzes (
            id,
            title,
            description
          ),
          participants (id)
        `)
        .eq('trainer_id', trainerId)
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString())
        .order('ended_at', { ascending: false })

      if (error) throw error

      // Add participant count and calculate basic stats
      const sessionsWithStats = await Promise.all(
        (sessionsData || []).map(async (session) => {
          // Get participant answers for this session
          const { data: answers } = await supabase
            .from('participant_answers')
            .select(`
              *,
              participants!inner (
                session_id
              )
            `)
            .eq('participants.session_id', session.id)

          // Calculate stats
          const totalAnswers = answers?.length || 0
          const correctAnswers = answers?.filter(a => a.is_correct).length || 0
          const avgScore = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0

          return {
            ...session,
            participantCount: session.participants?.length || 0,
            avgScore,
            totalAnswers
          }
        })
      )

      setSessions(sessionsWithStats)
    } catch (error) {
      console.error('Error loading session results:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) throw error

      // Reload the sessions list
      setSessions(sessions.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Error deleting session. Please try again.')
    }
  }

  const exportSessionReport = async (session) => {
    try {
      // Get detailed session data including participants and answers
      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select(`
          *,
          quizzes (
            id,
            title,
            description,
            questions (*)
          )
        `)
        .eq('id', session.id)
        .single()

      if (sessionError) throw sessionError

      // Get all participant answers with participant info
      const { data: answersData, error: answersError } = await supabase
        .from('participant_answers')
        .select(`
          *,
          participants!inner (
            id,
            name,
            session_id
          ),
          questions!inner (
            id,
            points
          )
        `)
        .eq('participants.session_id', session.id)

      if (answersError) throw answersError

      // Calculate participant results
      const participantStats = {}
      
      answersData?.forEach(answer => {
        const participantId = answer.participants.id
        const participantName = answer.participants.name
        
        if (!participantStats[participantId]) {
          participantStats[participantId] = {
            id: participantId,
            name: participantName,
            correctAnswers: 0,
            totalAnswers: 0,
            totalTime: 0,
            streak: 0,
            currentStreak: 0
          }
        }
        
        participantStats[participantId].totalAnswers++
        participantStats[participantId].totalTime += answer.time_taken || 0
        
        if (answer.is_correct) {
          participantStats[participantId].correctAnswers++
          participantStats[participantId].currentStreak++
          participantStats[participantId].streak = Math.max(participantStats[participantId].streak, participantStats[participantId].currentStreak)
        } else {
          participantStats[participantId].currentStreak = 0
        }
      })

      // Convert to array and calculate final stats
      const participants = Object.values(participantStats).map(participant => ({
        ...participant,
        score: participant.totalAnswers > 0 ? Math.round((participant.correctAnswers / participant.totalAnswers) * 100) : 0,
        avgTime: participant.totalAnswers > 0 ? Math.round(participant.totalTime / participant.totalAnswers) : 0
      })).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.avgTime - b.avgTime
      })

      // Calculate awards
      const awards = {
        speedDemon: participants.length > 0 ? participants.reduce((fastest, p) => p.avgTime < fastest.avgTime ? p : fastest) : null,
        perfectionist: participants.find(p => p.score === 100) || participants[0] || null,
        streakMaster: participants.length > 0 ? participants.reduce((best, p) => p.streak > best.streak ? p : best) : null,
        photoFinish: participants.length >= 2 && Math.abs(participants[0].score - participants[1].score) <= 5 ? participants[1] : null
      }

      const stats = {
        totalParticipants: participants.length,
        avgScore: participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.score, 0) / participants.length) : 0,
        avgTime: participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.avgTime, 0) / participants.length) : 0
      }

      // Generate the report
      generateReport(sessionData, participants, awards, stats)
    } catch (error) {
      console.error('Error exporting session report:', error)
      alert('Error generating report. Please try again.')
    }
  }

  const generateReport = (sessionData, participants, awards, stats) => {
    // Create a printable report in a new window
    const reportWindow = window.open('', '_blank')
    
    // Format the date for the report
    const reportDate = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    const sessionDate = new Date(sessionData.ended_at || sessionData.created_at).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Generate the report HTML
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Training Quiz Report - ${sessionData.quizzes.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Times New Roman', serif; 
            line-height: 1.6; 
            color: #333;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #D4A574;
            padding-bottom: 20px;
          }
          .company-name {
            color: #1E3A8A;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .report-title {
            color: #1E3A8A;
            font-size: 20px;
            margin-bottom: 10px;
          }
          .session-info {
            margin-bottom: 30px;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #D4A574;
          }
          .session-info h3 {
            color: #1E3A8A;
            margin-bottom: 15px;
            font-size: 18px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
          }
          .info-label {
            font-weight: bold;
            color: #1E3A8A;
          }
          .participants-section {
            margin-bottom: 30px;
          }
          .participants-section h3 {
            color: #1E3A8A;
            margin-bottom: 20px;
            font-size: 18px;
            border-bottom: 2px solid #D4A574;
            padding-bottom: 10px;
          }
          .participants-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .participants-table th,
          .participants-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          .participants-table th {
            background-color: #1E3A8A;
            color: white;
            font-weight: bold;
          }
          .participants-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .rank-1 { background-color: #FEF3C7 !important; }
          .rank-2 { background-color: #E5E7EB !important; }
          .rank-3 { background-color: #FECACA !important; }
          .summary-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 30px 0;
          }
          .stat-card {
            text-align: center;
            padding: 20px;
            border: 2px solid #D4A574;
            border-radius: 8px;
            background: #fefefe;
          }
          .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #1E3A8A;
          }
          .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
          }
          .awards-section {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .awards-section h3 {
            color: #1E3A8A;
            margin-bottom: 15px;
            text-align: center;
          }
          .awards-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }
          .award-item {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border: 1px solid #D4A574;
          }
          .award-icon {
            font-size: 24px;
            margin-bottom: 10px;
          }
          .award-title {
            font-weight: bold;
            color: #1E3A8A;
            margin-bottom: 5px;
          }
          .award-winner {
            color: #333;
            font-size: 14px;
          }
          @media print {
            body { padding: 15mm; }
            .header { page-break-after: avoid; }
            .participants-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Gustav Barkhuysen Attorneys</div>
          <div class="report-title">Training Quiz Report</div>
          <div style="color: #666; margin-top: 10px;">Generated on ${reportDate}</div>
        </div>

        <div class="session-info">
          <h3>Session Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Training Topic:</span>
              <span>${sessionData.quizzes.title}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Session Date:</span>
              <span>${sessionDate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Session Code:</span>
              <span>${sessionData.session_code}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total Questions:</span>
              <span>${sessionData.quizzes.questions?.length || 0}</span>
            </div>
          </div>
          ${sessionData.quizzes.description ? `
            <div style="margin-top: 15px;">
              <div class="info-label">Description:</div>
              <div style="margin-top: 5px;">${sessionData.quizzes.description}</div>
            </div>
          ` : ''}
        </div>

        <div class="summary-stats">
          <div class="stat-card">
            <div class="stat-value">${stats.totalParticipants}</div>
            <div class="stat-label">Participants</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.avgScore}%</div>
            <div class="stat-label">Average Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.avgTime}s</div>
            <div class="stat-label">Average Time</div>
          </div>
        </div>

        <div class="awards-section">
          <h3>🏆 Performance Recognition</h3>
          <div class="awards-grid">
            <div class="award-item">
              <div class="award-icon">⚡</div>
              <div class="award-title">Speed Demon</div>
              <div class="award-winner">${awards.speedDemon?.name || 'N/A'}</div>
              <div style="font-size: 12px; color: #666;">${awards.speedDemon?.avgTime || '--'}s avg</div>
            </div>
            <div class="award-item">
              <div class="award-icon">🎯</div>
              <div class="award-title">Perfectionist</div>
              <div class="award-winner">${awards.perfectionist?.name || 'N/A'}</div>
              <div style="font-size: 12px; color: #666;">${awards.perfectionist?.score || 0}% score</div>
            </div>
            <div class="award-item">
              <div class="award-icon">🔥</div>
              <div class="award-title">Streak Master</div>
              <div class="award-winner">${awards.streakMaster?.name || 'N/A'}</div>
              <div style="font-size: 12px; color: #666;">${awards.streakMaster?.streak || 0} in a row</div>
            </div>
            <div class="award-item">
              <div class="award-icon">🏁</div>
              <div class="award-title">Photo Finish</div>
              <div class="award-winner">${awards.photoFinish?.name || 'N/A'}</div>
              <div style="font-size: 12px; color: #666;">Close competition!</div>
            </div>
          </div>
        </div>

        <div class="participants-section">
          <h3>Participant Results</h3>
          <table class="participants-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant Name</th>
                <th>Score</th>
                <th>Correct Answers</th>
                <th>Average Time</th>
                <th>Best Streak</th>
              </tr>
            </thead>
            <tbody>
              ${participants.map((participant, index) => `
                <tr class="${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}">
                  <td style="text-align: center; font-weight: bold;">
                    ${index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `#${index + 1}`}
                  </td>
                  <td>${participant.name}</td>
                  <td style="text-align: center; font-weight: bold;">${participant.score}%</td>
                  <td style="text-align: center;">${participant.correctAnswers}/${participant.totalAnswers}</td>
                  <td style="text-align: center;">${participant.avgTime}s</td>
                  <td style="text-align: center;">${participant.streak}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p><strong>Gustav Barkhuysen Attorneys</strong> | Training Department</p>
          <p>This report was automatically generated from the training quiz system.</p>
          <p>Report generated on ${reportDate}</p>
        </div>
      </body>
      </html>
    `

    reportWindow.document.write(reportHTML)
    reportWindow.document.close()
    
    // Focus the new window and trigger print dialog
    reportWindow.focus()
    setTimeout(() => {
      reportWindow.print()
    }, 500)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getDaysAgo = (dateString) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
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
            <h1 className="text-3xl font-bold text-gb-gold font-serif">Session Results</h1>
          </div>
          <p className="text-gb-gold/80 mt-2">Review quiz session results from the last 28 days</p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {sessions.length === 0 ? (
          <div className="bg-white/95 rounded-lg shadow border border-gb-gold/20 p-8 text-center">
            <Calendar className="w-16 h-16 text-gb-gold/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gb-navy mb-2">No Session Results</h2>
            <p className="text-gb-navy/70">
              No completed quiz sessions found in the last 28 days.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white/95 rounded-lg shadow border border-gb-gold/20 p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gb-navy font-serif">
                          {session.quizzes?.title}
                        </h3>
                        <p className="text-gb-navy/70 mt-1">
                          {session.quizzes?.description}
                        </p>
                        
                        <div className="flex items-center gap-6 mt-4 text-sm text-gb-navy/80">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(session.ended_at)} • {getDaysAgo(session.ended_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{session.participantCount} participants</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            <span>{session.avgScore}% avg score</span>
                          </div>
                        </div>
                        
                        <div className="mt-3 px-3 py-1 bg-gb-gold/20 text-gb-navy text-xs rounded-full inline-block">
                          Session Code: {session.session_code}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => navigate(`/admin/results/${session.id}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    <button
                      onClick={() => exportSessionReport(session)}
                      className="flex items-center gap-2 px-4 py-2 bg-gb-navy text-gb-gold border border-gb-gold rounded-lg hover:bg-gb-navy/80 font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export Report
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 bg-white/95 rounded-lg shadow border border-gb-gold/20 p-6">
          <h3 className="text-lg font-semibold text-gb-navy font-serif mb-3">📋 Data Retention Policy</h3>
          <div className="text-gb-navy/80 space-y-2 text-sm">
            <p>• <strong>Session Results:</strong> Automatically deleted after 28 days</p>
            <p>• <strong>Quiz Templates:</strong> Kept permanently (delete manually if needed)</p>
            <p>• <strong>Participant Data:</strong> Removed with session deletion</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SessionResults
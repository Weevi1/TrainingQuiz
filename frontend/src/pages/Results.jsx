import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy, Zap, Target, TrendingUp, Medal, Clock, Star, Award, Crown } from 'lucide-react'
import { db } from '../lib/firebase'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'

function Results() {
  const { sessionId } = useParams()
  const [results, setResults] = useState(null)

  useEffect(() => {
    loadResults()
  }, [sessionId])

  const loadResults = async () => {
    try {
      console.log('📊 Loading results for session:', sessionId)

      // Get session data from Firebase
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId))
      if (!sessionDoc.exists()) {
        throw new Error('Session not found')
      }
      const sessionData = { id: sessionDoc.id, ...sessionDoc.data() }

      console.log('✅ Session data loaded:', sessionData.sessionCode)

      // Get all answers for this session
      const answersQuery = query(collection(db, 'sessions', sessionId, 'answers'))
      const answersSnapshot = await getDocs(answersQuery)
      const answersData = answersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      console.log('✅ Loaded', answersData.length, 'answers')

      // Group answers by participant and sort them properly
      const participantStats = {}
      const answersByParticipant = {}

      // First, group all answers by participant
      answersData.forEach(answer => {
        const participantId = answer.participantId
        const participantName = answer.participantName

        if (!participantStats[participantId]) {
          participantStats[participantId] = {
            id: participantId,
            name: participantName,
            correctAnswers: 0,
            totalAnswers: 0,
            totalTime: 0,
            streak: 0,
            times: [],
            answers: []
          }
          answersByParticipant[participantId] = []
        }

        answersByParticipant[participantId].push(answer)
      })

      // Process each participant's answers in correct order
      Object.keys(participantStats).forEach(participantId => {
        const participant = participantStats[participantId]

        // Sort answers by answeredAt timestamp to ensure consistent order
        const sortedAnswers = answersByParticipant[participantId].sort((a, b) => {
          const aTime = a.answeredAt?.toDate?.() || new Date(a.answeredAt || 0)
          const bTime = b.answeredAt?.toDate?.() || new Date(b.answeredAt || 0)
          return aTime - bTime
        })

        // Now calculate stats in correct order
        let currentStreak = 0
        let maxStreak = 0

        sortedAnswers.forEach(answer => {
          participant.totalAnswers++
          participant.totalTime += answer.timeTaken || 0
          participant.times.push(answer.timeTaken || 0)
          participant.answers.push(answer)

          if (answer.isCorrect) {
            participant.correctAnswers++
            currentStreak++
            maxStreak = Math.max(maxStreak, currentStreak)
          } else {
            currentStreak = 0
          }
        })

        participant.streak = maxStreak
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

      console.log('✅ Calculated stats for', participants.length, 'participants')

      // Calculate awards
      const awards = {
        speedDemon: participants.length > 0 ? participants.reduce((fastest, p) => p.avgTime < fastest.avgTime ? p : fastest) : null,
        perfectionist: participants.find(p => p.score === 100) || participants[0] || null,
        streakMaster: participants.length > 0 ? participants.reduce((best, p) => p.streak > best.streak ? p : best) : null,
        photoFinish: participants.length >= 2 && Math.abs(participants[0].score - participants[1].score) <= 5 ? participants[1] : null
      }

      setResults({
        session: sessionData,
        participants,
        awards,
        stats: {
          totalParticipants: participants.length,
          avgScore: participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.score, 0) / participants.length) : 0,
          avgTime: participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.avgTime, 0) / participants.length) : 0
        }
      })

      console.log('🎉 Results loaded successfully')
    } catch (error) {
      console.error('💥 Error loading results:', error)
    }
  }


  if (!results) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--secondary-color), var(--primary-color-dark, var(--primary-color)))' }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mx-auto mb-6"
            style={{ borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }}
          ></div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Calculating Results...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-screen h-screen relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--secondary-color), var(--primary-color-dark, var(--primary-color)))' }}
    >

      {/* Header - Mobile Optimized */}
      <header className="bg-gb-navy/95 backdrop-blur-sm shadow-lg flex-shrink-0 z-10">
        <div className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
            {/* Mobile: Logo above title */}
            <div className="flex items-center justify-center sm:justify-start w-full sm:w-auto order-1 sm:order-1">
              <a
                href="https://gblaw.capetown/"
                className="hover:opacity-90 transition-opacity duration-300"
              >
                <img
                  src="/gblogo.png"
                  alt="Gustav Barkhuysen Attorneys"
                  className="h-8 sm:h-10"
                />
              </a>
            </div>

            {/* Mobile: Title below logo */}
            <div className="flex items-center gap-2 sm:gap-3 order-2 sm:order-2">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-gb-gold" />
              <h1 className="text-lg sm:text-xl lg:text-3xl font-bold text-gb-gold font-serif text-center">
                Results
              </h1>
            </div>

            {/* Balance spacer */}
            <div className="hidden sm:block w-8 lg:w-10"></div>
          </div>
        </div>
      </header>

      {/* Main Content - Premium Mobile First Layout with Viewport Constraints */}
      <main className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 h-full max-h-full">

          {/* Mobile First: Leaderboard */}
          <div className="order-1 lg:col-span-2 min-h-0 flex flex-col">
            <div className="backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-gb-gold/40 p-4 sm:p-6 flex flex-col flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gb-navy mb-4 sm:mb-6 text-center font-serif flex-shrink-0">
                🏆 FINAL LEADERBOARD 🏆
              </h2>

              <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gb-gold/30 scrollbar-track-transparent">
                {results.participants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 shadow-lg transition-all hover:shadow-xl touch-manipulation"
                    style={
                      index === 0
                        ? { background: 'linear-gradient(to right, rgba(var(--accent-color-rgb, 212, 175, 55), 0.4), rgba(var(--accent-color-rgb, 212, 175, 55), 0.3), rgba(var(--accent-color-rgb, 212, 175, 55), 0.2))', borderColor: 'var(--accent-color)', boxShadow: '0 10px 15px -3px rgba(var(--accent-color-rgb, 212, 175, 55), 0.5)' }
                        : index === 1
                        ? { background: 'linear-gradient(to right, rgba(156, 163, 175, 0.4), rgba(229, 231, 235, 0.3), rgba(255, 255, 255, 0.9))', borderColor: '#9ca3af', boxShadow: '0 10px 15px -3px rgba(156, 163, 175, 0.3)' }
                        : index === 2
                        ? { background: 'linear-gradient(to right, rgba(var(--celebration-color-rgb, 251, 146, 60), 0.4), rgba(var(--celebration-color-rgb, 251, 146, 60), 0.3), rgba(255, 255, 255, 0.9))', borderColor: 'var(--celebration-color, #fb923c)', boxShadow: '0 10px 15px -3px rgba(var(--celebration-color-rgb, 251, 146, 60), 0.3)' }
                        : { background: 'linear-gradient(to right, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9))', borderColor: 'rgba(var(--accent-color-rgb, 212, 175, 55), 0.3)', boxShadow: '0 10px 15px -3px rgba(var(--accent-color-rgb, 212, 175, 55), 0.2)' }
                    }
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-xl sm:text-2xl flex-shrink-0"
                        style={
                          index === 0
                            ? { backgroundColor: 'var(--accent-color)', color: 'var(--primary-color)' }
                            : index === 1
                            ? { backgroundColor: '#9ca3af', color: 'white' }
                            : index === 2
                            ? { backgroundColor: 'var(--celebration-color, #fb923c)', color: 'white' }
                            : { backgroundColor: 'var(--primary-color)', color: 'var(--accent-color)' }
                        }
                      >
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base sm:text-lg lg:text-xl text-gb-navy truncate">{participant.name}</span>
                          {index === 0 && <span className="text-lg sm:text-xl">👑</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gb-navy/70">
                          <span>⏱️ {participant.avgTime}s avg</span>
                          <span>🔥 {participant.streak} streak</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-1">
                      <span className="text-gb-navy font-bold text-2xl sm:text-3xl">{participant.score}%</span>
                      <span className="text-gb-navy/60 text-xs font-medium uppercase tracking-wide">Score</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile First: Awards & Stats */}
          <div className="order-2 lg:order-3 flex flex-col gap-4 sm:gap-6 min-h-0 max-h-full lg:overflow-hidden">
            {/* Awards */}
            <div className="backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-gb-gold/40 p-4 flex flex-col flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
              <h3 className="text-lg font-bold text-center mb-4 text-gb-navy font-serif flex-shrink-0">
                🏅 Performance Awards
              </h3>

              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gb-gold/30 scrollbar-track-transparent">
                <div className="space-y-4">
                {/* Speed Demon */}
                <div
                  className="backdrop-blur-sm rounded-xl border shadow-lg p-4 flex items-center gap-4 transition-all hover:shadow-xl"
                  style={{ background: 'linear-gradient(to bottom right, rgba(var(--accent-color-rgb, 212, 175, 55), 0.2), rgba(var(--accent-color-rgb, 212, 175, 55), 0.1), rgba(255, 255, 255, 0.9))', borderColor: 'rgba(var(--accent-color-rgb, 212, 175, 55), 0.3)' }}
                >
                  <div className="text-3xl">⚡</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gb-navy mb-1 uppercase tracking-wide">SPEED DEMON</div>
                    <div className="text-xs text-gb-navy/70 mb-2">Fastest average response time</div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gb-navy/80">{results.awards.speedDemon?.name || 'N/A'}</div>
                      <div
                        className="text-xs text-gb-navy px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(var(--accent-color-rgb, 212, 175, 55), 0.3)' }}
                      >{results.awards.speedDemon?.avgTime || '--'}s</div>
                    </div>
                  </div>
                </div>

                {/* Perfectionist */}
                <div
                  className="backdrop-blur-sm rounded-xl border shadow-lg p-4 flex items-center gap-4 transition-all hover:shadow-xl"
                  style={{ background: 'linear-gradient(to bottom right, rgba(var(--secondary-color-rgb, 96, 165, 250), 0.3), rgba(var(--secondary-color-rgb, 96, 165, 250), 0.2), rgba(255, 255, 255, 0.9))', borderColor: 'rgba(var(--secondary-color-rgb, 96, 165, 250), 0.4)' }}
                >
                  <div className="text-3xl">🎯</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gb-navy mb-1 uppercase tracking-wide">PERFECTIONIST</div>
                    <div className="text-xs text-gb-navy/70 mb-2">Highest score achieved</div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gb-navy/80">{results.awards.perfectionist?.name || 'N/A'}</div>
                      <div
                        className="text-xs text-gb-navy px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(var(--secondary-color-rgb, 96, 165, 250), 0.4)' }}
                      >{results.awards.perfectionist?.score || 0}%</div>
                    </div>
                  </div>
                </div>

                {/* Streak Master */}
                <div
                  className="backdrop-blur-sm rounded-xl border shadow-lg p-4 flex items-center gap-4 transition-all hover:shadow-xl"
                  style={{ background: 'linear-gradient(to bottom right, rgba(var(--celebration-color-rgb, 251, 146, 60), 0.3), rgba(var(--celebration-color-rgb, 251, 146, 60), 0.2), rgba(255, 255, 255, 0.9))', borderColor: 'rgba(var(--celebration-color-rgb, 251, 146, 60), 0.4)' }}
                >
                  <div className="text-3xl">🔥</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gb-navy mb-1 uppercase tracking-wide">STREAK MASTER</div>
                    <div className="text-xs text-gb-navy/70 mb-2">Most consecutive correct answers</div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gb-navy/80">{results.awards.streakMaster?.name || 'N/A'}</div>
                      <div
                        className="text-xs text-gb-navy px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(var(--celebration-color-rgb, 251, 146, 60), 0.4)' }}
                      >{results.awards.streakMaster?.streak || 0} in a row</div>
                    </div>
                  </div>
                </div>

                {/* Photo Finish */}
                <div
                  className="backdrop-blur-sm rounded-xl border shadow-lg p-4 flex items-center gap-4 transition-all hover:shadow-xl"
                  style={{ background: 'linear-gradient(to bottom right, rgba(var(--primary-color-rgb, 147, 51, 234), 0.3), rgba(var(--primary-color-rgb, 147, 51, 234), 0.2), rgba(255, 255, 255, 0.9))', borderColor: 'rgba(var(--primary-color-rgb, 147, 51, 234), 0.4)' }}
                >
                  <div className="text-3xl">🏁</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gb-navy mb-1 uppercase tracking-wide">PHOTO FINISH</div>
                    <div className="text-xs text-gb-navy/70 mb-2">Close competition (within 5% of winner)</div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gb-navy/80">{results.awards.photoFinish?.name || 'N/A'}</div>
                      <div
                        className="text-xs text-gb-navy px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(var(--primary-color-rgb, 147, 51, 234), 0.4)' }}
                      >Close call</div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

export default Results
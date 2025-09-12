import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy, Zap, Target, TrendingUp, Medal, Clock, Star, Award, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'

function Results() {
  const { sessionId } = useParams()
  const [results, setResults] = useState(null)

  useEffect(() => {
    loadResults()
  }, [sessionId])

  const loadResults = async () => {
    try {
      // Get session with quiz data
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
        .eq('id', sessionId)
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
        .eq('participants.session_id', sessionId)

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
            currentStreak: 0,
            scores: [],
            times: []
          }
        }
        
        participantStats[participantId].totalAnswers++
        participantStats[participantId].totalTime += answer.time_taken || 0
        participantStats[participantId].times.push(answer.time_taken || 0)
        
        if (answer.is_correct) {
          participantStats[participantId].correctAnswers++
          participantStats[participantId].currentStreak++
          participantStats[participantId].streak = Math.max(participantStats[participantId].streak, participantStats[participantId].currentStreak)
        } else {
          participantStats[participantId].currentStreak = 0
        }
        
        participantStats[participantId].scores.push(answer.is_correct ? 1 : 0)
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
    } catch (error) {
      console.error('Error loading results:', error)
    }
  }


  if (!results) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-6"></div>
          <p className="text-white text-2xl font-bold">🏆 Calculating Results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-gb-navy relative overflow-hidden flex flex-col">

      {/* Header */}
      <header className="bg-gb-navy shadow-lg flex-shrink-0">
        <div className="w-full px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            {/* Left side - GB Logo */}
            <a 
              href="https://gblaw.capetown/" 
              className="hover:opacity-90 transition-opacity duration-300"
            >
              <img 
                src="/gblogo.png" 
                alt="Gustav Barkhuysen Attorneys" 
                className="h-8 lg:h-10"
              />
            </a>
            
            {/* Center - Title */}
            <div className="flex items-center gap-2 lg:gap-3">
              <Trophy className="w-6 h-6 lg:w-8 lg:h-8 text-gb-gold" />
              <h1 className="text-xl lg:text-3xl font-bold text-gb-gold font-serif">
                {results.session.quizzes.title} - Results
              </h1>
            </div>
            
            {/* Right side - Empty for balance */}
            <div className="w-8 lg:w-10"></div>
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Layout */}
      <main className="w-full px-4 lg:px-6 py-4 lg:py-6 flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 h-full max-h-full">
          
          {/* Left Column: Leaderboard */}
          <div className="lg:col-span-2 min-h-0">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gb-gold/40 p-4 lg:p-6 h-full flex flex-col">
              <h2 className="text-xl lg:text-3xl font-bold text-gb-navy mb-4 lg:mb-6 text-center flex-shrink-0 font-serif">
                🏆 FINAL LEADERBOARD 🏆
              </h2>
              
              <div className="space-y-2 lg:space-y-3 overflow-y-auto flex-1 min-h-0">
                {results.participants.map((participant, index) => (
                  <div key={participant.id} className={`flex items-center justify-between p-3 lg:p-4 rounded-xl border-2 shadow-lg ${
                    index === 0 ? 'bg-gradient-to-r from-gb-gold/30 via-gb-gold/20 to-gb-gold/10 border-gb-gold' :
                    index === 1 ? 'bg-gradient-to-r from-gb-gold/20 via-gb-gold/10 to-white/90 border-gb-gold/60' :
                    index === 2 ? 'bg-gradient-to-r from-gb-gold/10 via-white/90 to-white/80 border-gb-gold/40' :
                    'bg-gradient-to-r from-white/90 to-gray-50/90 border-gb-gold/20'
                  }`}>
                    <div className="flex items-center gap-2 lg:gap-4 min-w-0">
                      <span className="font-bold text-xl lg:text-3xl flex-shrink-0 text-gb-navy">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                      <span className="font-bold text-lg lg:text-2xl text-gb-navy truncate">{participant.name}</span>
                      {index === 0 && <span className="text-lg">👑</span>}
                    </div>
                    <div className="flex items-center gap-2 lg:gap-6 flex-shrink-0">
                      <span className="text-gb-navy font-bold text-lg lg:text-2xl">{participant.score}%</span>
                      <span className="text-gb-navy/80 font-semibold text-sm lg:text-lg hidden sm:inline">{participant.avgTime}s</span>
                      <span className="text-gb-navy/80 font-semibold text-sm lg:text-lg hidden md:inline">🔥 {participant.streak}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Awards & Stats */}
          <div className="flex flex-col gap-3 lg:gap-4 min-h-0 max-h-full">
            {/* Awards */}
            <div className="bg-gradient-to-br from-gb-gold/20 via-gb-gold/10 to-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gb-gold/50 p-3 lg:p-4 flex-1 min-h-0">
              <h3 className="text-lg lg:text-xl font-bold text-center mb-3 lg:mb-4 text-gb-navy flex-shrink-0 font-serif">
                🏅 PERFORMANCE AWARDS 🏅
              </h3>
              
              <div className="grid grid-cols-2 gap-2 text-center overflow-y-auto">
                <div className="bg-gradient-to-br from-gb-gold/30 to-gb-gold/10 rounded-lg p-3 border-2 border-gb-gold/50 shadow-lg">
                  <div className="text-2xl mb-1 animate-bounce">⚡</div>
                  <div className="text-xs font-bold text-gb-navy">SPEED DEMON</div>
                  <div className="text-xs text-gb-navy/90 font-semibold truncate">{results.awards.speedDemon?.name || 'N/A'}</div>
                  <div className="text-xs text-gb-navy/70 font-medium">{results.awards.speedDemon?.avgTime || '--'}s</div>
                </div>
                
                <div className="bg-gradient-to-br from-gb-gold/30 to-gb-gold/10 rounded-lg p-3 border-2 border-gb-gold/50 shadow-lg">
                  <div className="text-2xl mb-1 animate-bounce">🎯</div>
                  <div className="text-xs font-bold text-gb-navy">PERFECTIONIST</div>
                  <div className="text-xs text-gb-navy/90 font-semibold truncate">{results.awards.perfectionist?.name || 'N/A'}</div>
                  <div className="text-xs text-gb-navy/70 font-medium">{results.awards.perfectionist?.score || 0}%</div>
                </div>
                
                <div className="bg-gradient-to-br from-gb-gold/30 to-gb-gold/10 rounded-lg p-3 border-2 border-gb-gold/50 shadow-lg">
                  <div className="text-2xl mb-1 animate-bounce">🔥</div>
                  <div className="text-xs font-bold text-gb-navy">STREAK MASTER</div>
                  <div className="text-xs text-gb-navy/90 font-semibold truncate">{results.awards.streakMaster?.name || 'N/A'}</div>
                  <div className="text-xs text-gb-navy/70 font-medium">{results.awards.streakMaster?.streak || 0} row</div>
                </div>
                
                <div className="bg-gradient-to-br from-gb-gold/30 to-gb-gold/10 rounded-lg p-3 border-2 border-gb-gold/50 shadow-lg">
                  <div className="text-2xl mb-1 animate-bounce">🏁</div>
                  <div className="text-xs font-bold text-gb-navy">PHOTO FINISH</div>
                  <div className="text-xs text-gb-navy/90 font-semibold truncate">{results.awards.photoFinish?.name || 'N/A'}</div>
                  <div className="text-xs text-gb-navy/70 font-medium">Epic!</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gb-gold/30 p-3 lg:p-4 flex-1 min-h-0">
              <h3 className="text-lg lg:text-xl font-bold text-center mb-3 lg:mb-4 text-gb-navy flex-shrink-0 font-serif">📈 SESSION ANALYTICS</h3>
              
              <div className="space-y-2 overflow-y-auto flex-1">
                <div className="flex justify-between items-center p-3 bg-gb-gold/10 rounded-lg border border-gb-gold/30">
                  <span className="text-gb-navy text-sm font-semibold">👥 Participants:</span>
                  <span className="text-gb-navy font-bold text-lg">{results.stats.totalParticipants}</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gb-gold/10 rounded-lg border border-gb-gold/30">
                  <span className="text-gb-navy text-sm font-semibold">🎯 Avg Score:</span>
                  <span className="text-gb-navy font-bold text-lg">{results.stats.avgScore}%</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gb-gold/10 rounded-lg border border-gb-gold/30">
                  <span className="text-gb-navy text-sm font-semibold">⚡ Avg Time:</span>
                  <span className="text-gb-navy font-bold text-lg">{results.stats.avgTime}s</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gb-gold/10 rounded-lg border border-gb-gold/30">
                  <span className="text-gb-navy text-sm font-semibold">❓ Questions:</span>
                  <span className="text-gb-navy font-bold text-lg">{results.session.quizzes.questions?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Thank You */}
            <div className="bg-gb-gold rounded-xl shadow-lg p-4 lg:p-6 text-center flex-shrink-0">
              <div className="text-2xl lg:text-3xl mb-3">🎉</div>
              <h3 className="text-lg lg:text-2xl font-bold text-gb-navy mb-2 font-serif">Outstanding Performance!</h3>
              <p className="text-gb-navy/90 text-sm lg:text-base font-medium">Congratulations to all participants!</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Results
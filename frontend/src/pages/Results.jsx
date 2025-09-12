import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Trophy, Zap, Target, TrendingUp, Medal, Clock, Star, Award, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gameShowSounds } from '../lib/gameShowSounds'

function Results() {
  const { sessionId } = useParams()
  const [results, setResults] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(true)

  useEffect(() => {
    loadResults()
    // 🎵 Play victory theme when results load!
    setTimeout(() => gameShowSounds.playQuizComplete(), 500)
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

      if (sessionError) {
        throw sessionError
      }

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

      if (answersError) {
        throw answersError
      }

      // Calculate participant stats
      const participantStats = {}
      
      answersData?.forEach(answer => {
        const participantId = answer.participants.id
        const participantName = answer.participants.name
        
        if (!participantStats[participantId]) {
          participantStats[participantId] = {
            id: participantId,
            name: participantName,
            score: 0,
            correct: 0,
            total: 0,
            totalTime: 0,
            answers: []
          }
        }
        
        participantStats[participantId].total++
        participantStats[participantId].totalTime += answer.time_taken || 0
        participantStats[participantId].answers.push(answer)
        
        if (answer.is_correct) {
          participantStats[participantId].correct++
          participantStats[participantId].score += answer.questions.points || 1
        }
      })

      // Calculate final stats and streaks
      const participants = Object.values(participantStats).map(participant => {
        const percentage = participant.total > 0 ? Math.round((participant.correct / participant.total) * 100) : 0
        const avgTime = participant.total > 0 ? Math.round(participant.totalTime / participant.total) : 0
        
        // Calculate streak (consecutive correct answers)
        let maxStreak = 0
        let currentStreak = 0
        participant.answers.forEach(answer => {
          if (answer.is_correct) {
            currentStreak++
            maxStreak = Math.max(maxStreak, currentStreak)
          } else {
            currentStreak = 0
          }
        })
        
        return {
          name: participant.name,
          score: percentage,
          timeSpent: participant.totalTime,
          streak: maxStreak,
          avgTime: avgTime,
          correctAnswers: participant.correct,
          totalAnswers: participant.total
        }
      }).sort((a, b) => {
        // Sort by score first, then by time (faster is better)
        if (b.score !== a.score) return b.score - a.score
        return a.timeSpent - b.timeSpent
      })

      // Calculate awards with more fun categories!
      const awards = {
        // Original awards
        speedDemon: participants.length > 0 ? participants.reduce((fastest, p) => p.avgTime < fastest.avgTime ? p : fastest) : null,
        perfectionist: participants.find(p => p.score === 100) || participants[0] || null,
        streakMaster: participants.length > 0 ? participants.reduce((best, p) => p.streak > best.streak ? p : best) : null,
        
        // New exciting awards!
        closeCall: participants.length >= 2 ? (() => {
          // Find participants with scores within 5% of each other
          const sorted = [...participants].sort((a, b) => b.score - a.score)
          if (sorted.length >= 2 && Math.abs(sorted[0].score - sorted[1].score) <= 5) {
            return sorted[1] // Second place in a close race
          }
          return null
        })() : null,
        
        lightningRound: participants.length > 0 ? (() => {
          // Find who answered most questions correctly in shortest total time
          const validParticipants = participants.filter(p => p.correctAnswers > 0)
          if (validParticipants.length === 0) return null
          return validParticipants.reduce((best, p) => {
            const scorePerSecond = p.correctAnswers / (p.timeSpent || 1)
            const bestScorePerSecond = best.correctAnswers / (best.timeSpent || 1)
            return scorePerSecond > bestScorePerSecond ? p : best
          })
        })() : null,
        
        comebackKid: participants.length > 0 ? (() => {
          // Find participant who improved most in second half
          const withImprovement = participants.map(p => {
            if (p.answers && p.answers.length >= 4) {
              const halfPoint = Math.floor(p.answers.length / 2)
              const firstHalf = p.answers.slice(0, halfPoint).filter(a => a.is_correct).length
              const secondHalf = p.answers.slice(halfPoint).filter(a => a.is_correct).length
              return { ...p, improvement: secondHalf - firstHalf }
            }
            return { ...p, improvement: 0 }
          })
          const bestComeback = withImprovement.reduce((best, p) => 
            p.improvement > best.improvement ? p : best, withImprovement[0])
          return bestComeback?.improvement > 0 ? bestComeback : null
        })() : null,
        
        steadyEddie: participants.length > 0 ? (() => {
          // Most consistent timing across all answers
          const withVariance = participants.map(p => {
            if (p.answers && p.answers.length > 1) {
              const times = p.answers.map(a => a.time_taken || 0)
              const avg = times.reduce((sum, t) => sum + t, 0) / times.length
              const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length
              return { ...p, timeVariance: variance }
            }
            return { ...p, timeVariance: Infinity }
          }).filter(p => p.timeVariance !== Infinity)
          
          if (withVariance.length === 0) return null
          return withVariance.reduce((best, p) => 
            p.timeVariance < best.timeVariance ? p : best)
        })() : null,
        
        photoFinish: participants.length >= 2 ? (() => {
          // Actual photo finish - top 2 players finished within 10 seconds of each other
          const sorted = [...participants].sort((a, b) => b.score - a.score)
          if (sorted.length >= 2 && 
              sorted[0].score === sorted[1].score && 
              Math.abs(sorted[0].timeSpent - sorted[1].timeSpent) <= 10) {
            return sorted[0]
          }
          return null
        })() : null
      }

      // Calculate overall stats
      const stats = {
        totalParticipants: participants.length,
        averageScore: participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.score, 0) / participants.length) : 0,
        averageTime: participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.timeSpent, 0) / participants.length) : 0,
        perfectScores: participants.filter(p => p.score === 100).length
      }


      setResults({
        quiz: {
          title: sessionData.quizzes.title,
          totalQuestions: sessionData.quizzes.questions?.length || 0
        },
        participants,
        awards,
        stats
      })

    } catch (error) {
      console.error('Error loading results:', error)
    }
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 via-red-400/10 to-pink-400/10 animate-pulse"></div>
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-6"></div>
          <p className="text-white text-2xl font-bold animate-pulse">🏆 Calculating Champions...</p>
          <p className="text-yellow-200 text-lg mt-2">Tallying the scores!</p>
        </div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl animate-bounce"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-bounce delay-1000"></div>
      </div>
    )
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden flex flex-col">
      {/* Animated celebration background */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 via-red-400/10 to-pink-400/10 animate-pulse"></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl animate-bounce"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-bounce delay-1000"></div>
      <div className="absolute top-20 left-20 w-40 h-40 bg-pink-400/10 rounded-full blur-2xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-green-400/10 rounded-full blur-2xl animate-pulse delay-500"></div>
      
      <header className="relative z-10 bg-gradient-to-r from-yellow-500 to-orange-500 shadow-2xl border-b-4 border-red-400">
        <div className="container mx-auto px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-4">
            <div className="animate-bounce">
              <Crown className="w-16 h-16 text-red-600 animate-spin" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-2xl animate-pulse">
                🏆 {results.quiz.title}
              </h1>
              <p className="text-2xl font-bold text-red-200 mt-2">CHAMPIONS REVEALED!</p>
              <div className="flex justify-center gap-2 mt-3">
                <div className="animate-bounce">🎪</div>
                <div className="animate-bounce delay-100">✨</div>
                <div className="animate-bounce delay-200">🎉</div>
                <div className="animate-bounce delay-300">🌟</div>
                <div className="animate-bounce delay-400">🎊</div>
              </div>
            </div>
            <div className="animate-bounce delay-500">
              <Trophy className="w-16 h-16 text-red-600 animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-2 flex-1 min-h-0 overflow-y-auto">
        {/* Awards Ceremony Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="animate-bounce">
                <Award className="w-12 h-12 text-yellow-400 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                🎪 AWARDS CEREMONY 🎪
              </h2>
              <div className="animate-bounce delay-500">
                <Star className="w-12 h-12 text-yellow-400 animate-pulse" />
              </div>
            </div>
            <p className="text-yellow-200 text-xl font-semibold">Celebrating Our Champions!</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-yellow-500/90 to-orange-600/90 backdrop-blur-sm text-white p-4 rounded-xl text-center border-2 border-yellow-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse">
              <div className="animate-bounce mb-4">
                <Zap className="w-12 h-12 mx-auto text-yellow-200" />
              </div>
              <h3 className="font-bold text-xl mb-3">⚡ SPEED DEMON</h3>
              <div className="bg-white/20 rounded-lg p-3 mb-3">
                <p className="text-lg font-bold">{results.awards.speedDemon?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.speedDemon?.avgTime ? `${results.awards.speedDemon.avgTime}s avg` : '--'}</p>
              <div className="mt-3 text-2xl animate-bounce">💨</div>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/90 to-emerald-600/90 backdrop-blur-sm text-white p-8 rounded-2xl text-center border-4 border-green-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-200">
              <div className="animate-bounce mb-4">
                <Target className="w-12 h-12 mx-auto text-green-200" />
              </div>
              <h3 className="font-bold text-xl mb-3">🎯 PERFECTIONIST</h3>
              <div className="bg-white/20 rounded-lg p-3 mb-3">
                <p className="text-lg font-bold">{results.awards.perfectionist?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.perfectionist?.score || 0}%</p>
              <div className="mt-3 text-2xl animate-bounce">🎆</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/90 to-pink-600/90 backdrop-blur-sm text-white p-8 rounded-2xl text-center border-4 border-purple-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-400">
              <div className="animate-bounce mb-4">
                <TrendingUp className="w-12 h-12 mx-auto text-purple-200" />
              </div>
              <h3 className="font-bold text-xl mb-3">📈 STREAK MASTER</h3>
              <div className="bg-white/20 rounded-lg p-3 mb-3">
                <p className="text-lg font-bold">{results.awards.streakMaster?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.streakMaster?.streak || 0} in a row</p>
              <div className="mt-3 text-2xl animate-bounce">🔥</div>
            </div>
            
            <div className="bg-gradient-to-br from-red-500/90 to-pink-600/90 backdrop-blur-sm text-white p-8 rounded-2xl text-center border-4 border-red-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-600">
              <div className="animate-bounce mb-4">
                <Clock className="w-12 h-12 mx-auto text-red-200" />
              </div>
              <h3 className="font-bold text-xl mb-3">📸 PHOTO FINISH</h3>
              <div className="bg-white/20 rounded-lg p-3 mb-3">
                <p className="text-lg font-bold">{results.awards.photoFinish?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.photoFinish ? 'Tied at the top!' : 'Gave it their all!'}</p>
              <div className="mt-3 text-2xl animate-bounce">🎖️</div>
            </div>
          </div>
          
          {/* New Awards Row */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {results.awards.closeCall && (
              <div className="bg-gradient-to-br from-indigo-500/90 to-blue-600/90 backdrop-blur-sm text-white p-8 rounded-2xl text-center border-4 border-indigo-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse">
                <div className="animate-bounce mb-4">
                  <Trophy className="w-12 h-12 mx-auto text-indigo-200" />
                </div>
                <h3 className="font-bold text-xl mb-3">🏃 CLOSE CALL</h3>
                <div className="bg-white/20 rounded-lg p-3 mb-3">
                  <p className="text-lg font-bold">{results.awards.closeCall.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Almost had it!</p>
                <div className="mt-3 text-2xl animate-bounce">🥈</div>
              </div>
            )}
            
            {results.awards.lightningRound && (
              <div className="bg-gradient-to-br from-cyan-500/90 to-teal-600/90 backdrop-blur-sm text-white p-8 rounded-2xl text-center border-4 border-cyan-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-200">
                <div className="animate-bounce mb-4">
                  <Zap className="w-12 h-12 mx-auto text-cyan-200" />
                </div>
                <h3 className="font-bold text-xl mb-3">⚡ LIGHTNING ROUND</h3>
                <div className="bg-white/20 rounded-lg p-3 mb-3">
                  <p className="text-lg font-bold">{results.awards.lightningRound.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Most efficient!</p>
                <div className="mt-3 text-2xl animate-bounce">⚡</div>
              </div>
            )}
            
            {results.awards.comebackKid && (
              <div className="bg-gradient-to-br from-amber-500/90 to-orange-600/90 backdrop-blur-sm text-white p-8 rounded-2xl text-center border-4 border-amber-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-400">
                <div className="animate-bounce mb-4">
                  <TrendingUp className="w-12 h-12 mx-auto text-amber-200" />
                </div>
                <h3 className="font-bold text-xl mb-3">📈 COMEBACK KID</h3>
                <div className="bg-white/20 rounded-lg p-3 mb-3">
                  <p className="text-lg font-bold">{results.awards.comebackKid.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Never gave up!</p>
                <div className="mt-3 text-2xl animate-bounce">💪</div>
              </div>
            )}
            
            {results.awards.steadyEddie && (
              <div className="bg-gradient-to-br from-slate-500/90 to-gray-600/90 backdrop-blur-sm text-white p-8 rounded-2xl text-center border-4 border-slate-300 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-600">
                <div className="animate-bounce mb-4">
                  <Clock className="w-12 h-12 mx-auto text-slate-200" />
                </div>
                <h3 className="font-bold text-xl mb-3">⏱️ STEADY EDDIE</h3>
                <div className="bg-white/20 rounded-lg p-3 mb-3">
                  <p className="text-lg font-bold">{results.awards.steadyEddie.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Consistent timing!</p>
                <div className="mt-3 text-2xl animate-bounce">🎯</div>
              </div>
            )}
          </div>
        </div>

        {/* Epic Stats Overview */}
        <div className="bg-gradient-to-br from-cyan-800/90 to-blue-800/90 backdrop-blur-sm rounded-xl shadow-2xl p-4 mb-6 border-2 border-cyan-400/30">
          <div className="flex items-center gap-3 mb-8">
            <div className="animate-pulse">
              <Medal className="w-10 h-10 text-cyan-400" />
            </div>
            <h2 className="text-3xl font-bold text-white">📊 BATTLE STATISTICS</h2>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl p-6 border-2 border-blue-400/50">
              <div className="text-3xl font-bold text-blue-300 animate-pulse mb-1">{results.stats.totalParticipants}</div>
              <div className="text-white text-lg font-semibold">👥 Warriors</div>
            </div>
            
            <div className="text-center bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-xl p-6 border-2 border-green-400/50">
              <div className="text-5xl font-bold text-green-300 animate-pulse mb-2">{results.stats.averageScore}%</div>
              <div className="text-white text-lg font-semibold">💯 Arena Average</div>
            </div>
            
            <div className="text-center bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-xl p-6 border-2 border-purple-400/50">
              <div className="text-5xl font-bold text-purple-300 animate-pulse mb-2">{formatTime(results.stats.averageTime)}</div>
              <div className="text-white text-lg font-semibold">⏱️ Battle Time</div>
            </div>
            
            <div className="text-center bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-xl p-6 border-2 border-orange-400/50">
              <div className="text-5xl font-bold text-orange-300 animate-pulse mb-2">{results.stats.perfectScores}</div>
              <div className="text-white text-lg font-semibold">🎆 Perfect Scores</div>
            </div>
          </div>
        </div>

        {/* Epic Toggle Buttons */}
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-indigo-600/90 to-purple-600/90 backdrop-blur-sm rounded-2xl p-2 shadow-2xl border-2 border-purple-400/50">
            <button 
              onClick={() => setShowLeaderboard(true)}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${
                showLeaderboard ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg animate-pulse' : 'text-white hover:bg-white/20'
              }`}
            >
              🏆 HALL OF FAME
            </button>
            <button 
              onClick={() => setShowLeaderboard(false)}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${
                !showLeaderboard ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg animate-pulse' : 'text-white hover:bg-white/20'
              }`}
            >
              📊 BATTLE STATS
            </button>
          </div>
        </div>

        {/* Epic Results Display */}
        <div className="bg-gradient-to-br from-red-800/90 to-pink-800/90 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-pink-400/30">
          {showLeaderboard ? (
            <div className="p-8">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="animate-bounce">
                  <Trophy className="w-12 h-12 text-yellow-400 animate-spin" />
                </div>
                <h2 className="text-4xl font-bold text-white drop-shadow-lg">
                  🏆 HALL OF CHAMPIONS
                </h2>
                <div className="animate-bounce delay-500">
                  <Crown className="w-12 h-12 text-yellow-400 animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-6">
                {results.participants.map((participant, index) => (
                  <div key={index} className={`flex items-center justify-between p-6 rounded-2xl transform hover:scale-105 transition-all border-2 ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-500/40 to-orange-500/40 border-yellow-400 animate-pulse shadow-2xl' :
                    index === 1 ? 'bg-gradient-to-r from-gray-400/40 to-slate-500/40 border-gray-300 shadow-xl' :
                    index === 2 ? 'bg-gradient-to-r from-orange-500/40 to-red-500/40 border-orange-400 shadow-xl' :
                    'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border-indigo-400/50 shadow-lg'
                  }`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl border-4 ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white border-yellow-300 animate-bounce shadow-lg' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white border-gray-200 shadow-lg' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white border-orange-300 shadow-lg' :
                        'bg-gradient-to-br from-indigo-400 to-purple-500 text-white border-indigo-300 shadow-md'
                      }`}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white mb-1">{participant.name}</div>
                        <div className="flex items-center gap-4">
                          <span className="text-yellow-300 font-semibold">🔥 Streak: {participant.streak}</span>
                          {participant.score === 100 && <span className="text-green-300 font-bold animate-pulse">✨ PERFECT!</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-yellow-300 animate-pulse mb-1">{participant.score}%</div>
                      <div className="text-lg text-white font-semibold">⏱️ {formatTime(participant.timeSpent)}</div>
                      {index === 0 && <div className="mt-2 text-2xl animate-bounce">🎆</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="animate-pulse">
                  <Target className="w-10 h-10 text-cyan-400" />
                </div>
                <h2 className="text-3xl font-bold text-white">📊 WARRIOR ANALYTICS</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-cyan-400/50">
                      <th className="text-left py-4 text-white text-xl font-bold">👥 Warrior</th>
                      <th className="text-center py-4 text-white text-xl font-bold">🎯 Score</th>
                      <th className="text-center py-4 text-white text-xl font-bold">⏱️ Time</th>
                      <th className="text-center py-4 text-white text-xl font-bold">🔥 Streak</th>
                      <th className="text-center py-4 text-white text-xl font-bold">🎲 Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.participants.map((participant, index) => (
                      <tr key={index} className={`border-b border-white/20 hover:bg-white/10 transition-all ${
                        index === 0 ? 'bg-yellow-500/20' : ''
                      }`}>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👊'}
                            </span>
                            <span className="text-white font-bold text-lg">{participant.name}</span>
                          </div>
                        </td>
                        <td className="text-center py-4">
                          <span className={`font-bold text-xl ${
                            participant.score === 100 ? 'text-green-300 animate-pulse' :
                            participant.score >= 80 ? 'text-yellow-300' :
                            'text-white'
                          }`}>
                            {participant.score}%
                          </span>
                        </td>
                        <td className="text-center py-4 text-cyan-300 font-semibold text-lg">{formatTime(participant.timeSpent)}</td>
                        <td className="text-center py-4 text-orange-300 font-bold text-lg">{participant.streak}</td>
                        <td className="text-center py-4 text-purple-300 font-semibold text-lg">
                          {Math.round((participant.score / 100) * results.quiz.totalQuestions)}/{results.quiz.totalQuestions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Results
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
    // Play victory theme when results load!
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
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--accent-color), var(--secondary-color))' }}
      >
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: 'linear-gradient(to right, rgba(var(--celebration-color-rgb), 0.1), rgba(var(--error-color-rgb), 0.1), rgba(var(--accent-color-rgb), 0.1))' }}
        ></div>
        <div className="text-center relative z-10">
          <div
            className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mx-auto mb-6"
            style={{ borderColor: 'var(--celebration-color)', borderTopColor: 'transparent' }}
          ></div>
          <p className="text-2xl font-bold animate-pulse" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Calculating Champions...</p>
          <p className="text-lg mt-2" style={{ color: 'var(--celebration-color-light)' }}>Tallying the scores!</p>
        </div>
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-bounce"
          style={{ background: 'rgba(var(--celebration-color-rgb), 0.2)' }}
        ></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-bounce delay-1000"
          style={{ background: 'rgba(var(--accent-color-rgb), 0.2)' }}
        ></div>
      </div>
    )
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className="h-screen relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--accent-color), var(--secondary-color))' }}
    >
      {/* Subtle background elements */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to right, rgba(var(--celebration-color-rgb), 0.05), rgba(var(--error-color-rgb), 0.05), rgba(var(--accent-color-rgb), 0.05))' }}
      ></div>
      <div
        className="absolute bottom-20 right-20 w-40 h-40 rounded-full blur-2xl animate-pulse delay-500"
        style={{ background: 'rgba(var(--success-color-rgb), 0.1)' }}
      ></div>

      <header
        className="relative z-10 shadow-2xl border-b-4"
        style={{
          background: 'linear-gradient(to right, var(--celebration-color), var(--warning-color))',
          borderBottomColor: 'var(--error-color)'
        }}
      >
        <div className="container mx-auto px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-4">
            <div className="animate-bounce">
              <Crown className="w-16 h-16 animate-spin" style={{ color: 'var(--error-color)' }} />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold drop-shadow-2xl animate-pulse" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>
                {results.quiz.title}
              </h1>
              <p className="text-2xl font-bold mt-2" style={{ color: 'var(--error-color-light)' }}>CHAMPIONS REVEALED!</p>
              <div className="flex justify-center gap-2 mt-3">
                <div className="animate-bounce">*</div>
                <div className="animate-bounce delay-100">*</div>
                <div className="animate-bounce delay-200">*</div>
                <div className="animate-bounce delay-300">*</div>
                <div className="animate-bounce delay-400">*</div>
              </div>
            </div>
            <div className="animate-bounce delay-500">
              <Trophy className="w-16 h-16 animate-pulse" style={{ color: 'var(--error-color)' }} />
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
                <Award className="w-12 h-12 animate-spin" style={{ color: 'var(--celebration-color)' }} />
              </div>
              <h2 className="text-2xl font-bold drop-shadow-lg" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>
                AWARDS CEREMONY
              </h2>
              <div className="animate-bounce delay-500">
                <Star className="w-12 h-12 animate-pulse" style={{ color: 'var(--celebration-color)' }} />
              </div>
            </div>
            <p className="text-xl font-semibold" style={{ color: 'var(--celebration-color-light)' }}>Celebrating Our Champions!</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Speed Demon Award */}
            <div
              className="backdrop-blur-sm p-4 rounded-xl text-center border-2 shadow-2xl transform hover:scale-110 transition-all animate-pulse"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--celebration-color-rgb), 0.9), rgba(var(--warning-color-rgb), 0.9))',
                borderColor: 'var(--celebration-color-light)',
                color: 'var(--text-on-primary-color, #ffffff)'
              }}
            >
              <div className="animate-bounce mb-4">
                <Zap className="w-12 h-12 mx-auto" style={{ color: 'var(--celebration-color-light)' }} />
              </div>
              <h3 className="font-bold text-xl mb-3">SPEED DEMON</h3>
              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                <p className="text-lg font-bold">{results.awards.speedDemon?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.speedDemon?.avgTime ? `${results.awards.speedDemon.avgTime}s avg` : '--'}</p>
              <div className="mt-3 text-2xl animate-bounce">*</div>
            </div>

            {/* Perfectionist Award */}
            <div
              className="backdrop-blur-sm p-8 rounded-2xl text-center border-4 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-200"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--success-color-rgb), 0.9), rgba(var(--success-color-dark-rgb), 0.9))',
                borderColor: 'var(--success-color-light)',
                color: 'var(--text-on-primary-color, #ffffff)'
              }}
            >
              <div className="animate-bounce mb-4">
                <Target className="w-12 h-12 mx-auto" style={{ color: 'var(--success-color-light)' }} />
              </div>
              <h3 className="font-bold text-xl mb-3">PERFECTIONIST</h3>
              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                <p className="text-lg font-bold">{results.awards.perfectionist?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.perfectionist?.score || 0}%</p>
              <div className="mt-3 text-2xl animate-bounce">*</div>
            </div>

            {/* Streak Master Award */}
            <div
              className="backdrop-blur-sm p-8 rounded-2xl text-center border-4 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-400"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--accent-color-rgb), 0.9), rgba(var(--accent-color-dark-rgb), 0.9))',
                borderColor: 'var(--accent-color-light)',
                color: 'var(--text-on-primary-color, #ffffff)'
              }}
            >
              <div className="animate-bounce mb-4">
                <TrendingUp className="w-12 h-12 mx-auto" style={{ color: 'var(--accent-color-light)' }} />
              </div>
              <h3 className="font-bold text-xl mb-3">STREAK MASTER</h3>
              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                <p className="text-lg font-bold">{results.awards.streakMaster?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.streakMaster?.streak || 0} in a row</p>
              <div className="mt-3 text-2xl animate-bounce">*</div>
            </div>

            {/* Photo Finish Award */}
            <div
              className="backdrop-blur-sm p-8 rounded-2xl text-center border-4 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-600"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--error-color-rgb), 0.9), rgba(var(--accent-color-rgb), 0.9))',
                borderColor: 'var(--error-color-light)',
                color: 'var(--text-on-primary-color, #ffffff)'
              }}
            >
              <div className="animate-bounce mb-4">
                <Clock className="w-12 h-12 mx-auto" style={{ color: 'var(--error-color-light)' }} />
              </div>
              <h3 className="font-bold text-xl mb-3">PHOTO FINISH</h3>
              <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                <p className="text-lg font-bold">{results.awards.photoFinish?.name || 'N/A'}</p>
              </div>
              <p className="text-2xl font-bold animate-pulse">{results.awards.photoFinish ? 'Tied at the top!' : 'Gave it their all!'}</p>
              <div className="mt-3 text-2xl animate-bounce">*</div>
            </div>
          </div>

          {/* New Awards Row */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            {results.awards.closeCall && (
              <div
                className="backdrop-blur-sm p-8 rounded-2xl text-center border-4 shadow-2xl transform hover:scale-110 transition-all animate-pulse"
                style={{
                  background: 'linear-gradient(to bottom right, rgba(var(--secondary-color-rgb), 0.9), rgba(var(--info-color-rgb), 0.9))',
                  borderColor: 'var(--secondary-color-light)',
                  color: 'var(--text-on-primary-color, #ffffff)'
                }}
              >
                <div className="animate-bounce mb-4">
                  <Trophy className="w-12 h-12 mx-auto" style={{ color: 'var(--secondary-color-light)' }} />
                </div>
                <h3 className="font-bold text-xl mb-3">CLOSE CALL</h3>
                <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <p className="text-lg font-bold">{results.awards.closeCall.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Almost had it!</p>
                <div className="mt-3 text-2xl animate-bounce">*</div>
              </div>
            )}

            {results.awards.lightningRound && (
              <div
                className="backdrop-blur-sm p-8 rounded-2xl text-center border-4 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-200"
                style={{
                  background: 'linear-gradient(to bottom right, rgba(var(--info-color-rgb), 0.9), rgba(var(--info-color-dark-rgb), 0.9))',
                  borderColor: 'var(--info-color-light)',
                  color: 'var(--text-on-primary-color, #ffffff)'
                }}
              >
                <div className="animate-bounce mb-4">
                  <Zap className="w-12 h-12 mx-auto" style={{ color: 'var(--info-color-light)' }} />
                </div>
                <h3 className="font-bold text-xl mb-3">LIGHTNING ROUND</h3>
                <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <p className="text-lg font-bold">{results.awards.lightningRound.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Most efficient!</p>
                <div className="mt-3 text-2xl animate-bounce">*</div>
              </div>
            )}

            {results.awards.comebackKid && (
              <div
                className="backdrop-blur-sm p-8 rounded-2xl text-center border-4 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-400"
                style={{
                  background: 'linear-gradient(to bottom right, rgba(var(--warning-color-rgb), 0.9), rgba(var(--warning-color-dark-rgb), 0.9))',
                  borderColor: 'var(--warning-color-light)',
                  color: 'var(--text-on-primary-color, #ffffff)'
                }}
              >
                <div className="animate-bounce mb-4">
                  <TrendingUp className="w-12 h-12 mx-auto" style={{ color: 'var(--warning-color-light)' }} />
                </div>
                <h3 className="font-bold text-xl mb-3">COMEBACK KID</h3>
                <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <p className="text-lg font-bold">{results.awards.comebackKid.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Never gave up!</p>
                <div className="mt-3 text-2xl animate-bounce">*</div>
              </div>
            )}

            {results.awards.steadyEddie && (
              <div
                className="backdrop-blur-sm p-8 rounded-2xl text-center border-4 shadow-2xl transform hover:scale-110 transition-all animate-pulse delay-600"
                style={{
                  background: 'linear-gradient(to bottom right, rgba(var(--neutral-color-rgb), 0.9), rgba(var(--neutral-color-dark-rgb), 0.9))',
                  borderColor: 'var(--neutral-color-light)',
                  color: 'var(--text-on-primary-color, #ffffff)'
                }}
              >
                <div className="animate-bounce mb-4">
                  <Clock className="w-12 h-12 mx-auto" style={{ color: 'var(--neutral-color-light)' }} />
                </div>
                <h3 className="font-bold text-xl mb-3">STEADY EDDIE</h3>
                <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <p className="text-lg font-bold">{results.awards.steadyEddie.name}</p>
                </div>
                <p className="text-2xl font-bold animate-pulse">Consistent timing!</p>
                <div className="mt-3 text-2xl animate-bounce">*</div>
              </div>
            )}
          </div>
        </div>

        {/* Epic Stats Overview */}
        <div
          className="backdrop-blur-sm rounded-xl shadow-2xl p-4 mb-6 border-2"
          style={{
            background: 'linear-gradient(to bottom right, rgba(var(--info-color-rgb), 0.9), rgba(var(--info-color-dark-rgb), 0.9))',
            borderColor: 'rgba(var(--info-color-rgb), 0.3)'
          }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="animate-pulse">
              <Medal className="w-10 h-10" style={{ color: 'var(--info-color)' }} />
            </div>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>BATTLE STATISTICS</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div
              className="text-center rounded-xl p-6 border-2"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--info-color-rgb), 0.3), rgba(var(--info-color-rgb), 0.3))',
                borderColor: 'rgba(var(--info-color-rgb), 0.5)'
              }}
            >
              <div className="text-3xl font-bold animate-pulse mb-1" style={{ color: 'var(--info-color-light)' }}>{results.stats.totalParticipants}</div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Warriors</div>
            </div>

            <div
              className="text-center rounded-xl p-6 border-2"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--success-color-rgb), 0.3), rgba(var(--success-color-rgb), 0.3))',
                borderColor: 'rgba(var(--success-color-rgb), 0.5)'
              }}
            >
              <div className="text-5xl font-bold animate-pulse mb-2" style={{ color: 'var(--success-color-light)' }}>{results.stats.averageScore}%</div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Arena Average</div>
            </div>

            <div
              className="text-center rounded-xl p-6 border-2"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--accent-color-rgb), 0.3), rgba(var(--accent-color-rgb), 0.3))',
                borderColor: 'rgba(var(--accent-color-rgb), 0.5)'
              }}
            >
              <div className="text-5xl font-bold animate-pulse mb-2" style={{ color: 'var(--accent-color-light)' }}>{formatTime(results.stats.averageTime)}</div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Battle Time</div>
            </div>

            <div
              className="text-center rounded-xl p-6 border-2"
              style={{
                background: 'linear-gradient(to bottom right, rgba(var(--warning-color-rgb), 0.3), rgba(var(--error-color-rgb), 0.3))',
                borderColor: 'rgba(var(--warning-color-rgb), 0.5)'
              }}
            >
              <div className="text-5xl font-bold animate-pulse mb-2" style={{ color: 'var(--warning-color-light)' }}>{results.stats.perfectScores}</div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Perfect Scores</div>
            </div>
          </div>
        </div>

        {/* Epic Toggle Buttons */}
        <div className="flex justify-center mb-8">
          <div
            className="backdrop-blur-sm rounded-2xl p-2 shadow-2xl border-2"
            style={{
              background: 'linear-gradient(to right, rgba(var(--secondary-color-rgb), 0.9), rgba(var(--accent-color-rgb), 0.9))',
              borderColor: 'rgba(var(--accent-color-rgb), 0.5)'
            }}
          >
            <button
              onClick={() => setShowLeaderboard(true)}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${
                showLeaderboard ? 'shadow-lg animate-pulse' : ''
              }`}
              style={showLeaderboard
                ? { background: 'linear-gradient(to right, var(--celebration-color), var(--warning-color))', color: 'var(--text-on-primary-color, #ffffff)' }
                : { color: 'var(--text-on-primary-color, #ffffff)' }}
            >
              HALL OF FAME
            </button>
            <button
              onClick={() => setShowLeaderboard(false)}
              className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${
                !showLeaderboard ? 'shadow-lg animate-pulse' : ''
              }`}
              style={!showLeaderboard
                ? { background: 'linear-gradient(to right, var(--celebration-color), var(--warning-color))', color: 'var(--text-on-primary-color, #ffffff)' }
                : { color: 'var(--text-on-primary-color, #ffffff)' }}
            >
              BATTLE STATS
            </button>
          </div>
        </div>

        {/* Epic Results Display */}
        <div
          className="backdrop-blur-sm rounded-2xl shadow-2xl border-2"
          style={{
            background: 'linear-gradient(to bottom right, rgba(var(--error-color-rgb), 0.9), rgba(var(--accent-color-rgb), 0.9))',
            borderColor: 'rgba(var(--accent-color-rgb), 0.3)'
          }}
        >
          {showLeaderboard ? (
            <div className="p-8">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="animate-bounce">
                  <Trophy className="w-12 h-12 animate-spin" style={{ color: 'var(--celebration-color)' }} />
                </div>
                <h2 className="text-4xl font-bold drop-shadow-lg" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>
                  HALL OF CHAMPIONS
                </h2>
                <div className="animate-bounce delay-500">
                  <Crown className="w-12 h-12 animate-pulse" style={{ color: 'var(--celebration-color)' }} />
                </div>
              </div>

              <div className="space-y-6">
                {results.participants.map((participant, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-6 rounded-2xl transform hover:scale-105 transition-all border-2 ${
                      index === 0 ? 'animate-pulse shadow-2xl' :
                      'shadow-xl'
                    }`}
                    style={
                      index === 0 ? {
                        background: 'linear-gradient(to right, rgba(var(--celebration-color-rgb), 0.4), rgba(var(--warning-color-rgb), 0.4))',
                        borderColor: 'var(--celebration-color)'
                      } :
                      index === 1 ? {
                        background: 'linear-gradient(to right, rgba(var(--neutral-color-rgb), 0.4), rgba(var(--neutral-color-dark-rgb), 0.4))',
                        borderColor: 'var(--neutral-color-light)'
                      } :
                      index === 2 ? {
                        background: 'linear-gradient(to right, rgba(var(--warning-color-rgb), 0.4), rgba(var(--error-color-rgb), 0.4))',
                        borderColor: 'var(--warning-color)'
                      } : {
                        background: 'linear-gradient(to right, rgba(var(--secondary-color-rgb), 0.3), rgba(var(--accent-color-rgb), 0.3))',
                        borderColor: 'rgba(var(--secondary-color-rgb), 0.5)'
                      }
                    }
                  >
                    <div className="flex items-center gap-6">
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl border-4 ${
                          index === 0 ? 'animate-bounce shadow-lg' :
                          'shadow-lg'
                        }`}
                        style={
                          index === 0 ? {
                            background: 'linear-gradient(to bottom right, var(--celebration-color), var(--warning-color))',
                            borderColor: 'var(--celebration-color-light)',
                            color: 'var(--text-on-primary-color, #ffffff)'
                          } :
                          index === 1 ? {
                            background: 'linear-gradient(to bottom right, var(--neutral-color-light), var(--neutral-color))',
                            borderColor: 'var(--neutral-color-light)',
                            color: 'var(--text-on-primary-color, #ffffff)'
                          } :
                          index === 2 ? {
                            background: 'linear-gradient(to bottom right, var(--warning-color), var(--error-color))',
                            borderColor: 'var(--warning-color-light)',
                            color: 'var(--text-on-primary-color, #ffffff)'
                          } : {
                            background: 'linear-gradient(to bottom right, var(--secondary-color), var(--accent-color))',
                            borderColor: 'var(--secondary-color-light)',
                            color: 'var(--text-on-primary-color, #ffffff)'
                          }
                        }
                      >
                        {index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : index + 1}
                      </div>
                      <div>
                        <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{participant.name}</div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold" style={{ color: 'var(--celebration-color)' }}>Streak: {participant.streak}</span>
                          {participant.score === 100 && <span className="font-bold animate-pulse" style={{ color: 'var(--success-color-light)' }}>PERFECT!</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold animate-pulse mb-1" style={{ color: 'var(--celebration-color)' }}>{participant.score}%</div>
                      <div className="text-lg font-semibold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{formatTime(participant.timeSpent)}</div>
                      {index === 0 && <div className="mt-2 text-2xl animate-bounce">*</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="animate-pulse">
                  <Target className="w-10 h-10" style={{ color: 'var(--info-color)' }} />
                </div>
                <h2 className="text-3xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>WARRIOR ANALYTICS</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(var(--info-color-rgb), 0.5)' }}>
                      <th className="text-left py-4 text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Warrior</th>
                      <th className="text-center py-4 text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Score</th>
                      <th className="text-center py-4 text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Time</th>
                      <th className="text-center py-4 text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Streak</th>
                      <th className="text-center py-4 text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.participants.map((participant, index) => (
                      <tr
                        key={index}
                        className="border-b transition-all"
                        style={index === 0 ? { borderColor: 'rgba(255, 255, 255, 0.2)', background: 'rgba(var(--celebration-color-rgb), 0.2)' } : { borderColor: 'rgba(255, 255, 255, 0.2)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index === 0 ? 'rgba(var(--celebration-color-rgb), 0.2)' : 'transparent'}
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : '*'}
                            </span>
                            <span className="font-bold text-lg" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{participant.name}</span>
                          </div>
                        </td>
                        <td className="text-center py-4">
                          <span
                            className={`font-bold text-xl ${participant.score === 100 ? 'animate-pulse' : ''}`}
                            style={{
                              color: participant.score === 100 ? 'var(--success-color-light)' :
                                     participant.score >= 80 ? 'var(--celebration-color)' : 'var(--text-on-primary-color, #ffffff)'
                            }}
                          >
                            {participant.score}%
                          </span>
                        </td>
                        <td className="text-center py-4 font-semibold text-lg" style={{ color: 'var(--info-color-light)' }}>{formatTime(participant.timeSpent)}</td>
                        <td className="text-center py-4 font-bold text-lg" style={{ color: 'var(--warning-color-light)' }}>{participant.streak}</td>
                        <td className="text-center py-4 font-semibold text-lg" style={{ color: 'var(--accent-color-light)' }}>
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

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Users, Clock, Play, Square, Trophy, Zap, Star, Target, Award } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gameShowSounds } from '../lib/gameShowSounds'

function QuizSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [liveResults, setLiveResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessionData()
    
    // Subscribe to real-time participant updates
    console.log('🔔 Setting up real-time subscription for sessionId:', sessionId)
    const participantSubscription = supabase
      .channel(`participants-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        console.log('🔥 REAL-TIME: Participant change received!', payload)
        console.log('🔄 Refreshing participants list...')
        loadParticipants()
      })
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status)
      })

    // Also set up a polling backup every 2 seconds for responsive updates
    const pollingInterval = setInterval(async () => {
      console.log('⚡ Polling for participant updates...')
      loadParticipants()
      
      // Re-check session status from database to get current state
      try {
        const { data: currentSession } = await supabase
          .from('quiz_sessions')
          .select('status')
          .eq('id', sessionId)
          .single()
        
        if (currentSession?.status === 'active') {
          console.log('📊 Session is active - loading live results...')
          loadLiveResults()
        }
      } catch (error) {
        console.log('Error checking session status:', error)
      }
    }, 2000)

    return () => {
      console.log('🧹 Cleaning up subscriptions...')
      supabase.removeChannel(participantSubscription)
      clearInterval(pollingInterval)
    }
  }, [sessionId])

  const loadSessionData = async () => {
    console.log('🔄 LOADING SESSION DATA for sessionId:', sessionId)
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
            time_limit,
            questions (*)
          )
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('❌ SESSION ERROR:', sessionError)
        throw sessionError
      }

      console.log('✅ SESSION LOADED:', sessionData)
      setSession(sessionData)
      await loadParticipants()
    } catch (error) {
      console.error('💥 Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadParticipants = async () => {
    console.log('👥 LOADING PARTICIPANTS for sessionId:', sessionId)
    try {
      const { data: participantData, error } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionId)
        .order('joined_at', { ascending: true })

      if (error) {
        console.error('❌ PARTICIPANT ERROR:', error)
        throw error
      }

      console.log('📊 PARTICIPANTS FOUND:', participantData?.length || 0)
      console.log('👤 PARTICIPANT DATA:', participantData)
      setParticipants(participantData || [])
    } catch (error) {
      console.error('💥 Error loading participants:', error)
    }
  }

  const loadLiveResults = async () => {
    console.log('📊 LOADING LIVE RESULTS for sessionId:', sessionId)
    try {
      // Get all participant answers with participant info
      const { data: answersData, error } = await supabase
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

      if (error) {
        console.error('❌ LIVE RESULTS ERROR:', error)
        throw error
      }

      console.log('📈 RAW ANSWERS DATA:', answersData)

      // Calculate live leaderboard
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
            avgTime: 0,
            totalTime: 0
          }
        }
        
        participantStats[participantId].total++
        participantStats[participantId].totalTime += answer.time_taken || 0
        
        if (answer.is_correct) {
          participantStats[participantId].correct++
          participantStats[participantId].score += answer.questions.points || 1
        }
      })

      // Convert to array and calculate percentages
      const leaderboard = Object.values(participantStats).map(participant => ({
        ...participant,
        percentage: participant.total > 0 ? Math.round((participant.correct / participant.total) * 100) : 0,
        avgTime: participant.total > 0 ? Math.round(participant.totalTime / participant.total) : 0
      })).sort((a, b) => {
        // Sort by score first, then by avg time (faster is better)
        if (b.score !== a.score) return b.score - a.score
        return a.avgTime - b.avgTime
      })

      console.log('🏆 LIVE LEADERBOARD:', leaderboard)
      setLiveResults(leaderboard)
    } catch (error) {
      console.error('💥 Error loading live results:', error)
    }
  }

  const startSession = async () => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) throw error

      // 🎵 SHOW START FANFARE!
      gameShowSounds.playShowStart()

      setSession(prev => ({ 
        ...prev, 
        status: 'active',
        started_at: new Date().toISOString()
      }))

      // Start loading live results immediately
      setTimeout(loadLiveResults, 1000)
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Error starting session. Please try again.')
    }
  }

  const stopSession = async () => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) throw error

      // 🎵 QUIZ COMPLETE VICTORY SOUND!
      gameShowSounds.playQuizComplete()

      setSession(prev => ({ 
        ...prev, 
        status: 'completed',
        ended_at: new Date().toISOString()
      }))

      // Show confirmation and redirect to results
      setTimeout(() => {
        navigate(`/results/${sessionId}`)
      }, 2000)
    } catch (error) {
      console.error('Error stopping session:', error)
      alert('Error stopping session. Please try again.')
    }
  }

  const viewResults = () => {
    navigate(`/results/${sessionId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session not found</h1>
          <p className="text-gray-600">The quiz session you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const sessionUrl = `${window.location.origin}/quiz/${session.session_code}`
  
  // Debug the QR code URL
  console.log('🔗 QR Code URL:', sessionUrl)
  console.log('🌐 Current origin:', window.location.origin)

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden flex flex-col">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 via-red-400/10 to-pink-400/10 animate-pulse"></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl animate-bounce"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-bounce delay-1000"></div>
      
      <header className="relative z-10 bg-gb-navy shadow-2xl border-b-4 border-gb-gold flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src="/gbname.png" alt="GB Logo" className="h-10" />
              <div>
                <h1 className="text-2xl font-bold text-gb-gold drop-shadow-lg font-serif">
                  {session.quizzes.title}
                </h1>
                <p className="text-gb-gold/80 text-base font-medium">Live Training Quiz</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`px-4 py-2 rounded-lg text-base font-semibold tracking-wide shadow-lg transition-all ${
                session.status === 'waiting' ? 'bg-gb-gold text-gb-navy' :
                session.status === 'active' ? 'bg-green-600 text-white animate-pulse' :
                'bg-gray-600 text-white'
              }`}>
                {session.status === 'waiting' && 'Ready to Start'}
                {session.status === 'active' && '● LIVE'}
                {session.status === 'completed' && '✓ Completed'}
              </div>
              {session.status === 'waiting' && (
                <button 
                  onClick={startSession}
                  className="bg-gb-gold text-gb-navy px-6 py-3 rounded-lg font-bold text-lg hover:bg-gb-gold-light flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all"
                >
                  <Play className="w-6 h-6" />
                  Start Quiz
                </button>
              )}
              {session.status === 'active' && (
                <button 
                  onClick={stopSession}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-red-700 flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all"
                >
                  <Square className="w-6 h-6" />
                  End Quiz
                </button>
              )}
              {session.status === 'completed' && (
                <button 
                  onClick={viewResults}
                  className="bg-gb-gold text-gb-navy px-6 py-3 rounded-lg font-bold text-lg hover:bg-gb-gold-light flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all"
                >
                  <Trophy className="w-6 h-6" />
                  View Results
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-2 flex-1 min-h-0">
        <div className="grid lg:grid-cols-3 gap-4 h-full">
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-indigo-800/90 to-purple-800/90 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-yellow-400/30 h-full flex flex-col">
              <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-gb-gold" />
                  <h2 className="text-xl font-bold text-gb-gold">Participants</h2>
                </div>
                <button
                  onClick={loadParticipants}
                  className="px-3 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-medium shadow-lg transition-all text-sm"
                >
                  Refresh
                </button>
              </div>
              <div className="flex items-center gap-3 mb-3 bg-gb-gold/10 rounded-lg p-3 flex-shrink-0 border border-gb-gold/20">
                <Users className="w-8 h-8 text-gb-gold" />
                <div>
                  <span className="text-3xl font-bold text-gb-gold">{participants.length}</span>
                  <span className="text-white text-lg font-semibold ml-2">participants joined</span>
                </div>
              </div>
              
              <div className="space-y-2 flex-1 overflow-y-auto">
                {participants.length === 0 ? (
                  <div className="text-center py-12 bg-gb-gold/5 rounded-xl border border-gb-gold/20">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gb-gold/50" />
                    <p className="text-white text-xl font-semibold mb-2">Waiting for participants</p>
                    <p className="text-gb-gold/80 text-lg">Share the QR code to get started</p>
                  </div>
                ) : (
                  participants.map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between py-3 px-4 bg-white/10 rounded-lg border border-gb-gold/20 backdrop-blur-sm hover:bg-white/15 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gb-gold rounded-full flex items-center justify-center text-gb-navy font-bold text-sm">
                          {index + 1}
                        </div>
                        <span className="text-white font-bold text-lg">{participant.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gb-gold text-sm font-medium">Ready</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {session.status === 'active' && (
              <div className="bg-gradient-to-br from-red-800/90 to-pink-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-2 border-pink-400/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="animate-spin">
                    <Trophy className="w-10 h-10 text-yellow-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">🔥 LIVE BATTLE ARENA!</h2>
                </div>
                
                {liveResults.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center bg-white/10 rounded-lg p-4 border border-gb-gold/20">
                        <div className="text-3xl font-bold text-gb-gold">
                          {Math.round(liveResults.reduce((sum, p) => sum + p.percentage, 0) / liveResults.length) || 0}%
                        </div>
                        <div className="text-white font-medium text-sm">Average Score</div>
                      </div>
                      <div className="text-center bg-white/10 rounded-lg p-4 border border-gb-gold/20">
                        <div className="text-3xl font-bold text-gb-gold">
                          {liveResults.length > 0 ? Math.max(...liveResults.map(p => p.total)) : 0}/{session.quizzes.questions?.length || 0}
                        </div>
                        <div className="text-white font-medium text-sm">Progress</div>
                      </div>
                      <div className="text-center bg-white/10 rounded-lg p-4 border border-gb-gold/20">
                        <div className="text-3xl font-bold text-gb-gold">
                          {liveResults.length > 0 ? Math.round(liveResults.reduce((sum, p) => sum + p.avgTime, 0) / liveResults.length) : 0}s
                        </div>
                        <div className="text-white font-medium text-sm">Avg Time</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <Award className="w-6 h-6 text-gb-gold" />
                        <h3 className="font-bold text-2xl text-white">🏆 LIVE LEADERBOARD</h3>
                      </div>
                      {liveResults.map((participant, index) => (
                        <div key={participant.id} className={`flex items-center justify-between p-6 rounded-xl transform hover:scale-105 transition-all border-2 ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-500/40 to-orange-500/40 border-yellow-400 animate-pulse' :
                          index === 1 ? 'bg-gradient-to-r from-gray-400/40 to-slate-500/40 border-gray-400' :
                          index === 2 ? 'bg-gradient-to-r from-orange-500/40 to-red-500/40 border-orange-400' :
                          'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border-indigo-400/50'
                        }`}>
                          <div className="flex items-center gap-4">
                            <span className={`font-bold text-3xl ${
                              index === 0 ? 'text-yellow-300 animate-bounce' :
                              index === 1 ? 'text-gray-300' :
                              index === 2 ? 'text-orange-300' :
                              'text-white'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </span>
                            <span className="font-bold text-xl text-white">{participant.name}</span>
                          </div>
                          <div className="flex items-center gap-6 text-lg">
                            <span className="text-green-300 font-bold">🎯 {participant.score} pts</span>
                            <span className="text-blue-300 font-semibold">📊 {participant.percentage}%</span>
                            <span className="text-purple-300 font-semibold">⚡ {participant.avgTime}s</span>
                            {participant.correct === participant.total && participant.total > 0 && (
                              <span className="text-yellow-300 font-bold animate-pulse">🌟 PERFECT!</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl">
                    <div className="text-8xl mb-6 animate-bounce">🎪</div>
                    <p className="text-white text-2xl font-bold mb-4">🎯 Arena is heating up!</p>
                    <p className="text-yellow-200 text-lg">Live battle results will appear as contestants answer!</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-gradient-to-br from-yellow-600/90 to-orange-600/90 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-yellow-400 relative overflow-hidden">
              {/* Animated sparkles */}
              <div className="absolute top-4 right-4 text-2xl animate-bounce">✨</div>
              <div className="absolute bottom-4 left-4 text-2xl animate-bounce delay-500">🌟</div>
              
              <div className="flex items-center gap-3 mb-6">
                <Target className="w-6 h-6 text-gb-gold" />
                <h2 className="text-xl font-bold text-gb-gold">Join Quiz Session</h2>
              </div>
              
              <div className="text-center relative">
                <div className="bg-white p-4 rounded-xl border-2 border-gb-gold mb-4 inline-block shadow-lg">
                  <QRCode 
                    value={sessionUrl} 
                    size={120}
                    level="M"
                  />
                </div>
                
                
                <div className="bg-gb-gold/10 rounded-lg p-3 border border-gb-gold/20">
                  <p className="text-gb-gold text-xs font-medium break-all">{sessionUrl}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-800/90 to-blue-800/90 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-cyan-400/30">
              <div className="flex items-center gap-2 mb-4">
                <div className="animate-pulse">
                  <Clock className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-bold text-white">📊 Stats</h2>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-lg border border-green-400/50">
                  <span className="text-white font-medium text-sm">⏱️ Time:</span>
                  <span className="text-yellow-300 font-bold text-sm">{Math.floor(session.quizzes.time_limit / 60)} min</span>
                </div>
                
                <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 rounded-lg border border-yellow-400/50">
                  <span className="text-white font-medium text-sm">🎯 Code:</span>
                  <span className="text-yellow-300 font-mono font-bold text-sm">{session.session_code}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 px-3 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-lg border border-purple-400/50">
                  <span className="text-white font-medium text-sm">Status:</span>
                  <span className={`font-bold text-sm uppercase ${
                    session.status === 'waiting' ? 'text-yellow-300 animate-pulse' :
                    session.status === 'active' ? 'text-green-300 animate-bounce' :
                    'text-purple-300'
                  }`}>
                    {session.status === 'waiting' && '⏳ Waiting'}
                    {session.status === 'active' && '🔥 LIVE!'}
                    {session.status === 'completed' && '🏆 Done'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-red-500/30 to-pink-500/30 rounded-xl border border-red-400/50">
                  <span className="text-white font-semibold">❓ Questions:</span>
                  <span className="text-yellow-300 font-bold text-lg">{session.quizzes.questions?.length || 0} rounds</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default QuizSession
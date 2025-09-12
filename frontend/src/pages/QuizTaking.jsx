import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, AlertCircle, Zap, Trophy, Users, Target, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gameShowSounds } from '../lib/gameShowSounds'

function QuizTaking() {
  const { sessionCode } = useParams()
  const navigate = useNavigate()
  const [participant, setParticipant] = useState({ name: '' })
  const [participantId, setParticipantId] = useState(null)
  const [session, setSession] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [hasJoined, setHasJoined] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeRemaining, setTimeRemaining] = useState(600)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // 🎬 GAME SHOW EXCITEMENT STATES
  const [totalContestants, setTotalContestants] = useState(0)
  const [myPosition, setMyPosition] = useState(null)
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false)
  const [answerIsCorrect, setAnswerIsCorrect] = useState(null)
  const [celebrating, setCelebrating] = useState(false)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [dramaticCountdown, setDramaticCountdown] = useState(false)
  const [answerSelected, setAnswerSelected] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)

  useEffect(() => {
    loadSessionData()
    
    // Set up polling to check for session status changes
    const statusPolling = setInterval(() => {
      console.log('🔄 Polling for session status changes...')
      loadSessionData()
    }, 2000)

    return () => clearInterval(statusPolling)
  }, [sessionCode])

  // Admin control functions
  const joinAsAdmin = async () => {
    if (adminPassword !== 'admin123') {
      alert('Invalid admin password')
      return
    }
    setIsAdmin(true)
    setHasJoined(true)
  }

  const startQuizAsAdmin = async () => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', session.id)

      if (error) throw error
      
      // Reload session data to get updated status
      loadSessionData()
    } catch (error) {
      console.error('Error starting quiz:', error)
    }
  }

  const endQuizAsAdmin = async () => {
    try {
      const { error } = await supabase
        .from('quiz_sessions')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', session.id)

      if (error) throw error
      
      // Navigate to results
      navigate(`/results/${session.id}`)
    } catch (error) {
      console.error('Error ending quiz:', error)
    }
  }

  useEffect(() => {
    if (hasJoined && !isSubmitted && !isAdmin && session?.status === 'active') {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          // DRAMATIC COUNTDOWN EFFECTS! 🎬
          if (prev <= 30 && prev > 0) {
            setDramaticCountdown(true)
          }
          
          // 🎵 SOUND EFFECTS FOR COUNTDOWN!
          if (prev <= 10 && prev > 0) {
            gameShowSounds.playFinalCountdown() // Dramatic final seconds!
          } else if (prev <= 30 && prev > 10) {
            gameShowSounds.playTick() // Regular ticking
          }
          
          if (prev <= 1) {
            submitQuiz()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      // LIVE CONTESTANT TRACKING! 👥
      const liveTracking = setInterval(() => {
        if (session?.id && participantId) {
          loadLiveStats()
        }
      }, 3000)
      
      return () => {
        clearInterval(timer)
        clearInterval(liveTracking)
      }
    }
  }, [hasJoined, isSubmitted, session?.status, participantId])

  const loadSessionData = async () => {
    try {
      // Find session by session code
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
        .eq('session_code', sessionCode)
        .single()

      if (sessionError) {
        setError('Session not found. Please check the session code.')
        return
      }

      if (sessionData.status === 'completed') {
        // Check if we were previously in the quiz and it just ended
        if (isSubmitted || hasJoined) {
          setSessionEnded(true)
        } else {
          setError('This quiz session has already ended.')
        }
        return
      }

      // 🎵 SHOW START FANFARE when session becomes active!
      if (session?.status === 'waiting' && sessionData.status === 'active' && hasJoined) {
        console.log('🎪 QUIZ IS STARTING! Playing fanfare!')
        setTimeout(() => gameShowSounds.playShowStart(), 500)
      }

      setSession(sessionData)
      setQuiz(sessionData.quizzes)
      setTimeRemaining(sessionData.quizzes.time_limit)
    } catch (error) {
      console.error('Error loading session data:', error)
      setError('Failed to load quiz session.')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const joinQuiz = async () => {
    if (!participant.name.trim()) return

    console.log('🚀 PARTICIPANT JOINING QUIZ!')
    console.log('👤 Name:', participant.name)
    console.log('🎯 Session ID:', session?.id)
    console.log('📝 Session Code:', sessionCode)

    try {
      // Add participant to database
      console.log('💾 Inserting participant into database...')
      const { data: participantData, error } = await supabase
        .from('participants')
        .insert({
          session_id: session.id,
          name: participant.name.trim()
        })
        .select()
        .single()

      if (error) {
        console.error('❌ JOIN ERROR:', error)
        throw error
      }

      console.log('✅ PARTICIPANT JOINED SUCCESSFULLY:', participantData)
      setParticipantId(participantData.id)
      setHasJoined(true)

      // If session is already active, start the timer
      if (session.status === 'active') {
        console.log('⚡ Session is already active - starting timer')
        // 🎵 SHOW START FANFARE!
        setTimeout(() => gameShowSounds.playShowStart(), 1000)
      } else {
        console.log('⏳ Session is waiting - will start when trainer begins')
      }
    } catch (error) {
      console.error('💥 Error joining quiz:', error)
      alert('Failed to join quiz. Please try again.')
    }
  }

  // 🎯 LIVE CONTESTANT STATS TRACKING
  const loadLiveStats = async () => {
    try {
      // Get total participants
      const { data: participants } = await supabase
        .from('participants')
        .select('id')
        .eq('session_id', session.id)
      
      setTotalContestants(participants?.length || 0)

      // Get my current position (simplified for now)
      const { data: answers } = await supabase
        .from('participant_answers')
        .select('is_correct')
        .eq('participant_id', participantId)
      
      const myCorrect = answers?.filter(a => a.is_correct).length || 0
      setMyPosition(myCorrect + 1) // Simplified ranking
      setCurrentStreak(myCorrect)
    } catch (error) {
      console.log('Error loading live stats:', error)
    }
  }

  // 🎪 DRAMATIC ANSWER SELECTION WITH FEEDBACK!
  const selectAnswer = async (questionId, answer) => {
    // Prevent multiple selections
    if (answerSelected) return
    
    const question = quiz.questions.find(q => q.id === questionId)
    const isCorrect = answer === question.correct_answer
    
    // Lock in the answer
    setAnswerSelected(true)
    
    // 🎵 ANSWER SELECTION SOUND!
    gameShowSounds.playSelect()
    
    // Set answer immediately for UI responsiveness
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    
    // DRAMATIC PAUSE AND FEEDBACK! 🎬
    setTimeout(() => {
      setAnswerIsCorrect(isCorrect)
      setShowAnswerFeedback(true)
      
      if (isCorrect) {
        // 🎵 CORRECT ANSWER CELEBRATION!
        gameShowSounds.playCorrect()
        setTimeout(() => gameShowSounds.playCelebration(), 300)
        setCelebrating(true)
        setCurrentStreak(prev => prev + 1)
      } else {
        // 🎵 WRONG ANSWER BUZZER!
        gameShowSounds.playBuzzer()
      }
      
      // Auto-progress after showing feedback
      setTimeout(() => {
        setShowAnswerFeedback(false)
        setCelebrating(false)
        setAnswerIsCorrect(null)
        setAnswerSelected(false)
        
        // Move to next question or finish quiz
        if (currentQuestion < quiz.questions.length - 1) {
          setCurrentQuestion(prev => prev + 1)
        } else {
          // Last question - submit quiz
          submitQuiz()
        }
      }, 2500) // Show feedback for 2.5 seconds
    }, 500)
  }

  const nextQuestion = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    }
  }

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1)
    }
  }

  const submitQuiz = async () => {
    if (!participantId) return

    try {
      // Calculate scores and submit answers
      const answerSubmissions = quiz.questions.map(question => {
        const userAnswer = answers[question.id] || ''
        const isCorrect = userAnswer === question.correct_answer
        
        return {
          participant_id: participantId,
          question_id: question.id,
          answer: userAnswer,
          is_correct: isCorrect,
          time_taken: Math.floor(Math.random() * 30) + 10 // Mock time - in real app this would be tracked
        }
      })

      const { error } = await supabase
        .from('participant_answers')
        .insert(answerSubmissions)

      if (error) throw error

      // 🎵 QUIZ COMPLETE VICTORY SOUND!
      gameShowSounds.playQuizComplete()
      setIsSubmitted(true)
    } catch (error) {
      console.error('Error submitting quiz:', error)
      alert('Failed to submit quiz. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (sessionEnded) {
    // Auto-close after 5 seconds
    useEffect(() => {
      const timer = setTimeout(() => {
        window.close() // Try to close the window/tab
        // If can't close, navigate home as fallback
        setTimeout(() => navigate('/'), 1000)
      }, 5000)
      
      return () => clearTimeout(timer)
    }, [])

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center relative overflow-hidden">
        {/* 🎬 FINALE BACKDROP */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full opacity-30 animate-pulse"></div>
          <div className="absolute top-20 right-20 w-24 h-24 bg-red-400 rounded-full opacity-40 animate-pulse" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 bg-green-400 rounded-full opacity-35 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 bg-pink-400 rounded-full opacity-25 animate-pulse" style={{animationDelay: '1.5s'}}></div>
        </div>

        {/* ✨ FAREWELL SPARKLES */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 text-4xl animate-bounce" style={{animationDelay: '0.2s'}}>👋</div>
          <div className="absolute top-1/3 left-10 text-3xl animate-bounce" style={{animationDelay: '0.8s'}}>🌟</div>
          <div className="absolute bottom-1/4 right-10 text-4xl animate-bounce" style={{animationDelay: '1.2s'}}>❤️</div>
          <div className="absolute top-1/4 right-1/4 text-2xl animate-bounce" style={{animationDelay: '1.8s'}}>✨</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-yellow-50 p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-8 border-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
          {/* 🎪 FINALE HEADER */}
          <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white px-6 py-4 rounded-full mb-6 animate-pulse border-4 border-yellow-300">
            <h1 className="text-2xl font-black uppercase tracking-wider drop-shadow-lg">🎊 SHOW'S OVER! 🎊</h1>
          </div>
          
          {/* 👋 FAREWELL ICON */}
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-r from-pink-400 to-purple-500 rounded-full flex items-center justify-center border-8 border-yellow-400 animate-pulse">
              <div className="text-4xl">👋</div>
            </div>
          </div>
          
          {/* 🎤 THANK YOU MESSAGE */}
          <div className="bg-gradient-to-r from-green-400 to-emerald-500 text-white p-4 rounded-2xl mb-6 border-4 border-yellow-400">
            <h2 className="text-xl font-bold uppercase tracking-wide mb-2">Thank You For Playing!</h2>
            <p className="text-lg font-bold">
              {participant.name ? `${participant.name}, you were amazing!` : 'You were amazing!'}
            </p>
          </div>
          
          {/* 🎯 AUTO-CLOSE MESSAGE */}
          <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-2xl mb-6 border-4 border-blue-400">
            <p className="text-lg font-bold text-blue-800 mb-2">
              📺 THAT'S A WRAP! 📺
            </p>
            <p className="text-sm font-semibold text-blue-600">
              This window will close automatically...
            </p>
            <div className="mt-2 bg-blue-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-full w-full animate-pulse"></div>
            </div>
          </div>
          
          {/* 🎉 FAREWELL FOOTER */}
          <div className="flex justify-center space-x-2">
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.1s'}}>👋</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.2s'}}>❤️</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.3s'}}>🌟</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.4s'}}>✨</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.5s'}}>🎊</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4 text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Oops!</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center relative overflow-hidden">
        {/* 🎬 GAME SHOW BACKDROP LIGHTS */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full opacity-30 animate-pulse"></div>
          <div className="absolute top-20 right-20 w-24 h-24 bg-cyan-400 rounded-full opacity-40 animate-pulse" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 bg-green-400 rounded-full opacity-35 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 bg-orange-400 rounded-full opacity-25 animate-pulse" style={{animationDelay: '1.5s'}}></div>
          <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-pink-400 rounded-full opacity-30 animate-bounce" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/3 right-1/3 w-16 h-16 bg-blue-400 rounded-full opacity-40 animate-bounce" style={{animationDelay: '2.5s'}}></div>
        </div>

        {/* ✨ FLOATING SPARKLES */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 text-4xl animate-bounce" style={{animationDelay: '0.2s'}}>✨</div>
          <div className="absolute top-1/3 left-10 text-3xl animate-bounce" style={{animationDelay: '0.8s'}}>🌟</div>
          <div className="absolute bottom-1/4 right-10 text-4xl animate-bounce" style={{animationDelay: '1.2s'}}>💫</div>
          <div className="absolute top-1/4 right-1/4 text-2xl animate-bounce" style={{animationDelay: '1.8s'}}>⭐</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-yellow-50 p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-8 border-gradient-to-r from-yellow-400 via-red-500 to-pink-500 animate-pulse">
          {/* 🎪 DRAMATIC HEADER */}
          <div className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-600 text-white px-6 py-3 rounded-full mb-6 animate-bounce border-4 border-yellow-300">
            <h1 className="text-2xl font-black uppercase tracking-wider drop-shadow-lg">🎪 QUIZ ARENA 🎪</h1>
          </div>
          
          {/* 🏆 QUIZ TITLE */}
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black p-4 rounded-2xl mb-6 border-4 border-red-400 animate-pulse">
            <h2 className="text-xl font-bold uppercase tracking-wide">🏆 {quiz.title} 🏆</h2>
            <p className="text-sm font-bold mt-2">
              Session: <span className="font-mono text-lg bg-black text-yellow-400 px-2 py-1 rounded animate-pulse">{sessionCode}</span>
            </p>
          </div>
          
          {session.status === 'waiting' && (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 border-4 border-red-500 rounded-xl p-4 mb-6 animate-bounce">
              <p className="text-black font-bold text-lg">
                ⏳ BACKSTAGE PREP! ⏳
              </p>
              <p className="text-black text-sm font-semibold">
                Join now and wait for the show to begin!
              </p>
            </div>
          )}

          {session.status === 'active' && (
            <div className="bg-gradient-to-r from-green-400 to-emerald-500 border-4 border-yellow-500 rounded-xl p-4 mb-6 animate-pulse">
              <p className="text-black font-bold text-lg">
                🚀 SHOW IS LIVE! 🚀
              </p>
              <p className="text-black text-sm font-semibold">
                Join the arena NOW!
              </p>
            </div>
          )}
          
          <div className="space-y-6">
            {/* Join as Participant */}
            <div className="bg-white/10 p-4 rounded-xl border border-gb-gold/20">
              <label className="block text-lg font-bold text-gb-gold mb-3">Join as Participant</label>
              <input 
                type="text" 
                value={participant.name}
                onChange={(e) => setParticipant({ name: e.target.value })}
                className="w-full px-4 py-3 text-lg font-medium text-center border-2 border-gb-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-gb-gold focus:border-gb-gold bg-white text-gb-navy"
                placeholder="Enter your name..."
                onKeyPress={(e) => e.key === 'Enter' && joinQuiz()}
              />
              <button 
                onClick={joinQuiz}
                className={`w-full mt-3 py-3 text-lg font-bold rounded-lg transition-all ${
                  participant.name.trim() 
                    ? 'bg-gb-gold text-gb-navy hover:bg-gb-gold-light' 
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }`}
                disabled={!participant.name.trim()}
              >
                {participant.name.trim() ? 'Join Quiz' : 'Enter Name First'}
              </button>
            </div>
            
            {/* Admin Login */}
            <div className="bg-red-900/20 p-4 rounded-xl border border-red-400/20">
              <label className="block text-lg font-bold text-red-300 mb-3">Admin Remote Control</label>
              <input 
                type="password" 
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 text-lg font-medium text-center border-2 border-red-400/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-white text-gb-navy"
                placeholder="Admin password..."
                onKeyPress={(e) => e.key === 'Enter' && joinAsAdmin()}
              />
              <button 
                onClick={joinAsAdmin}
                className={`w-full mt-3 py-3 text-lg font-bold rounded-lg transition-all ${
                  adminPassword.trim() 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }`}
                disabled={!adminPassword.trim()}
              >
                Login as Admin
              </button>
            </div>
          </div>

          {/* 🎉 EXCITEMENT FOOTER */}
          <div className="mt-6 flex justify-center space-x-2">
            <div className="animate-bounce text-2xl" style={{animationDelay: '0.1s'}}>🎉</div>
            <div className="animate-bounce text-2xl" style={{animationDelay: '0.2s'}}>🎊</div>
            <div className="animate-bounce text-2xl" style={{animationDelay: '0.3s'}}>🎈</div>
            <div className="animate-bounce text-2xl" style={{animationDelay: '0.4s'}}>🎆</div>
            <div className="animate-bounce text-2xl" style={{animationDelay: '0.5s'}}>🎇</div>
          </div>
        </div>
      </div>
    )
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center relative overflow-hidden">
        {/* 🎬 BACKDROP STAGE LIGHTS */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute top-20 right-20 w-24 h-24 bg-red-400 rounded-full opacity-30 animate-pulse" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 bg-blue-400 rounded-full opacity-25 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 bg-green-400 rounded-full opacity-20 animate-pulse" style={{animationDelay: '1.5s'}}></div>
        </div>
        
        <div className="bg-gb-navy p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2 border-gb-gold">
          {isAdmin ? (
            <>
              {/* Admin Remote Control Interface */}
              <div className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg mb-6">
                <h1 className="text-xl font-bold">Admin Remote Control</h1>
              </div>
              
              <div className="bg-white/10 p-4 rounded-xl mb-6 border border-gb-gold/20">
                <h3 className="text-lg font-bold text-gb-gold mb-4">Quiz Session</h3>
                <div className="space-y-2 text-left">
                  <p className="text-white"><span className="font-semibold">Title:</span> {quiz.title}</p>
                  <p className="text-white"><span className="font-semibold">Time:</span> {Math.floor(quiz.time_limit / 60)} minutes</p>
                  <p className="text-white"><span className="font-semibold">Questions:</span> {quiz.questions.length}</p>
                  <p className="text-white"><span className="font-semibold">Status:</span> 
                    <span className={`ml-2 px-2 py-1 rounded text-sm font-bold ${
                      session.status === 'waiting' ? 'bg-yellow-500 text-black' :
                      session.status === 'active' ? 'bg-green-500 text-white' :
                      'bg-gray-500 text-white'
                    }`}>
                      {session.status.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {session.status === 'waiting' && (
                  <button
                    onClick={startQuizAsAdmin}
                    className="w-full py-4 text-lg font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                  >
                    🚀 Start Quiz
                  </button>
                )}
                
                {session.status === 'active' && (
                  <button
                    onClick={endQuizAsAdmin}
                    className="w-full py-4 text-lg font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                  >
                    ⏹️ End Quiz
                  </button>
                )}
                
                {session.status === 'completed' && (
                  <button
                    onClick={() => navigate(`/results/${session.id}`)}
                    className="w-full py-4 text-lg font-bold bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light transition-all"
                  >
                    📊 View Results
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Participant Waiting Interface */}
              <div className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg mb-6">
                <h1 className="text-xl font-bold">Ready to Start</h1>
              </div>
              
              <div className="bg-white/10 p-4 rounded-xl mb-6 border border-gb-gold/20">
                <h3 className="text-lg font-bold text-gb-gold">Welcome {participant.name}!</h3>
                <p className="text-white mt-2">You're ready for {quiz.title}</p>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-gb-gold/20">
                <p className="text-gb-gold text-sm">Waiting for trainer to start the quiz...</p>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center relative overflow-hidden">
        {/* 🎬 CELEBRATION BACKDROP */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full opacity-30 animate-pulse"></div>
          <div className="absolute top-20 right-20 w-24 h-24 bg-green-400 rounded-full opacity-40 animate-pulse" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 bg-blue-400 rounded-full opacity-35 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 bg-pink-400 rounded-full opacity-25 animate-pulse" style={{animationDelay: '1.5s'}}></div>
        </div>

        {/* ✨ FLOATING CELEBRATION */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 text-4xl animate-bounce" style={{animationDelay: '0.2s'}}>🎉</div>
          <div className="absolute top-1/3 left-10 text-3xl animate-bounce" style={{animationDelay: '0.8s'}}>🏆</div>
          <div className="absolute bottom-1/4 right-10 text-4xl animate-bounce" style={{animationDelay: '1.2s'}}>⭐</div>
          <div className="absolute top-1/4 right-1/4 text-2xl animate-bounce" style={{animationDelay: '1.8s'}}>🎊</div>
          <div className="absolute bottom-1/3 left-1/4 text-3xl animate-bounce" style={{animationDelay: '2.2s'}}>🎈</div>
        </div>
        
        <div className="bg-gradient-to-br from-white to-yellow-50 p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-8 border-gradient-to-r from-yellow-400 via-green-500 to-blue-500">
          {/* 🎪 SUCCESS HEADER */}
          <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 text-white px-6 py-4 rounded-full mb-6 animate-pulse border-4 border-yellow-300">
            <h1 className="text-2xl font-black uppercase tracking-wider drop-shadow-lg">🎊 QUIZ COMPLETE! 🎊</h1>
          </div>
          
          {/* 🏆 SUCCESS ICON */}
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border-8 border-green-400 animate-spin" style={{animationDuration: '3s'}}>
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>
          
          {/* 🎤 CONTESTANT CELEBRATION */}
          <div className="bg-gradient-to-r from-purple-400 to-pink-500 text-white p-4 rounded-2xl mb-6 border-4 border-yellow-400">
            <h2 className="text-xl font-bold uppercase tracking-wide mb-2">🌟 {participant.name} 🌟</h2>
            <p className="text-lg font-bold">
              YOU'VE CONQUERED THE QUIZ!
            </p>
          </div>
          
          {/* 🎯 WAITING STATUS */}
          <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-2xl mb-6 border-4 border-blue-400">
            <p className="text-lg font-bold text-blue-800 mb-2">
              📺 STAY TUNED! 📺
            </p>
            <p className="text-sm font-semibold text-blue-600">
              Waiting for all contestants to finish...
            </p>
            <p className="text-xs text-blue-500 mt-2">
              Results will be revealed shortly!
            </p>
          </div>
          
          {/* 🎉 CELEBRATION FOOTER */}
          <div className="flex justify-center space-x-2 mb-4">
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.1s'}}>🎉</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.2s'}}>🎊</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.3s'}}>🏆</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.4s'}}>⭐</div>
            <div className="animate-bounce text-3xl" style={{animationDelay: '0.5s'}}>🎈</div>
          </div>
          
          {/* 🔴 LIVE RECORDING INDICATOR */}
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse inline-flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-1 animate-ping"></div>
            LIVE RECORDING
          </div>
        </div>
      </div>
    )
  }

  const question = quiz.questions[currentQuestion]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* 🎬 STAGE LIGHTS & EFFECTS */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-40 h-40 bg-yellow-300 rounded-full opacity-10 animate-pulse blur-xl"></div>
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-blue-300 rounded-full opacity-15 animate-pulse blur-xl" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-0 left-1/3 w-36 h-36 bg-red-300 rounded-full opacity-10 animate-pulse blur-xl" style={{animationDelay: '0.5s'}}></div>
      </div>

      {/* 📺 MOBILE-OPTIMIZED GAME SHOW HEADER */}
      <header className="relative z-10 bg-gradient-to-r from-red-600 to-pink-600 shadow-2xl border-b-4 border-yellow-400">
        <div className="px-3 py-3">
          {/* Top row: Live indicator, Title, Timer */}
          <div className="flex items-center justify-between mb-2">
            <div className="bg-yellow-400 text-black px-2 py-1 rounded-full font-black text-xs animate-bounce">
              🎪 LIVE!
            </div>
            
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide text-center flex-1 mx-2 truncate">
              {quiz.title}
            </h1>
            
            {/* ⏰ COMPACT TIMER */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full font-mono font-black text-lg ${
              dramaticCountdown 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-white text-gray-900'
            }`}>
              <Clock className={`w-4 h-4 ${dramaticCountdown ? 'animate-spin' : ''}`} />
              <span className="text-sm">{formatTime(timeRemaining)}</span>
            </div>
          </div>
          
          {/* Bottom row: Contestant name and stats */}
          <div className="flex items-center justify-between text-xs">
            <div className="text-yellow-300 font-bold truncate max-w-[120px]">
              👤 {participant.name}
            </div>
            
            <div className="flex items-center space-x-4 text-white">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span className="font-bold">{totalContestants}</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                <span className="font-bold">#{myPosition || '?'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span className="font-bold">{currentStreak}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 📊 PROGRESS INDICATOR */}
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-4 mb-6 border-2 border-yellow-400">
            <div className="flex justify-between items-center mb-2">
              <span className="text-yellow-300 font-bold">
                QUESTION {currentQuestion + 1} OF {quiz.questions.length}
              </span>
              <div className="flex gap-1">
                {quiz.questions.map((_, index) => (
                  <div 
                    key={index}
                    className={`w-4 h-4 rounded-full border-2 ${
                      index === currentQuestion ? 'bg-yellow-400 border-yellow-400 animate-pulse' :
                      answers[quiz.questions[index].id] ? 'bg-green-400 border-green-400' :
                      'bg-gray-600 border-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          
          {/* 🎪 QUESTION STAGE */}
          <div className="bg-gradient-to-br from-white to-gray-100 rounded-3xl shadow-2xl p-8 mb-8 border-8 border-gradient-to-r border-yellow-400 relative">
            {/* 🔴 CAMERA INDICATORS */}
            <div className="absolute -top-3 -left-3">
              <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                📹 CAM 1
              </div>
            </div>
            <div className="absolute -top-3 -right-3">
              <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse" style={{animationDelay: '0.5s'}}>
                📹 CAM 2
              </div>
            </div>
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-gray-900 mb-4 leading-tight">{question.question_text}</h2>
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 w-20 mx-auto rounded-full"></div>
            </div>
            
            {/* 🎪 DRAMATIC ANSWER BUTTONS */}
            <div className="space-y-4">
              {JSON.parse(question.options || '[]').map((option, index) => {
                const isSelected = answers[question.id] === option
                const isCorrect = option === question.correct_answer
                const buttonLabels = ['A', 'B', 'C', 'D']
                
                // Show correct/incorrect styling after answer is selected
                let buttonStyle = ''
                let labelStyle = ''
                
                if (answerSelected) {
                  if (isCorrect) {
                    buttonStyle = 'border-green-500 bg-gradient-to-r from-green-100 to-emerald-100 shadow-2xl'
                    labelStyle = 'border-green-500 bg-green-400 text-white'
                  } else if (isSelected && !isCorrect) {
                    buttonStyle = 'border-red-500 bg-gradient-to-r from-red-100 to-pink-100 shadow-2xl'
                    labelStyle = 'border-red-500 bg-red-400 text-white'
                  } else {
                    buttonStyle = 'border-gray-300 bg-gray-50 opacity-50'
                    labelStyle = 'border-gray-400 bg-gray-200 text-gray-500'
                  }
                } else if (isSelected) {
                  buttonStyle = 'border-yellow-400 bg-gradient-to-r from-yellow-100 to-orange-100 shadow-2xl scale-105'
                  labelStyle = 'border-yellow-500 bg-yellow-400 text-white animate-pulse'
                } else {
                  buttonStyle = 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-xl'
                  labelStyle = 'border-gray-400 bg-gray-100 text-gray-600'
                }
                
                return (
                  <button
                    key={index}
                    onClick={() => selectAnswer(question.id, option)}
                    disabled={answerSelected}
                    className={`w-full p-6 text-left rounded-2xl transition-all duration-300 transform border-4 ${buttonStyle} ${
                      answerSelected ? 'cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-12 h-12 rounded-full border-4 mr-4 flex items-center justify-center font-black text-lg ${labelStyle}`}>
                        {answerSelected && isCorrect ? '✅' : answerSelected && isSelected && !isCorrect ? '❌' : buttonLabels[index]}
                      </div>
                      <span className="text-xl font-semibold text-gray-800">{option}</span>
                      {answerSelected && isCorrect && (
                        <div className="ml-auto text-2xl animate-bounce">🎉</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 🎊 DRAMATIC FEEDBACK OVERLAY */}
          {showAnswerFeedback && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className={`text-center p-8 rounded-3xl border-8 ${
                answerIsCorrect 
                  ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-300' 
                  : 'bg-gradient-to-br from-red-400 to-pink-500 border-red-300'
              } transform scale-110 animate-bounce`}>
                <div className={`text-8xl mb-4 ${celebrating ? 'animate-spin' : ''}`}>
                  {answerIsCorrect ? '🎉' : '❌'}
                </div>
                <h2 className={`text-4xl font-black text-white mb-2 ${celebrating ? 'animate-pulse' : ''}`}>
                  {answerIsCorrect ? '🎊 CORRECT! 🎊' : '💥 INCORRECT! 💥'}
                </h2>
                {answerIsCorrect && (
                  <p className="text-xl text-white font-bold">STREAK: {currentStreak} 🔥</p>
                )}
              </div>
            </div>
          )}

          {/* 🎯 AUTO-PROGRESSION STATUS */}
          {!answerSelected && (
            <div className="text-center bg-gradient-to-r from-blue-100 to-purple-100 p-4 rounded-2xl border-4 border-blue-300">
              <p className="text-lg font-bold text-blue-800">
                🎯 Select your answer to continue!
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Quiz will automatically move to the next question
              </p>
            </div>
          )}
          
          {answerSelected && !showAnswerFeedback && (
            <div className="text-center bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-2xl border-4 border-yellow-300">
              <p className="text-lg font-bold text-orange-800 animate-pulse">
                🎪 Preparing dramatic reveal...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default QuizTaking
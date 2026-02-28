import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Clock, CheckCircle, AlertCircle, Zap, Trophy, Users, Target, Star } from 'lucide-react'
import { db } from '../lib/firebase'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
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
  const [sessionRestored, setSessionRestored] = useState(false)
  const [kicked, setKicked] = useState(false)

  // Reference to scroll to question area
  const questionRef = useRef(null)

  // Reference to current answers state for timer closure
  const answersRef = useRef({})
  const isSubmittedRef = useRef(false)

  // Session persistence functions
  const saveSessionToStorage = (sessionData) => {
    try {
      const sessionKey = `quiz_session_${sessionCode}`
      localStorage.setItem(sessionKey, JSON.stringify({
        participant: sessionData.participant,
        participantId: sessionData.participantId,
        hasJoined: sessionData.hasJoined,
        isSubmitted: sessionData.isSubmitted,
        answers: sessionData.answers,
        currentQuestion: sessionData.currentQuestion,
        savedAt: new Date().toISOString()
      }))
      // Only log saves for important events, not every answer to reduce noise
      if (sessionData.isSubmitted || !sessionData.hasJoined) {
        console.log('💾 Session saved to localStorage')
      }
    } catch (error) {
      console.error('Error saving session to localStorage:', error)
    }
  }

  const restoreSessionFromStorage = () => {
    try {
      const sessionKey = `quiz_session_${sessionCode}`
      const savedSession = localStorage.getItem(sessionKey)

      if (savedSession) {
        const sessionData = JSON.parse(savedSession)
        const savedAt = new Date(sessionData.savedAt)
        const now = new Date()
        const timeDiff = now - savedAt

        // Only restore if saved within the last 2 hours (session might have expired)
        if (timeDiff < 2 * 60 * 60 * 1000) {
          console.log('🔄 Restoring session from localStorage')
          setParticipant(sessionData.participant || { name: '' })
          setParticipantId(sessionData.participantId || null)
          setHasJoined(sessionData.hasJoined || false)
          setIsSubmitted(sessionData.isSubmitted || false)
          const restoredAnswers = sessionData.answers || {}
          setAnswers(restoredAnswers)
          answersRef.current = restoredAnswers
          setCurrentQuestion(sessionData.currentQuestion || 0)
          setSessionRestored(true)
          console.log('✅ Session restored successfully')

          // Set up kick detection for restored session
          if (sessionData.participantId && sessionData.hasJoined) {
            console.log('🛡️ Setting up kick detection for restored session')
            // Delay to ensure session data is loaded
            setTimeout(() => setupKickDetection(sessionData.participantId), 1000)
          }

          // Hide restoration message after 3 seconds
          setTimeout(() => setSessionRestored(false), 3000)

          return true
        } else {
          console.log('🗑️ Saved session too old, clearing...')
          clearSessionFromStorage()
        }
      }
    } catch (error) {
      console.error('Error restoring session from localStorage:', error)
      clearSessionFromStorage()
    }
    return false
  }

  const clearSessionFromStorage = () => {
    try {
      const sessionKey = `quiz_session_${sessionCode}`
      localStorage.removeItem(sessionKey)
      console.log('🗑️ Session cleared from localStorage')
    } catch (error) {
      console.error('Error clearing session from localStorage:', error)
    }
  }

  useEffect(() => {
    // Try to restore session from localStorage first
    restoreSessionFromStorage()

    loadSessionData()

    // Set up real-time session listener for instant timer sync
    let sessionUnsubscribe = null

    const setupRealtimeListener = async () => {
      try {
        const sessionQuery = query(
          collection(db, 'sessions'),
          where('sessionCode', '==', sessionCode)
        )

        const sessionSnapshot = await getDocs(sessionQuery)
        if (sessionSnapshot.docs.length > 0) {
          const sessionDoc = sessionSnapshot.docs[0]

          // Listen for real-time session updates
          sessionUnsubscribe = onSnapshot(doc(db, 'sessions', sessionDoc.id), (doc) => {
            if (doc.exists()) {
              const sessionData = { id: doc.id, ...doc.data() }
              console.log('🔥 REAL-TIME: Session updated!', sessionData.status)

              // Update session state immediately for instant timer sync
              setSession(sessionData)
              setQuiz(sessionData.quiz)

              // Handle timer sync immediately for perfect synchronization
              handleTimerSync(sessionData)
            }
          })
        }
      } catch (error) {
        console.error('Error setting up real-time listener:', error)
      }
    }

    setupRealtimeListener()

    // Fallback polling at lower frequency
    const statusPolling = setInterval(() => {
      if (session?.status === 'waiting') {
        console.log('🔄 Polling for session start...')
        loadSessionData()
      }
    }, 3000) // Less frequent polling since we have real-time updates

    return () => {
      clearInterval(statusPolling)
      if (sessionUnsubscribe) {
        console.log('🧹 Cleaning up real-time session listener...')
        sessionUnsubscribe()
      }
      // Clean up kick detection subscription
      if (window.kickDetectionUnsubscribe) {
        console.log('🧹 Cleaning up kick detection subscription...')
        window.kickDetectionUnsubscribe()
        window.kickDetectionUnsubscribe = null
      }
    }
  }, [sessionCode])

  // Handle timer synchronization with projector - mobile is purely passive display
  const handleTimerSync = (sessionData) => {
    if (sessionData.status === 'active') {
      // Mobile device is PURELY PASSIVE - just display what projector broadcasts
      if (sessionData.currentTimeRemaining !== undefined) {
        console.log('📱 MIRROR PROJECTOR TIMER:', sessionData.currentTimeRemaining, 'seconds')
        setTimeRemaining(sessionData.currentTimeRemaining)
      }
    } else if (sessionData.status !== 'active') {
      // Reset to full time if session not active
      setTimeRemaining(sessionData.quiz?.timeLimit || 600)
    }
  }

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
      await updateDoc(doc(db, 'sessions', session.id), {
        status: 'active',
        startedAt: serverTimestamp()
      })

      // Reload session data to get updated status
      loadSessionData()
    } catch (error) {
      console.error('Error starting quiz:', error)
    }
  }

  const endQuizAsAdmin = async () => {
    try {
      await updateDoc(doc(db, 'sessions', session.id), {
        status: 'completed',
        endedAt: serverTimestamp()
      })

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
            if (!isSubmittedRef.current) {
              console.log('⏰ Timer expired, submitting quiz')
              console.log('⏰ Current answers state at timer expiration:', answersRef.current)
              console.log('⏰ Number of answers recorded:', Object.keys(answersRef.current).length)
              isSubmittedRef.current = true // Prevent duplicate submissions
              submitQuiz()
            } else {
              console.log('⏰ Timer expired but quiz already submitted')
            }
            return 0
          }

          // If submitted, stop timer completely
          if (isSubmittedRef.current) {
            return 0
          }

          // Mobile timer is passive - projector controls the countdown display
          // This timer only handles sound effects and auto-submission logic
          return prev
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

  // Auto-scroll to question when currentQuestion changes
  useEffect(() => {
    if (questionRef.current && hasJoined && !isSubmitted) {
      // Smooth scroll to bring question to top of viewport
      questionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      })
    }
  }, [currentQuestion, hasJoined, isSubmitted])

  const loadSessionData = async () => {
    try {
      console.log('🔍 Looking for session with code:', sessionCode)

      // Find session by session code in Firebase
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('sessionCode', '==', sessionCode)
      )
      const sessionsSnapshot = await getDocs(sessionsQuery)

      if (sessionsSnapshot.empty) {
        setError('Session not found. Please check the session code.')
        return
      }

      const sessionDoc = sessionsSnapshot.docs[0]
      const sessionData = { id: sessionDoc.id, ...sessionDoc.data() }

      if (sessionData.status === 'completed') {
        // Redirect to results page when quiz ends
        console.log('🏁 Quiz completed - redirecting to results page')
        navigate(`/results/${sessionData.id}`)
        return
      }

      // 🎵 SHOW START FANFARE when session becomes active!
      if (session?.status === 'waiting' && sessionData.status === 'active' && hasJoined) {
        console.log('🎪 QUIZ IS STARTING! Playing fanfare!')
        setTimeout(() => gameShowSounds.playShowStart(), 500)
      }

      setSession(sessionData)
      setQuiz(sessionData.quiz) // Firebase stores the quiz data in the session

      // Timer sync is now handled by the real-time listener
      // Only set initial timer if not active (waiting state)
      if (sessionData.status !== 'active') {
        setTimeRemaining(sessionData.quiz?.timeLimit || 600)
      }
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
      // Add participant to Firebase
      console.log('💾 Inserting participant into database...')
      const participantRef = await addDoc(collection(db, 'sessions', session.id, 'participants'), {
        name: participant.name.trim(),
        joinedAt: serverTimestamp(),
        completed: false,
        score: 0,
        totalAnswers: 0,
        avgTime: 0
      })

      console.log('✅ PARTICIPANT JOINED SUCCESSFULLY:', participantRef.id)
      setParticipantId(participantRef.id)
      setHasJoined(true)

      // Save session to localStorage after joining
      saveSessionToStorage({
        participant,
        participantId: participantRef.id,
        hasJoined: true,
        isSubmitted: false,
        answers: {},
        currentQuestion: 0
      })

      // Set up real-time kick detection
      setupKickDetection(participantRef.id)

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

  // 🚨 KICK DETECTION SYSTEM
  const setupKickDetection = (currentParticipantId) => {
    const actualParticipantId = currentParticipantId || participantId
    if (!actualParticipantId || !session?.id) {
      console.log('❌ Cannot setup kick detection: missing participantId or sessionId', { actualParticipantId, sessionId: session?.id })
      return
    }

    console.log('🛡️ Setting up kick detection for participant:', actualParticipantId)

    // Monitor this specific participant document
    const participantRef = doc(db, 'sessions', session.id, 'participants', actualParticipantId)

    const unsubscribe = onSnapshot(participantRef, (doc) => {
      console.log('🛡️ Kick detection snapshot received:', {
        exists: doc.exists(),
        participantId: actualParticipantId,
        fromCache: doc.metadata.fromCache
      })

      if (!doc.exists()) {
        // Participant was removed/kicked!
        console.log('🚨 PARTICIPANT KICKED! Redirecting...', {
          participantId: actualParticipantId,
          sessionId: session.id
        })

        // Clear session storage
        clearSessionFromStorage()

        // Show kick screen
        setKicked(true)

        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = 'https://gblaw.capetown/'
        }, 3000)
      } else {
        console.log('🛡️ Participant still exists, data:', doc.data())
      }
    }, (error) => {
      console.error('❌ Error in kick detection:', error)
    })

    // Store unsubscribe function for cleanup
    window.kickDetectionUnsubscribe = unsubscribe
  }

  // 🎯 LIVE CONTESTANT STATS TRACKING
  const loadLiveStats = async () => {
    try {
      // Get total participants from Firebase
      const participantsSnapshot = await getDocs(collection(db, 'sessions', session.id, 'participants'))
      setTotalContestants(participantsSnapshot.size)

      // Get my current answers to calculate stats
      if (participantId) {
        const answersQuery = query(
          collection(db, 'sessions', session.id, 'answers'),
          where('participantId', '==', participantId)
        )
        const answersSnapshot = await getDocs(answersQuery)
        const myAnswers = answersSnapshot.docs.map(doc => doc.data())
          .sort((a, b) => {
            const aTime = a.answeredAt?.toDate?.() || new Date(a.answeredAt || 0)
            const bTime = b.answeredAt?.toDate?.() || new Date(b.answeredAt || 0)
            return aTime - bTime // Sort by answer time
          })

        const myCorrect = myAnswers.filter(a => a.isCorrect).length
        setMyPosition(myCorrect + 1) // Simplified ranking

        // Calculate current streak (consecutive correct answers from the end)
        let currentStreakCount = 0
        for (let i = myAnswers.length - 1; i >= 0; i--) {
          if (myAnswers[i].isCorrect) {
            currentStreakCount++
          } else {
            break // Stop at first wrong answer
          }
        }
        setCurrentStreak(currentStreakCount)
      }
    } catch (error) {
      console.log('Error loading live stats:', error)
    }
  }

  // 🎪 STREAMLINED ANSWER SELECTION
  const selectAnswer = async (questionId, answer) => {
    // Prevent multiple selections
    if (answerSelected) return

    const question = quiz.questions.find(q => q.id === questionId)
    const isCorrect = answer === question.correctAnswer

    // Lock in the answer
    setAnswerSelected(true)

    // 🎵 SUBTLE ANSWER SELECTION SOUND!
    gameShowSounds.playSelect()

    // Set answer immediately for UI responsiveness
    setAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: answer }

      // Update ref for timer closure
      answersRef.current = newAnswers

      console.log(`💾 Answer saved for question ${questionId}:`, answer)
      console.log(`💾 Total answers now:`, Object.keys(newAnswers).length)
      console.log(`💾 All answers state:`, newAnswers)

      // Save session after each answer
      saveSessionToStorage({
        participant,
        participantId,
        hasJoined,
        isSubmitted: false,
        answers: newAnswers,
        currentQuestion
      })

      return newAnswers
    })

    // QUICK FEEDBACK!
    setTimeout(() => {
      setAnswerIsCorrect(isCorrect)
      setShowAnswerFeedback(true)

      if (isCorrect) {
        // 🎵 CORRECT ANSWER SOUND!
        gameShowSounds.playCorrect()
        setCurrentStreak(prev => prev + 1)
      } else {
        // 🎵 WRONG ANSWER SOUND!
        gameShowSounds.playBuzzer()
        // Reset streak on wrong answer
        setCurrentStreak(0)
      }

      // Auto-progress after showing feedback
      setTimeout(() => {
        setShowAnswerFeedback(false)
        setAnswerIsCorrect(null)
        setAnswerSelected(false)

        // Move to next question or finish quiz
        if (currentQuestion < quiz.questions.length - 1) {
          setCurrentQuestion(prev => {
            const newQuestionIndex = prev + 1

            // Save session when moving to next question
            saveSessionToStorage({
              participant,
              participantId,
              hasJoined,
              isSubmitted: false,
              answers,
              currentQuestion: newQuestionIndex
            })

            return newQuestionIndex
          })
        } else {
          // Last question - submit quiz with final answer
          setAnswers(currentAnswers => {
            const finalAnswers = { ...currentAnswers, [questionId]: answer }
            setTimeout(() => {
              if (!isSubmitted && !isSubmittedRef.current) {
                console.log('✅ Last question answered, submitting quiz')
                isSubmittedRef.current = true
                submitQuiz(finalAnswers)
              } else {
                console.log('✅ Last question answered but quiz already submitted')
              }
            }, 100)
            return finalAnswers
          })
        }
      }, 1500) // Reduced feedback time to 1.5 seconds
    }, 300) // Reduced delay to 0.3 seconds
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

  const updateParticipantCompletion = async (answerSubmissions) => {
    try {
      // Calculate completion stats
      const totalQuestions = quiz.questions.length
      const correctAnswers = answerSubmissions.filter(a => a.isCorrect).length
      const score = Math.round((correctAnswers / totalQuestions) * 100)
      const avgTime = Math.round(answerSubmissions.reduce((sum, a) => sum + a.timeTaken, 0) / totalQuestions)

      // Update participant document with completion status
      const participantRef = doc(db, 'sessions', session.id, 'participants', participantId)
      await updateDoc(participantRef, {
        completed: true,
        score: score,
        totalAnswers: totalQuestions,
        correctAnswers: correctAnswers,
        avgTime: avgTime,
        completedAt: serverTimestamp(),
        lastActivity: serverTimestamp()
      })

      console.log('✅ Participant completion updated:', {
        participantId: participantId,
        completed: true,
        score: score,
        totalAnswers: totalQuestions,
        correctAnswers: correctAnswers,
        completedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('Error updating participant completion:', error)
    }
  }

  const submitQuiz = async (finalAnswers = null) => {
    if (!participantId) return

    // Prevent duplicate submissions
    if (isSubmitted) {
      console.log('⚠️ Quiz already submitted, ignoring duplicate submission')
      return
    }

    // Set submitted flag immediately to prevent race conditions
    setIsSubmitted(true)
    isSubmittedRef.current = true
    console.log('🚀 Starting quiz submission...', finalAnswers ? 'with final answers' : 'from timer')

    // Save submission state immediately
    saveSessionToStorage({
      participant,
      participantId,
      hasJoined,
      isSubmitted: true,
      answers: finalAnswers || answers,
      currentQuestion
    })

    // Use final answers if provided, otherwise use current state from ref (for timer closure)
    const allAnswers = finalAnswers || answersRef.current

    try {
      // Debug logging
      console.log('Submitting quiz with answers:', allAnswers)
      console.log('Total questions:', quiz.questions.length)
      console.log('Total answers recorded:', Object.keys(allAnswers).length)

      // Calculate scores and submit answers to Firebase
      const answerSubmissions = quiz.questions.map(question => {
        const userAnswer = allAnswers[question.id] || ''
        const isCorrect = userAnswer === question.correctAnswer

        console.log(`Question ${question.id}:`, {
          questionText: question.questionText,
          correctAnswer: question.correctAnswer,
          userAnswer: userAnswer,
          isCorrect: isCorrect,
          wasAnswered: userAnswer !== ''
        })

        return {
          participantId: participantId,
          participantName: participant.name,
          questionId: question.id,
          questionText: question.questionText,
          answer: userAnswer,
          isCorrect: isCorrect,
          timeTaken: Math.floor(Math.random() * 30) + 10, // Mock time - in real app this would be tracked
          answeredAt: serverTimestamp()
        }
      })

      console.log(`📊 Submitting answers for ${quiz.questions.length} questions. Answered: ${Object.keys(allAnswers).length}, Correct: ${answerSubmissions.filter(a => a.isCorrect).length}`)

      // Submit all answers to Firebase
      const batch = []
      for (const answerData of answerSubmissions) {
        batch.push(addDoc(collection(db, 'sessions', session.id, 'answers'), answerData))
      }
      await Promise.all(batch)

      // Update participant completion status
      await updateParticipantCompletion(answerSubmissions)

      // 🎵 QUIZ COMPLETE VICTORY SOUND!
      gameShowSounds.playQuizComplete()

      // Clear session from storage since quiz is completed
      clearSessionFromStorage()
    } catch (error) {
      console.error('Error submitting quiz:', error)
      alert('Failed to submit quiz. Please try again.')
      // Reset submitted flag on error so user can retry
      setIsSubmitted(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-32 w-32 border-b-2"
            style={{ borderColor: 'var(--primary-color)' }}
          ></div>
          <p className="mt-4" style={{ color: 'var(--text-secondary-color)' }}>Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (kicked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(to bottom right, var(--error-color-dark, #7f1d1d), var(--error-color, #dc2626), var(--warning-color, #f59e0b))' }}
      >
        {/* 🚨 DRAMATIC KICK BACKDROP */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-30 animate-pulse" style={{ backgroundColor: 'var(--error-color)' }}></div>
          <div className="absolute top-20 right-20 w-24 h-24 rounded-full opacity-40 animate-pulse" style={{ backgroundColor: 'var(--warning-color)', animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 rounded-full opacity-35 animate-pulse" style={{ backgroundColor: 'var(--warning-color-light, #fbbf24)', animationDelay: '1s' }}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: 'var(--error-color)', animationDelay: '1.5s' }}></div>
        </div>

        <div className="bg-gb-navy/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2" style={{ borderColor: 'var(--error-color)' }}>
          {/* 🚨 REMOVAL HEADER */}
          <div className="mb-6">
            <div className="p-3 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--error-color)' }}>
              <div className="text-4xl" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>🚫</div>
            </div>
            <div className="px-6 py-2 rounded-lg" style={{ backgroundColor: 'var(--error-color)', color: 'var(--text-on-primary-color, #ffffff)' }}>
              <h1 className="text-xl font-bold">Removed from Session</h1>
            </div>
          </div>

          {/* 📝 EXPLANATION */}
          <div className="p-6 rounded-xl mb-6 border" style={{ backgroundColor: 'rgba(var(--error-color-rgb, 220, 38, 38), 0.1)', borderColor: 'rgba(var(--error-color-rgb, 220, 38, 38), 0.3)' }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--error-color)' }}>Session Ended</h2>
            <p className="text-base font-medium mb-3" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>You have been removed from the training session</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--error-color)' }}></div>
              <span className="text-sm font-medium" style={{ color: 'var(--error-color-light, #f87171)' }}>Disconnected</span>
            </div>
          </div>

          {/* 🔄 REDIRECT INFO */}
          <div className="bg-gb-gold/10 p-4 rounded-xl mb-6 border border-gb-gold/20">
            <p className="text-gb-gold text-sm font-medium mb-2">Redirecting...</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-on-primary-color, rgba(255,255,255,0.8))' }}>You will be redirected to Gustav Barkhuysen website</p>
            <div className="w-2 h-2 bg-gb-gold rounded-full animate-pulse mx-auto"></div>
          </div>

          {/* 🏢 COMPANY BRANDING */}
          <div className="bg-gb-gold/5 rounded-lg p-3 border border-gb-gold/20">
            <div className="text-center">
              <div className="text-xs text-gb-gold/80 uppercase tracking-wide mb-1">Gustav Barkhuysen Attorneys</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Professional Training System</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (sessionEnded) {
    // Auto-close after 5 seconds
    useEffect(() => {
      // Clear session since it's ended
      clearSessionFromStorage()

      const timer = setTimeout(() => {
        window.close() // Try to close the window/tab
        // If can't close, redirect to Gustav Barkhuysen website as fallback
        setTimeout(() => window.location.href = 'https://gblaw.capetown/', 1000)
      }, 5000)

      return () => clearTimeout(timer)
    }, [])

    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, var(--primary-color-dark, #581c87), var(--secondary-color-dark, #1e3a5f), var(--accent-color-dark, #312e81))' }}>
        {/* 🎬 FINALE BACKDROP */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-30 animate-pulse" style={{ backgroundColor: 'var(--accent-color, #fbbf24)' }}></div>
          <div className="absolute top-20 right-20 w-24 h-24 rounded-full opacity-40 animate-pulse" style={{ backgroundColor: 'var(--error-color)', animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 rounded-full opacity-35 animate-pulse" style={{ backgroundColor: 'var(--success-color)', animationDelay: '1s' }}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: 'var(--secondary-color, #ec4899)', animationDelay: '1.5s' }}></div>
        </div>

        {/* ✨ FAREWELL SPARKLES */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 text-4xl animate-bounce" style={{animationDelay: '0.2s'}}>👋</div>
          <div className="absolute top-1/3 left-10 text-3xl animate-bounce" style={{animationDelay: '0.8s'}}>🌟</div>
          <div className="absolute bottom-1/4 right-10 text-4xl animate-bounce" style={{animationDelay: '1.2s'}}>❤️</div>
          <div className="absolute top-1/4 right-1/4 text-2xl animate-bounce" style={{animationDelay: '1.8s'}}>✨</div>
        </div>
        
        <div
          className="p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-8"
          style={{
            background: 'linear-gradient(to bottom right, var(--surface-color, #ffffff), var(--accent-color-bg, #fefce8))',
            borderColor: 'var(--accent-color)'
          }}
        >
          {/* 🎪 FINALE HEADER */}
          <div
            className="px-6 py-4 rounded-full mb-6 animate-pulse border-4"
            style={{
              background: 'linear-gradient(to right, var(--secondary-color, #ec4899), var(--primary-color), var(--primary-color-dark, #4f46e5))',
              borderColor: 'var(--accent-color-light, #fde047)',
              color: 'var(--text-on-primary-color, #ffffff)'
            }}
          >
            <h1 className="text-2xl font-black uppercase tracking-wider drop-shadow-lg" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>🎊 SHOW'S OVER! 🎊</h1>
          </div>

          {/* 👋 FAREWELL ICON */}
          <div className="mb-6">
            <div
              className="w-24 h-24 mx-auto rounded-full flex items-center justify-center border-8 animate-pulse"
              style={{
                background: 'linear-gradient(to right, var(--secondary-color-light, #f472b6), var(--secondary-color, #a855f7))',
                borderColor: 'var(--accent-color)'
              }}
            >
              <div className="text-4xl">👋</div>
            </div>
          </div>

          {/* 🎤 THANK YOU MESSAGE */}
          <div
            className="p-4 rounded-2xl mb-6 border-4"
            style={{
              background: 'linear-gradient(to right, var(--success-color), var(--success-color-dark, #059669))',
              borderColor: 'var(--accent-color)',
              color: 'var(--text-on-primary-color, #ffffff)'
            }}
          >
            <h2 className="text-xl font-bold uppercase tracking-wide mb-2">Thank You For Playing!</h2>
            <p className="text-lg font-bold">
              {participant.name ? `${participant.name}, you were amazing!` : 'You were amazing!'}
            </p>
          </div>
          
          {/* 🎯 AUTO-CLOSE MESSAGE */}
          <div
            className="p-4 rounded-2xl mb-6 border-4"
            style={{
              background: 'linear-gradient(to right, var(--primary-color-bg, #dbeafe), var(--secondary-color-bg, #f3e8ff))',
              borderColor: 'var(--primary-color-light, #60a5fa)'
            }}
          >
            <p className="text-lg font-bold mb-2" style={{ color: 'var(--primary-color-dark, #1e40af)' }}>
              📺 THAT'S A WRAP! 📺
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--primary-color)' }}>
              This window will close automatically...
            </p>
            <div className="mt-2 rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'var(--primary-color-lighter, #bfdbfe)' }}>
              <div className="h-full w-full animate-pulse" style={{ backgroundColor: 'var(--primary-color)' }}></div>
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color)' }}>
        <div className="p-8 rounded-lg shadow-lg max-w-md w-full mx-4 text-center" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
          <AlertCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--error-color)' }} />
          <h1 className="text-2xl font-bold mb-4">Oops!</h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary-color)' }}>{error}</p>
          <button
            onClick={() => window.location.href = 'https://gblaw.capetown/'}
            className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg hover:bg-gb-gold-light font-bold"
          >
            Visit Gustav Barkhuysen
          </button>
        </div>
      </div>
    )
  }

  if (!hasJoined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden" style={{ background: 'linear-gradient(to bottom right, var(--primary-color-dark, #581c87), var(--secondary-color-dark, #1e3a5f), var(--accent-color-dark, #312e81))' }}>
        {/* Subtle professional background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gb-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(var(--primary-color-rgb, 96, 165, 250), 0.1)' }}></div>
        </div>

        <div className="bg-gb-navy p-8 rounded-3xl shadow-2xl max-w-md w-full text-center relative border-2 border-gb-gold z-10">
          {/* Gustav Barkhuysen Logo */}
          <div className="mb-6">
            <img 
              src="/gblogo.png" 
              alt="Gustav Barkhuysen Attorneys" 
              className="h-16 mx-auto mb-4"
            />
            <div className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg">
              <h1 className="text-xl font-bold">Training Quiz</h1>
            </div>
          </div>
          
          {/* Quiz Information */}
          <div className="p-4 rounded-xl mb-6 border border-gb-gold/20" style={{ backgroundColor: 'rgba(var(--surface-color-rgb, 255, 255, 255), 0.1)' }}>
            <h2 className="text-xl font-bold text-gb-gold mb-2">{quiz.title}</h2>
            <p className="text-gb-gold text-sm">
              Session: <span className="font-mono px-2 py-1 rounded" style={{ backgroundColor: 'rgba(var(--surface-color-rgb, 255, 255, 255), 0.2)' }}>{sessionCode}</span>
            </p>
          </div>
          
          {/* Status Messages */}
          {session.status === 'waiting' && (
            <div
              className="rounded-xl p-4 mb-6 border"
              style={{
                backgroundColor: 'rgba(var(--warning-color-rgb, 234, 179, 8), 0.2)',
                borderColor: 'rgba(var(--warning-color-rgb, 234, 179, 8), 0.5)'
              }}
            >
              <p className="font-semibold" style={{ color: 'var(--warning-color-light, #fde047)' }}>
                ⏳ Waiting for trainer to start
              </p>
              <p className="text-sm" style={{ color: 'var(--warning-color-lighter, #fef08a)' }}>
                Join now to participate
              </p>
            </div>
          )}

          {session.status === 'active' && (
            <div
              className="rounded-xl p-4 mb-6 border"
              style={{
                backgroundColor: 'rgba(var(--success-color-rgb, 34, 197, 94), 0.2)',
                borderColor: 'rgba(var(--success-color-rgb, 34, 197, 94), 0.5)'
              }}
            >
              <p className="font-semibold" style={{ color: 'var(--success-color-light, #86efac)' }}>
                🚀 Quiz is now active!
              </p>
              <p className="text-sm" style={{ color: 'var(--success-color-lighter, #bbf7d0)' }}>
                Join to start answering questions
              </p>
            </div>
          )}
          
          <div className="space-y-6">
            {/* Join as Participant */}
            <div className="p-4 rounded-xl border border-gb-gold/20" style={{ backgroundColor: 'rgba(var(--surface-color-rgb, 255, 255, 255), 0.1)' }}>
              <label className="block text-lg font-bold text-gb-gold mb-3">Enter the Game</label>
              <input
                type="text"
                value={participant.name}
                onChange={(e) => setParticipant({ name: e.target.value })}
                className="w-full px-4 py-3 text-lg font-medium text-center border-2 border-gb-gold/30 rounded-lg focus:outline-none focus:border-gb-gold text-gb-navy"
                style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}
                placeholder="Name..."
                onKeyPress={(e) => e.key === 'Enter' && joinQuiz()}
              />
              <button
                onClick={joinQuiz}
                className={`w-full mt-3 py-3 text-lg font-bold rounded-lg transition-all ${
                  participant.name.trim()
                    ? 'bg-gb-gold text-gb-navy hover:bg-gb-gold-light'
                    : 'cursor-not-allowed'
                }`}
                style={!participant.name.trim() ? { backgroundColor: 'var(--muted-color, #9ca3af)', color: 'var(--text-muted-color, #6b7280)' } : undefined}
                disabled={!participant.name.trim()}
              >
                {participant.name.trim() ? 'Join Quiz' : 'Enter Name First'}
              </button>
            </div>
            
          </div>
        </div>
      </div>
    )
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, var(--primary-color-dark, #581c87), var(--secondary-color-dark, #1e3a5f), var(--accent-color-dark, #312e81))' }}>
        {/* Subtle background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(var(--accent-color-rgb, 250, 204, 21), 0.1)' }}></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(var(--primary-color-rgb, 96, 165, 250), 0.1)' }}></div>
        </div>

        <div className="bg-gb-navy/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2 border-gb-gold">
          {isAdmin ? (
            <>
              {/* Admin Remote Control Interface */}
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gb-gold p-2 rounded-lg">
                  <Users className="w-5 h-5 text-gb-navy" />
                </div>
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Admin Control</h1>
                  <p className="text-gb-gold text-sm font-medium">Session Management</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl mb-6 border border-gb-gold/20" style={{ backgroundColor: 'rgba(var(--surface-color-rgb, 255, 255, 255), 0.1)' }}>
                <h3 className="text-lg font-bold text-gb-gold mb-4">Quiz Session</h3>
                <div className="space-y-2 text-left">
                  <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Title:</span> {quiz.title}</p>
                  <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Time:</span> {Math.floor(quiz.timeLimit / 60)} minutes</p>
                  <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Questions:</span> {quiz.questions.length}</p>
                  <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Status:</span>
                    <span
                      className="ml-2 px-2 py-1 rounded text-sm font-bold"
                      style={{
                        backgroundColor: session.status === 'waiting' ? 'var(--warning-color)' :
                                        session.status === 'active' ? 'var(--success-color)' : 'var(--muted-color, #6b7280)',
                        color: session.status === 'waiting' ? 'var(--text-color, #000000)' : 'var(--text-on-primary-color, #ffffff)'
                      }}
                    >
                      {session.status.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {session.status === 'waiting' && (
                  <button
                    onClick={startQuizAsAdmin}
                    className="w-full py-4 text-lg font-bold rounded-lg transition-all"
                    style={{ backgroundColor: 'var(--success-color)', color: 'var(--text-on-primary-color, #ffffff)' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--success-color-dark, #15803d)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--success-color)'}
                  >
                    🚀 Start Quiz
                  </button>
                )}

                {session.status === 'active' && (
                  <button
                    onClick={endQuizAsAdmin}
                    className="w-full py-4 text-lg font-bold rounded-lg transition-all"
                    style={{ backgroundColor: 'var(--error-color)', color: 'var(--text-on-primary-color, #ffffff)' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--error-color-dark, #b91c1c)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--error-color)'}
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
              <div className="mb-6">
                <div className="bg-gb-gold p-2 rounded-lg w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-6 h-6 text-gb-navy" />
                </div>
                <div className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg">
                  <h1 className="text-xl font-bold">Ready to Start</h1>
                </div>
              </div>
              
              <div className="bg-gb-gold/10 p-4 rounded-xl mb-6 border border-gb-gold/30">
                <h3 className="text-lg font-bold text-gb-gold mb-2">Welcome {participant.name}!</h3>
                <p className="text-sm" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Prepared for {quiz.title}</p>
              </div>

              <div className="bg-gb-gold/5 p-4 rounded-xl border border-gb-gold/20">
                <div className="text-center">
                  <div className="w-2 h-2 bg-gb-gold rounded-full animate-pulse mx-auto mb-2"></div>
                  <p className="text-gb-gold text-sm font-medium">Awaiting trainer to begin session...</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-on-primary-color, rgba(255,255,255,0.8))' }}>Gustav Barkhuysen Training</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(to bottom right, var(--primary-color-dark, #581c87), var(--secondary-color-dark, #831843), var(--error-color-dark, #7f1d1d))' }}
      >
        {/* 🎬 CELEBRATION BACKDROP */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-30 animate-pulse" style={{ backgroundColor: 'var(--accent-color, #fbbf24)' }}></div>
          <div className="absolute top-20 right-20 w-24 h-24 rounded-full opacity-40 animate-pulse" style={{ backgroundColor: 'var(--success-color)', animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 rounded-full opacity-35 animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '1s' }}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: 'var(--secondary-color, #ec4899)', animationDelay: '1.5s' }}></div>
        </div>

        {/* ✨ FLOATING CELEBRATION */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 text-4xl animate-bounce" style={{animationDelay: '0.2s'}}>🎉</div>
          <div className="absolute top-1/3 left-10 text-3xl animate-bounce" style={{animationDelay: '0.8s'}}>🏆</div>
          <div className="absolute bottom-1/4 right-10 text-4xl animate-bounce" style={{animationDelay: '1.2s'}}>⭐</div>
          <div className="absolute top-1/4 right-1/4 text-2xl animate-bounce" style={{animationDelay: '1.8s'}}>🎊</div>
          <div className="absolute bottom-1/3 left-1/4 text-3xl animate-bounce" style={{animationDelay: '2.2s'}}>🎈</div>
        </div>
        
        <div className="bg-gb-navy/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2 border-gb-gold">
          {/* Success Header */}
          <div className="mb-6">
            <div className="bg-gb-gold p-3 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-gb-navy" />
            </div>
            <div className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg">
              <h1 className="text-xl font-bold">Training Complete</h1>
            </div>
          </div>
          
          {/* Participant Recognition */}
          <div className="bg-gb-gold/10 p-6 rounded-xl mb-6 border border-gb-gold/30">
            <h2 className="text-xl font-bold text-gb-gold mb-2">{participant.name}</h2>
            <p className="text-base font-medium mb-3" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Assessment Completed Successfully</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success-color)' }}></div>
              <span className="text-sm font-medium" style={{ color: 'var(--success-color-light, #86efac)' }}>Submitted</span>
            </div>
          </div>

          {/* Status Information */}
          <div className="bg-gb-gold/5 p-4 rounded-xl mb-6 border border-gb-gold/20">
            <p className="text-gb-gold text-sm font-medium mb-2">Processing Results</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-on-primary-color, rgba(255,255,255,0.8))' }}>Awaiting completion by all participants</p>
            <div className="w-2 h-2 bg-gb-gold rounded-full animate-pulse mx-auto"></div>
          </div>
          
          {/* Company Branding */}
          <div className="bg-gb-gold/5 rounded-lg p-3 border border-gb-gold/20">
            <div className="text-center">
              <div className="text-xs text-gb-gold/80 uppercase tracking-wide mb-1">Gustav Barkhuysen Attorneys</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Professional Training System</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Admin interface when session is active
  if (isAdmin && session.status === 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, var(--primary-color-dark, #581c87), var(--secondary-color-dark, #1e3a5f), var(--accent-color-dark, #312e81))' }}>
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: 'var(--accent-color, #fbbf24)' }}></div>
          <div className="absolute top-20 right-20 w-24 h-24 rounded-full opacity-30 animate-pulse" style={{ backgroundColor: 'var(--error-color)', animationDelay: '0.5s' }}></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: 'var(--primary-color)', animationDelay: '1s' }}></div>
          <div className="absolute bottom-10 right-10 w-36 h-36 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: 'var(--success-color)', animationDelay: '1.5s' }}></div>
        </div>
        
        <div className="bg-gb-navy p-8 rounded-3xl shadow-2xl max-w-md w-full mx-4 text-center relative border-2 border-gb-gold">
          <div className="bg-gb-gold text-gb-navy px-6 py-2 rounded-lg mb-6">
            <h1 className="text-xl font-bold">Admin Remote Control</h1>
          </div>
          
          <div
            className="p-4 rounded-xl mb-6 border"
            style={{
              backgroundColor: 'rgba(var(--success-color-rgb, 34, 197, 94), 0.2)',
              borderColor: 'rgba(var(--success-color-rgb, 34, 197, 94), 0.5)'
            }}
          >
            <div className="text-6xl mb-4 animate-pulse" style={{ color: 'var(--success-color-light, #86efac)' }}>🔥</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--success-color-light, #86efac)' }}>QUIZ IS LIVE!</h2>
            <p className="text-lg" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Participants are answering questions</p>
          </div>

          <div className="p-4 rounded-xl mb-6 border border-gb-gold/20" style={{ backgroundColor: 'rgba(var(--surface-color-rgb, 255, 255, 255), 0.1)' }}>
            <h3 className="text-lg font-bold text-gb-gold mb-4">Quiz Session</h3>
            <div className="space-y-2 text-left">
              <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Title:</span> {quiz.title}</p>
              <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Time:</span> {Math.floor(quiz.timeLimit / 60)} minutes</p>
              <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Questions:</span> {quiz.questions.length}</p>
              <p style={{ color: 'var(--text-on-primary-color, #ffffff)' }}><span className="font-semibold">Status:</span>
                <span
                  className="ml-2 px-2 py-1 rounded text-sm font-bold animate-pulse"
                  style={{ backgroundColor: 'var(--success-color)', color: 'var(--text-on-primary-color, #ffffff)' }}
                >
                  🔥 LIVE
                </span>
              </p>
            </div>
          </div>
          
          <button
            onClick={endQuizAsAdmin}
            className="w-full py-4 text-lg font-bold rounded-lg transition-all"
            style={{ backgroundColor: 'var(--error-color)', color: 'var(--text-on-primary-color, #ffffff)' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--error-color-dark, #b91c1c)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--error-color)'}
          >
            ⏹️ End Quiz
          </button>
        </div>
      </div>
    )
  }

  const question = quiz.questions[currentQuestion]

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'var(--background-color)' }}>
      {/* 🎬 SUBTLE BACKGROUND */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-gb-gold/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-gb-navy/5 rounded-full blur-3xl"></div>
      </div>

      {/* 📺 SIMPLIFIED MOBILE HEADER */}
      <header className="relative z-10 bg-gb-navy shadow-lg border-b-2 border-gb-gold">
        <div className="px-4 py-4">
          {/* Main row: Title and Timer */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gb-gold flex-1 truncate">
              {quiz.title}
            </h1>

            {/* ⏰ CLEAR TIMER */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono font-bold ${
                timeRemaining <= 30
                  ? 'border'
                  : 'bg-gb-gold text-gb-navy'
              }`}
              style={timeRemaining <= 30 ? {
                backgroundColor: 'var(--error-color-bg, #fef2f2)',
                color: 'var(--error-color-dark, #b91c1c)',
                borderColor: 'var(--error-color-light, #fca5a5)'
              } : undefined}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTime(timeRemaining)}</span>
            </div>
          </div>

          {/* Secondary info row */}
          <div className="flex items-center justify-between mt-2 text-sm">
            <div className="text-gb-gold font-medium">
              {participant.name}
            </div>

            <div className="flex items-center gap-3 text-gb-gold/80">
              <span>{totalContestants} participants</span>
              <span>{currentStreak} streak</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Session Restored Notification */}
          {sessionRestored && (
            <div
              className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg border-2 animate-pulse"
              style={{
                backgroundColor: 'var(--success-color)',
                borderColor: 'var(--success-color-light, #4ade80)',
                color: 'var(--text-on-primary-color, #ffffff)'
              }}
            >
              <div className="flex items-center gap-2">
                <div className="text-xl">🔄</div>
                <div>
                  <div className="font-bold">Session Restored!</div>
                  <div className="text-sm opacity-90">Your progress has been recovered</div>
                </div>
              </div>
            </div>
          )}
          {/* 📊 IMPROVED PROGRESS INDICATOR */}
          <div className="rounded-xl p-4 mb-6 border border-gb-gold/30 shadow-sm" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-gb-navy font-bold text-lg">
                Question {currentQuestion + 1} of {quiz.questions.length}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {quiz.questions.map((_, index) => (
                <button
                  key={index}
                  className={`min-w-[44px] h-11 rounded-lg border-2 flex items-center justify-center font-bold transition-colors ${
                    index === currentQuestion ? 'bg-gb-gold text-gb-navy border-gb-gold' : ''
                  }`}
                  style={index !== currentQuestion ? { backgroundColor: 'var(--background-secondary-color, #f3f4f6)', color: 'var(--text-muted-color, #6b7280)', borderColor: 'var(--border-color, #d1d5db)' } : undefined}
                  disabled={true}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
          
          {/* 🎪 CLEAN QUESTION CARD */}
          <div ref={questionRef} className="rounded-xl shadow-lg p-6 mb-6 border border-gb-gold/30" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gb-navy mb-4 leading-relaxed">{question.questionText}</h2>
            </div>
            
            {/* 🎪 IMPROVED ANSWER BUTTONS */}
            <div className="space-y-3">
              {(question.options || []).map((option, index) => {
                const isSelected = answers[question.id] === option
                const isCorrect = option === question.correctAnswer
                const buttonLabels = ['A', 'B', 'C', 'D']

                // Clean styling with no hover states to prevent mobile sticky highlighting

                // Show correct/incorrect styling ONLY during answerSelected state
                let buttonInlineStyle = {}
                let labelInlineStyle = {}
                let buttonClass = ''
                let labelClass = ''
                buttonInlineStyle = { borderColor: 'var(--border-color, #d1d5db)', backgroundColor: 'var(--surface-color, #ffffff)' }
                labelInlineStyle = { borderColor: 'var(--border-secondary-color, #9ca3af)', backgroundColor: 'var(--background-secondary-color, #f3f4f6)', color: 'var(--text-secondary-color, #374151)' }

                if (answerSelected) {
                  // Only show correct/incorrect styling when answerSelected is true
                  if (isCorrect) {
                    buttonClass = 'border-2'
                    buttonInlineStyle = {
                      borderColor: 'var(--success-color)',
                      backgroundColor: 'var(--success-color-bg, #f0fdf4)'
                    }
                    labelClass = 'border-2'
                    labelInlineStyle = {
                      borderColor: 'var(--success-color)',
                      backgroundColor: 'var(--success-color)',
                      color: 'var(--text-on-primary-color, #ffffff)'
                    }
                  } else if (isSelected && !isCorrect) {
                    buttonClass = 'border-2'
                    buttonInlineStyle = {
                      borderColor: 'var(--error-color)',
                      backgroundColor: 'var(--error-color-bg, #fef2f2)'
                    }
                    labelClass = 'border-2'
                    labelInlineStyle = {
                      borderColor: 'var(--error-color)',
                      backgroundColor: 'var(--error-color)',
                      color: 'var(--text-on-primary-color, #ffffff)'
                    }
                  } else {
                    buttonClass = 'opacity-70'
                    buttonInlineStyle = { borderColor: 'var(--border-color, #d1d5db)', backgroundColor: 'var(--background-color, #fafafa)' }
                    labelInlineStyle = { borderColor: 'var(--border-secondary-color, #9ca3af)', backgroundColor: 'var(--muted-color, #d1d5db)', color: 'var(--text-muted-color, #6b7280)' }
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => selectAnswer(question.id, option)}
                    disabled={answerSelected}
                    className={`w-full min-h-[60px] p-4 text-left rounded-xl transition-all border-2 ${buttonClass} ${
                      answerSelected ? 'cursor-not-allowed' : 'focus:outline-none active:scale-[0.98]'
                    }`}
                    style={{
                      WebkitTapHighlightColor: 'transparent', // Remove mobile tap highlight
                      ...buttonInlineStyle
                    }}
                  >
                    <div className="flex items-center">
                      <div
                        className={`min-w-[44px] h-11 rounded-lg border-2 mr-4 flex items-center justify-center font-bold ${labelClass}`}
                        style={labelInlineStyle}
                      >
                        {answerSelected && isCorrect ? '✓' : answerSelected && isSelected && !isCorrect ? '✗' : buttonLabels[index]}
                      </div>
                      <span className="text-base font-medium leading-relaxed" style={{ color: 'var(--text-primary-color, #1f2937)' }}>{option}</span>
                      {answerSelected && isCorrect && (
                        <div className="ml-auto text-xl">🎉</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 🎊 SUBTLE FEEDBACK OVERLAY */}
          {showAnswerFeedback && (
            <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--overlay-color, rgba(0,0,0,0.6))' }}>
              <div
                className="text-center p-6 rounded-xl border-2 max-w-sm mx-4"
                style={{
                  backgroundColor: answerIsCorrect ? 'var(--success-color-bg, #f0fdf4)' : 'var(--error-color-bg, #fef2f2)',
                  borderColor: answerIsCorrect ? 'var(--success-color)' : 'var(--error-color)'
                }}
              >
                <div className="text-4xl mb-3">
                  {answerIsCorrect ? '✓' : '✗'}
                </div>
                <h2
                  className="text-2xl font-bold mb-2"
                  style={{ color: answerIsCorrect ? 'var(--success-color-dark, #15803d)' : 'var(--error-color-dark, #b91c1c)' }}
                >
                  {answerIsCorrect ? 'Correct!' : 'Incorrect'}
                </h2>
                {answerIsCorrect && (
                  <p className="text-lg font-medium" style={{ color: 'var(--success-color)' }}>Streak: {currentStreak}</p>
                )}
              </div>
            </div>
          )}

          {/* 🎯 CLEAR STATUS MESSAGE */}
          {!answerSelected && (
            <div className="text-center bg-gb-navy/5 p-4 rounded-xl border border-gb-gold/30">
              <p className="text-lg font-bold text-gb-navy">
                Select your answer to continue
              </p>
              <p className="text-sm text-gb-navy/70 mt-1">
                Quiz will automatically advance to the next question
              </p>
            </div>
          )}

          {answerSelected && !showAnswerFeedback && (
            <div className="text-center bg-gb-gold/10 p-4 rounded-xl border border-gb-gold/30">
              <p className="text-lg font-bold text-gb-navy">
                Processing answer...
              </p>
            </div>
          )}

          {/* NAVIGATION CONTROLS */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-color, #e5e7eb)' }}>
            <button
              onClick={prevQuestion}
              disabled={currentQuestion === 0 || answerSelected}
              className="px-4 py-2 text-sm font-medium text-gb-navy border border-gb-navy/30 rounded-lg hover:bg-gb-navy/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <span className="text-sm text-gb-navy/70">
              Question {currentQuestion + 1} of {quiz.questions.length}
            </span>

            <button
              onClick={nextQuestion}
              disabled={currentQuestion === quiz.questions.length - 1 || !answers[question.id] || answerSelected}
              className="px-4 py-2 text-sm font-medium bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default QuizTaking
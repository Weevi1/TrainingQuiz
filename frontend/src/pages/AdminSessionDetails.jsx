import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Users, TrendingUp, AlertCircle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '../lib/firebase'
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore'

function AdminSessionDetails() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedParticipants, setExpandedParticipants] = useState(new Set())

  useEffect(() => {
    loadSessionDetails()
  }, [sessionId])

  const loadSessionDetails = async () => {
    try {
      console.log('📊 Loading admin session details for:', sessionId)

      // Get session data from Firebase
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId))
      if (!sessionDoc.exists()) {
        throw new Error('Session not found')
      }
      const sessionData = { id: sessionDoc.id, ...sessionDoc.data() }

      // Get quiz data
      let quizData = null
      let questions = []
      if (sessionData.quizId) {
        const quizDoc = await getDoc(doc(db, 'quizzes', sessionData.quizId))
        if (quizDoc.exists()) {
          quizData = quizDoc.data()
          questions = quizData.questions || []
        }
      }

      // Get all participants
      const participantsSnapshot = await getDocs(
        collection(db, 'sessions', sessionId, 'participants')
      )
      const participants = participantsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Get all answers
      const answersSnapshot = await getDocs(
        collection(db, 'sessions', sessionId, 'answers')
      )
      const answers = answersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Organize data by participant
      const participantData = {}

      participants.forEach(participant => {
        participantData[participant.id] = {
          ...participant,
          answers: [],
          totalQuestions: questions.length || 0,
          correctAnswers: 0,
          totalTime: 0,
          score: 0
        }
      })

      // Add answers to participants - deduplicate by keeping only the most recent answer per participant per question
      const uniqueAnswers = new Map()

      answers.forEach(answer => {
        const participantId = answer.participantId
        const questionId = answer.questionId || answer.question_id
        const key = `${participantId}-${questionId}`
        const existing = uniqueAnswers.get(key)

        // Keep the most recent answer (latest answeredAt timestamp)
        const answerTime = answer.answeredAt?.toDate?.() || new Date(answer.answeredAt || 0)
        const existingTime = existing ? (existing.answeredAt?.toDate?.() || new Date(existing.answeredAt || 0)) : null

        if (!existing || answerTime > existingTime) {
          uniqueAnswers.set(key, answer)
        }
      })

      // Process only unique answers and match with questions
      Array.from(uniqueAnswers.values()).forEach(answer => {
        const participantId = answer.participantId
        const questionId = answer.questionId || answer.question_id

        if (participantData[participantId]) {
          // Find the matching question
          const question = questions.find(q => q.id === questionId)

          participantData[participantId].answers.push({
            ...answer,
            question_id: questionId,
            question: question || {
              id: questionId,
              questionText: answer.questionText || 'Question text not found',
              correctAnswer: answer.correctAnswer || '',
              options: answer.options || []
            },
            is_correct: answer.isCorrect,
            time_taken: answer.timeTaken || 0,
            answer: answer.selectedAnswer || answer.answer
          })

          if (answer.isCorrect) {
            participantData[participantId].correctAnswers++
          }
          participantData[participantId].totalTime += answer.timeTaken || 0
        }
      })

      // Calculate scores and average times
      Object.values(participantData).forEach(participant => {
        // Use the actual number of unique questions answered, not total questions in quiz
        const uniqueQuestionsAnswered = new Set(participant.answers.map(a => a.question_id)).size
        participant.score = uniqueQuestionsAnswered > 0 
          ? Math.round((participant.correctAnswers / uniqueQuestionsAnswered) * 100) 
          : 0
        participant.avgTime = participant.answers.length > 0 
          ? Math.round(participant.totalTime / participant.answers.length) 
          : 0
      })

      // Sort participants by score (highest first)
      const sortedParticipants = Object.values(participantData).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.avgTime - b.avgTime
      })

      setSessionData({
        session: {
          ...sessionData,
          quizzes: {
            id: sessionData.quizId,
            title: quizData?.title || sessionData.quizTitle || 'Unknown Quiz',
            description: quizData?.description || '',
            questions: questions
          }
        },
        participants: sortedParticipants,
        questions: questions.sort((a, b) => (a.order_index || a.id) - (b.order_index || b.id))
      })
    } catch (error) {
      console.error('Error loading session details:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    let date
    if (dateString?.toDate) {
      date = dateString.toDate()
    } else if (typeof dateString === 'string') {
      date = new Date(dateString)
    } else {
      date = dateString
    }

    if (!date || isNaN(date.getTime())) {
      return 'Date not available'
    }

    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const toggleParticipantExpanded = (participantId) => {
    const newExpanded = new Set(expandedParticipants)
    if (newExpanded.has(participantId)) {
      newExpanded.delete(participantId)
    } else {
      newExpanded.add(participantId)
    }
    setExpandedParticipants(newExpanded)
  }

  const getAnswerForQuestion = (participant, questionId) => {
    return participant.answers.find(answer => answer.question_id === questionId)
  }

  const getParticipantWrongAnswers = (participant) => {
    return participant.answers.filter(answer => !answer.is_correct)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gb-navy flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gb-gold"></div>
          <p className="mt-4 text-gb-gold">Loading session details...</p>
        </div>
      </div>
    )
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gb-navy flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--error-color, #f87171)' }} />
          <h2 className="text-xl font-semibold text-gb-gold mb-2">Session Not Found</h2>
          <p className="text-gb-gold/80">The requested session could not be loaded.</p>
          <button
            onClick={() => navigate('/admin/results')}
            className="mt-4 px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-medium"
          >
            Back to Results
          </button>
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
              onClick={() => navigate('/admin/results')}
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
              <h1 className="text-3xl font-bold text-gb-gold font-serif">Session Details</h1>
              <p className="text-gb-gold/80">{sessionData.session.quizzes.title}</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {/* Session Overview */}
        <div className="rounded-lg shadow border border-gb-gold/20 p-6 mb-8" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
          <h2 className="text-2xl font-semibold text-gb-navy font-serif mb-6">Training Session Overview</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <Calendar className="w-8 h-8 text-gb-gold mx-auto mb-2" />
              <div className="text-sm text-gb-navy/70">Session Date</div>
              <div className="font-semibold text-gb-navy">
                {formatDate(sessionData.session.completedAt || sessionData.session.createdAt || sessionData.session.created_at)}
              </div>
            </div>
            
            <div className="text-center">
              <Users className="w-8 h-8 text-gb-gold mx-auto mb-2" />
              <div className="text-sm text-gb-navy/70">Participants</div>
              <div className="font-semibold text-gb-navy text-2xl">{sessionData.participants.length}</div>
            </div>
            
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-gb-gold mx-auto mb-2" />
              <div className="text-sm text-gb-navy/70">Average Score</div>
              <div className="font-semibold text-gb-navy text-2xl">
                {sessionData.participants.length > 0 
                  ? Math.round(sessionData.participants.reduce((sum, p) => sum + p.score, 0) / sessionData.participants.length)
                  : 0}%
              </div>
            </div>
            
            <div className="text-center">
              <Clock className="w-8 h-8 text-gb-gold mx-auto mb-2" />
              <div className="text-sm text-gb-navy/70">Questions</div>
              <div className="font-semibold text-gb-navy text-2xl">{sessionData.questions.length}</div>
            </div>
          </div>

          <div className="bg-gb-gold/10 rounded-lg p-4">
            <div className="font-semibold text-gb-navy mb-2">Training Description:</div>
            <div className="text-gb-navy/80">
              {sessionData.session.quizzes.description || 'No description provided'}
            </div>
          </div>
        </div>

        {/* Participant Performance Details */}
        <div className="rounded-lg shadow border border-gb-gold/20 p-6" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
          <h2 className="text-2xl font-semibold text-gb-navy font-serif mb-6">Participant Performance Analysis</h2>
          
          <div className="space-y-6">
            {sessionData.participants.map((participant, index) => {
              const wrongAnswers = getParticipantWrongAnswers(participant)
              
              return (
                <div key={participant.id} className="border border-gb-gold/30 rounded-lg p-6">
                  <div 
                    className="flex justify-between items-start mb-4 cursor-pointer hover:bg-gb-gold/5 -m-6 p-6 rounded-lg"
                    onClick={() => toggleParticipantExpanded(participant.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-gb-navy flex items-center gap-2">
                          <span className={`text-2xl ${
                            index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'
                          }`}></span>
                          {participant.name}
                        </h3>
                        <div className="text-gb-navy/70 mt-1">
                          Joined: {formatDate(participant.joinedAt || participant.joined_at)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div
                          className="text-3xl font-bold"
                          style={{
                            color: participant.score >= 80 ? 'var(--success-color)' :
                                   participant.score >= 60 ? 'var(--warning-color)' :
                                   'var(--error-color)'
                          }}
                        >
                          {participant.score}%
                        </div>
                        <div className="text-sm text-gb-navy/70">
                          {participant.correctAnswers}/{new Set(participant.answers.map(a => a.question_id)).size} correct
                        </div>
                        <div className="text-sm text-gb-navy/70">
                          Avg: {participant.avgTime}s per question
                        </div>
                      </div>
                      
                      <div className="text-gb-gold">
                        {expandedParticipants.has(participant.id) ? (
                          <ChevronUp className="w-6 h-6" />
                        ) : (
                          <ChevronDown className="w-6 h-6" />
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedParticipants.has(participant.id) && (
                  <>
                    {/* Question-by-Question Breakdown */}
                    <div className="grid gap-3">
                    <h4 className="font-semibold text-gb-navy border-b border-gb-gold/20 pb-2">
                      Question-by-Question Results
                    </h4>
                    
                    {sessionData.questions.map((question, qIndex) => {
                      const answer = getAnswerForQuestion(participant, question.id)
                      
                      return (
                        <div
                          key={question.id}
                          className="p-4 rounded-lg border-2"
                          style={{
                            borderColor: answer?.is_correct ? 'var(--success-border-color)' : 'var(--error-border-color)',
                            backgroundColor: answer?.is_correct ? 'var(--success-light-color)' : 'var(--error-light-color)'
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {answer?.is_correct ? (
                                <CheckCircle className="w-5 h-5" style={{ color: 'var(--success-color)' }} />
                              ) : (
                                <XCircle className="w-5 h-5" style={{ color: 'var(--error-color)' }} />
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <div className="font-medium text-gb-navy mb-2">
                                Q{qIndex + 1}: {question.questionText || question.question_text}
                              </div>
                              
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="font-medium" style={{ color: 'var(--success-color)' }}>✓ Correct Answer:</div>
                                  <div className="text-gb-navy/80">{question.correctAnswer || question.correct_answer}</div>
                                </div>

                                {answer && (
                                  <div>
                                    <div
                                      className="font-medium"
                                      style={{ color: answer.is_correct ? 'var(--success-color)' : 'var(--error-color)' }}
                                    >
                                      {answer.is_correct ? '✓' : '✗'} {participant.name}'s Answer:
                                    </div>
                                    <div className="text-gb-navy/80">{answer.answer}</div>
                                    {answer.time_taken && (
                                      <div className="text-gb-navy/60 text-xs mt-1">
                                        Answered in {answer.time_taken}s
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Areas for Improvement */}
                  {wrongAnswers.length > 0 && (
                    <div
                      className="mt-4 p-4 rounded-lg border"
                      style={{ backgroundColor: 'var(--error-light-color)', borderColor: 'var(--error-border-color)' }}
                    >
                      <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--error-text-color)' }}>
                        <AlertCircle className="w-4 h-4" />
                        Areas Requiring Follow-up Training ({wrongAnswers.length} questions)
                      </h4>
                      <ul className="text-sm space-y-1" style={{ color: 'var(--error-color)' }}>
                        {wrongAnswers.map((wrong, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="font-bold" style={{ color: 'var(--error-color)' }}>•</span>
                            <span>{wrong.question.questionText || wrong.question.question_text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {wrongAnswers.length === 0 && (
                    <div
                      className="mt-4 p-4 rounded-lg border"
                      style={{ backgroundColor: 'var(--success-light-color)', borderColor: 'var(--success-border-color)' }}
                    >
                      <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--success-text-color)' }}>
                        <CheckCircle className="w-4 h-4" />
                        Perfect Score! No follow-up training required.
                      </h4>
                    </div>
                  )}
                  </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminSessionDetails
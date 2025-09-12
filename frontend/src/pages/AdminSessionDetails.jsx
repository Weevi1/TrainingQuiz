import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Users, TrendingUp, AlertCircle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
      // Get session with quiz data
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select(`
          *,
          quizzes (
            id,
            title,
            description,
            questions (
              id,
              question_text,
              options,
              correct_answer,
              points,
              order_index
            )
          )
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError

      // Get all participants
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionId)

      if (participantsError) throw participantsError

      // Get all answers with participant and question details
      const { data: answers, error: answersError } = await supabase
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
            question_text,
            options,
            correct_answer,
            points,
            order_index
          )
        `)
        .eq('participants.session_id', sessionId)

      if (answersError) throw answersError

      // Organize data by participant
      const participantData = {}
      
      participants.forEach(participant => {
        participantData[participant.id] = {
          ...participant,
          answers: [],
          totalQuestions: session.quizzes.questions?.length || 0,
          correctAnswers: 0,
          totalTime: 0,
          score: 0
        }
      })

      // Add answers to participants - deduplicate by keeping only the most recent answer per participant per question
      const uniqueAnswers = new Map()
      
      answers.forEach(answer => {
        const key = `${answer.participants.id}-${answer.question_id}`
        const existing = uniqueAnswers.get(key)
        
        // Keep the most recent answer (latest answered_at timestamp)
        if (!existing || new Date(answer.answered_at) > new Date(existing.answered_at)) {
          uniqueAnswers.set(key, answer)
        }
      })
      
      // Process only unique answers
      Array.from(uniqueAnswers.values()).forEach(answer => {
        const participantId = answer.participants.id
        if (participantData[participantId]) {
          participantData[participantId].answers.push({
            ...answer,
            question: answer.questions
          })
          
          if (answer.is_correct) {
            participantData[participantId].correctAnswers++
          }
          participantData[participantId].totalTime += answer.time_taken || 0
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
        session,
        participants: sortedParticipants,
        questions: session.quizzes.questions?.sort((a, b) => a.order_index - b.order_index) || []
      })
    } catch (error) {
      console.error('Error loading session details:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
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
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
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
        <div className="bg-white/95 rounded-lg shadow border border-gb-gold/20 p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gb-navy font-serif mb-6">Training Session Overview</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <Calendar className="w-8 h-8 text-gb-gold mx-auto mb-2" />
              <div className="text-sm text-gb-navy/70">Session Date</div>
              <div className="font-semibold text-gb-navy">
                {formatDate(sessionData.session.ended_at || sessionData.session.created_at)}
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
        <div className="bg-white/95 rounded-lg shadow border border-gb-gold/20 p-6">
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
                          Joined: {formatDate(participant.joined_at)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${
                          participant.score >= 80 ? 'text-green-600' :
                          participant.score >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
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
                        <div key={question.id} className={`p-4 rounded-lg border-2 ${
                          answer?.is_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                        }`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {answer?.is_correct ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-600" />
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <div className="font-medium text-gb-navy mb-2">
                                Q{qIndex + 1}: {question.question_text}
                              </div>
                              
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-green-600 font-medium">✓ Correct Answer:</div>
                                  <div className="text-gb-navy/80">{question.correct_answer}</div>
                                </div>
                                
                                {answer && (
                                  <div>
                                    <div className={`font-medium ${
                                      answer.is_correct ? 'text-green-600' : 'text-red-600'
                                    }`}>
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
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Areas Requiring Follow-up Training ({wrongAnswers.length} questions)
                      </h4>
                      <ul className="text-red-700 text-sm space-y-1">
                        {wrongAnswers.map((wrong, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-500 font-bold">•</span>
                            <span>{wrong.question.question_text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {wrongAnswers.length === 0 && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-semibold text-green-800 flex items-center gap-2">
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
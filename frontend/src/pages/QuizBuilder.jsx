import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'
import { db } from '../lib/firebase'
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, deleteDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'

function QuizBuilder() {
  const navigate = useNavigate()
  const { quizId } = useParams()
  const { user } = useAuth()
  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    timeLimit: 600,
    questions: []
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (quizId) {
      setIsEditing(true)
      loadQuiz()
    }
  }, [quizId])

  const loadQuiz = async () => {
    setLoading(true)
    try {
      console.log('📚 Loading quiz for editing:', quizId)

      // Get quiz from Firebase
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId))
      if (!quizDoc.exists()) {
        alert('Quiz not found. Redirecting to create new quiz.')
        navigate('/admin/quiz/create')
        return
      }

      const quizData = { id: quizDoc.id, ...quizDoc.data() }

      // Transform questions to match the expected format
      const transformedQuestions = (quizData.questions || [])
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .map((q, index) => ({
          id: q.id || `q_${index}`,
          questionText: q.questionText || q.question_text || '',
          questionType: q.questionType || q.question_type || 'multiple_choice',
          options: Array.isArray(q.options) ? q.options :
                   (typeof q.options === 'string' ? JSON.parse(q.options) : ["", "", "", ""]),
          correctAnswer: q.correctAnswer || q.correct_answer || '',
          points: q.points || 1
        }))

      setQuiz({
        id: quizData.id,
        title: quizData.title,
        description: quizData.description || '',
        timeLimit: quizData.timeLimit,
        questions: transformedQuestions
      })

      console.log('✅ Quiz loaded successfully:', quizData.title)
    } catch (error) {
      console.error('Error loading quiz:', error)
      alert('Error loading quiz. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const saveQuiz = async () => {
    console.log('🚀 SAVE QUIZ CLICKED!')
    console.log('📝 Current quiz state:', quiz)
    console.log('✅ Quiz title:', quiz.title)
    console.log('❓ Number of questions:', quiz.questions.length)
    console.log('🔄 Is editing:', isEditing)

    // Validation check
    if (!quiz.title) {
      console.log('❌ VALIDATION FAILED: No quiz title')
      alert('Please add a quiz title')
      return
    }

    if (quiz.questions.length === 0) {
      console.log('❌ VALIDATION FAILED: No questions added')
      alert('Please add at least one question')
      return
    }

    console.log('✅ VALIDATION PASSED - Starting save process...')
    setSaving(true)

    try {
      const trainerId = user?.uid
      console.log('👤 Using trainer ID:', trainerId)

      if (isEditing && quiz.id) {
        // Update existing quiz
        console.log('📝 Updating existing quiz with ID:', quiz.id)

        const quizToUpdate = {
          title: quiz.title,
          description: quiz.description || '',
          timeLimit: quiz.timeLimit,
          questions: quiz.questions.map((question, index) => ({
            id: question.id,
            questionText: question.questionText,
            questionType: question.questionType,
            options: question.options,
            correctAnswer: question.correctAnswer,
            points: question.points,
            orderIndex: index
          })),
          updatedAt: new Date().toISOString()
        }

        await updateDoc(doc(db, 'quizzes', quiz.id), quizToUpdate)
        console.log('✅ Quiz updated successfully')

      } else {
        // Create new quiz
        console.log('➕ Creating new quiz...')

        const quizToInsert = {
          trainerId: trainerId,
          title: quiz.title,
          description: quiz.description || '',
          timeLimit: quiz.timeLimit,
          questions: quiz.questions.map((question, index) => ({
            id: question.id,
            questionText: question.questionText,
            questionType: question.questionType,
            options: question.options,
            correctAnswer: question.correctAnswer,
            points: question.points,
            orderIndex: index
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        const newQuizRef = await addDoc(collection(db, 'quizzes'), quizToInsert)
        console.log('✅ Quiz created successfully with ID:', newQuizRef.id)
      }

      console.log('🎉 ALL DATA SAVED SUCCESSFULLY!')
      alert(isEditing ? 'Quiz updated successfully!' : 'Quiz saved successfully!')
      navigate('/admin/quizzes')

    } catch (error) {
      console.error('💥 SAVE QUIZ ERROR:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details
      })
      console.error('Current user ID:', user?.uid)
      console.error('Quiz trainer ID:', quiz.trainerId || 'not set')
      alert(`Error ${isEditing ? 'updating' : 'saving'} quiz: ${error.message}`)
    } finally {
      console.log('🏁 Save process completed, setting saving to false')
      setSaving(false)
    }
  }

  const addQuestion = () => {
    setQuiz(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: Date.now(),
          questionText: '',
          questionType: 'multiple_choice',
          options: ['', '', '', ''],
          correctAnswer: '',
          points: 1
        }
      ]
    }))
  }

  const updateQuestion = (questionId, field, value) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, [field]: value } : q
      )
    }))
  }

  const removeQuestion = (questionId) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gb-navy flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gb-gold"></div>
          <p className="mt-4 text-gb-gold">Loading quiz...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gb-navy">
      <header className="bg-gb-navy border-b border-gb-gold/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/quizzes')}
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
                <h1 className="text-3xl font-bold text-gb-gold font-serif">
                  {isEditing ? 'Edit Quiz' : 'Create Quiz'}
                </h1>
                <p className="text-gb-gold/80 mt-1">
                  {isEditing ? 'Update your quiz content and settings' : 'Build an engaging training quiz'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/admin/quizzes')}
                className="px-4 py-2 text-gb-gold border border-gb-gold/30 rounded-lg hover:bg-gb-gold/20 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={saveQuiz}
                disabled={saving}
                className="px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light flex items-center gap-2 disabled:opacity-50 font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Quiz' : 'Save Quiz')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="rounded-lg shadow border border-gb-gold/20 p-6 mb-6" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
          <h2 className="text-xl font-semibold text-gb-navy font-serif mb-4">Quiz Details</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gb-navy mb-2">Quiz Title</label>
              <input 
                type="text" 
                value={quiz.title}
                onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-3 border border-gb-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-gb-gold focus:border-gb-gold transition-colors"
                placeholder="Enter quiz title..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gb-navy mb-2">Time Limit (minutes)</label>
              <input 
                type="number" 
                value={quiz.timeLimit / 60}
                onChange={(e) => setQuiz(prev => ({ ...prev, timeLimit: e.target.value * 60 }))}
                className="w-full px-4 py-3 border border-gb-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-gb-gold focus:border-gb-gold transition-colors"
                min="1"
                max="180"
              />
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-semibold text-gb-navy mb-2">Description (optional)</label>
            <textarea 
              value={quiz.description}
              onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-3 border border-gb-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-gb-gold focus:border-gb-gold transition-colors"
              placeholder="Provide additional context or instructions for your quiz..."
            />
          </div>
        </div>

        <div className="rounded-lg shadow border border-gb-gold/20 p-6" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gb-navy font-serif">Questions</h2>
            <p className="text-gb-navy/70 text-sm mt-1">Create engaging questions for your training quiz</p>
          </div>

          {quiz.questions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gb-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gb-gold/60" />
              </div>
              <p className="text-gb-navy/60 text-lg mb-4">No questions added yet</p>
              <p className="text-gb-navy/50 text-sm mb-6">Click "Add Question" below to create your first question</p>
              <button
                onClick={addQuestion}
                className="bg-gb-gold text-gb-navy px-4 py-2 rounded-lg hover:bg-gb-gold-light flex items-center gap-2 font-medium transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {quiz.questions.map((question, index) => (
                <div key={question.id} className="border border-gb-gold/30 rounded-lg p-6 bg-gradient-to-r from-white to-gb-gold/5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gb-gold rounded-full flex items-center justify-center text-gb-navy font-bold text-sm">
                        {index + 1}
                      </div>
                      <h3 className="font-semibold text-gb-navy">Question {index + 1}</h3>
                    </div>
                    <button
                      onClick={() => removeQuestion(question.id)}
                      className="p-2 rounded-lg transition-colors"
                      style={{
                        color: 'var(--error-color, #dc2626)',
                        '--hover-bg': 'var(--error-light-color, #fef2f2)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--error-light-color, #fef2f2)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gb-navy mb-2">Question Text</label>
                      <textarea 
                        value={question.questionText}
                        onChange={(e) => updateQuestion(question.id, 'questionText', e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border border-gb-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-gb-gold focus:border-gb-gold transition-colors resize-none"
                        placeholder="Enter your question here..."
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gb-navy mb-3">Answer Options (select the correct one)</label>
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            question.correctAnswer === option
                              ? ''
                              : 'border-gb-gold/30 hover:border-gb-gold/50'
                          }`}
                          style={question.correctAnswer === option ? {
                            borderColor: 'var(--success-color, #22c55e)',
                            backgroundColor: 'var(--success-light-color, #f0fdf4)'
                          } : {}}
                        >
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === option}
                            onChange={() => updateQuestion(question.id, 'correctAnswer', option)}
                            style={{
                              accentColor: 'var(--success-color, #22c55e)'
                            }}
                          />
                          <span className="text-sm font-medium text-gb-navy/70 w-6">
                            {String.fromCharCode(65 + optionIndex)}.
                          </span>
                          <input 
                            type="text" 
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...question.options]
                              newOptions[optionIndex] = e.target.value
                              updateQuestion(question.id, 'options', newOptions)
                              
                              // Auto-update correct answer if this was the selected option
                              if (question.correctAnswer === question.options[optionIndex]) {
                                updateQuestion(question.id, 'correctAnswer', e.target.value)
                              }
                            }}
                            className="flex-1 px-3 py-2 border-0 bg-transparent focus:outline-none focus:ring-0 text-gb-navy placeholder-gb-navy/50"
                            placeholder={`Enter option ${String.fromCharCode(65 + optionIndex)} here...`}
                          />
                        </div>
                      ))}
                      {!question.correctAnswer && (
                        <p
                          className="text-sm flex items-center gap-2 mt-2"
                          style={{ color: 'var(--warning-color, #d97706)' }}
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              backgroundColor: 'var(--warning-light-color, #fef3c7)',
                              color: 'var(--warning-color, #d97706)'
                            }}
                          >!</span>
                          Please select the correct answer
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={addQuestion}
                className="bg-gb-gold text-gb-navy px-4 py-2 rounded-lg hover:bg-gb-gold-light flex items-center gap-2 font-medium transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default QuizBuilder
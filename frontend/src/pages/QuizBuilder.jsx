import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
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
      // Get quiz with questions
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select(`
          *,
          questions (*)
        `)
        .eq('id', quizId)
        .single()

      if (quizError) {
        console.error('Error loading quiz:', quizError)
        alert('Error loading quiz. Redirecting to create new quiz.')
        navigate('/admin/quiz/create')
        return
      }

      // Transform questions to match the expected format
      const transformedQuestions = quizData.questions
        .sort((a, b) => a.order_index - b.order_index)
        .map(q => ({
          id: q.id,
          questionText: q.question_text,
          questionType: q.question_type,
          options: JSON.parse(q.options || '["", "", "", ""]'),
          correctAnswer: q.correct_answer,
          points: q.points || 1
        }))

      setQuiz({
        id: quizData.id,
        title: quizData.title,
        description: quizData.description || '',
        timeLimit: quizData.time_limit,
        questions: transformedQuestions
      })
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
      const trainerId = user?.id
      console.log('👤 Using trainer ID:', trainerId)

      let quizData
      
      if (isEditing && quiz.id) {
        // Update existing quiz
        console.log('📝 Updating existing quiz with ID:', quiz.id)
        
        const quizToUpdate = {
          title: quiz.title,
          description: quiz.description || '',
          time_limit: quiz.timeLimit,
          updated_at: new Date().toISOString()
        }
        
        const { data: updatedQuiz, error: quizError } = await supabase
          .from('quizzes')
          .update(quizToUpdate)
          .eq('id', quiz.id)
          .select()
          .single()

        if (quizError) {
          console.error('❌ QUIZ UPDATE FAILED:', quizError)
          throw quizError
        }
        
        quizData = updatedQuiz
        console.log('✅ Quiz updated successfully:', quizData)

        // Delete existing questions
        console.log('🗑️ Deleting existing questions...')
        const { error: deleteError } = await supabase
          .from('questions')
          .delete()
          .eq('quiz_id', quiz.id)

        if (deleteError) {
          console.error('❌ QUESTIONS DELETE FAILED:', deleteError)
          throw deleteError
        }
        
      } else {
        // Create new quiz
        console.log('➕ Creating new quiz...')
        
        const quizToInsert = {
          trainer_id: trainerId,
          title: quiz.title,
          description: quiz.description || '',
          time_limit: quiz.timeLimit
        }
        
        const { data: newQuiz, error: quizError } = await supabase
          .from('quizzes')
          .insert(quizToInsert)
          .select()
          .single()

        if (quizError) {
          console.error('❌ QUIZ INSERT FAILED:', quizError)
          throw quizError
        }
        
        quizData = newQuiz
        console.log('✅ Quiz inserted successfully:', quizData)
      }

      // Insert/re-insert questions
      const questionsToInsert = quiz.questions.map((question, index) => {
        const questionData = {
          quiz_id: quizData.id,
          question_text: question.questionText,
          question_type: question.questionType,
          options: JSON.stringify(question.options),
          correct_answer: question.correctAnswer,
          points: question.points,
          order_index: index + 1
        }
        console.log(`📋 Question ${index + 1} data:`, questionData)
        return questionData
      })

      console.log('💾 Inserting', questionsToInsert.length, 'questions...')
      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsToInsert)

      if (questionsError) {
        console.error('❌ QUESTIONS INSERT FAILED:', questionsError)
        throw questionsError
      }

      console.log('🎉 ALL DATA SAVED SUCCESSFULLY!')
      alert(isEditing ? 'Quiz updated successfully!' : 'Quiz saved successfully!')
      navigate('/admin')
      
    } catch (error) {
      console.error('💥 SAVE QUIZ ERROR:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
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
        <div className="bg-white/95 rounded-lg shadow border border-gb-gold/20 p-6 mb-6">
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

        <div className="bg-white/95 rounded-lg shadow border border-gb-gold/20 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gb-navy font-serif">Questions</h2>
              <p className="text-gb-navy/70 text-sm mt-1">Create engaging questions for your training quiz</p>
            </div>
            <button 
              onClick={addQuestion}
              className="bg-gb-gold text-gb-navy px-4 py-2 rounded-lg hover:bg-gb-gold-light flex items-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>

          {quiz.questions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gb-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gb-gold/60" />
              </div>
              <p className="text-gb-navy/60 text-lg mb-4">No questions added yet</p>
              <p className="text-gb-navy/50 text-sm">Click "Add Question" above to create your first question</p>
            </div>
          ) : (
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
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
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
                        <div key={optionIndex} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          question.correctAnswer === option 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gb-gold/30 hover:border-gb-gold/50'
                        }`}>
                          <input 
                            type="radio" 
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === option}
                            onChange={() => updateQuestion(question.id, 'correctAnswer', option)}
                            className="text-green-600 focus:ring-green-500"
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
                        <p className="text-amber-600 text-sm flex items-center gap-2 mt-2">
                          <span className="w-4 h-4 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xs font-bold">!</span>
                          Please select the correct answer
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default QuizBuilder
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

function QuizBuilder() {
  const navigate = useNavigate()
  const { quizId } = useParams()
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
      const trainerId = '00000000-0000-0000-0000-000000000001'
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
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img 
              src="/gblogo.png" 
              alt="GB Logo" 
              className="h-10"
            />
            <h1 className="text-3xl font-bold text-gb-gold font-serif">
              {isEditing ? 'Edit Quiz' : 'Quiz Builder'}
            </h1>
          </div>
          <div className="space-x-4">
            <button 
              onClick={() => navigate('/admin')}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={saveQuiz}
              disabled={saving}
              className="px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light flex items-center gap-2 disabled:opacity-50 font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Quiz' : 'Save Quiz')}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quiz Details</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title</label>
              <input 
                type="text" 
                value={quiz.title}
                onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter quiz title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Limit (minutes)</label>
              <input 
                type="number" 
                value={quiz.timeLimit / 60}
                onChange={(e) => setQuiz(prev => ({ ...prev, timeLimit: e.target.value * 60 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea 
              value={quiz.description}
              onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Quiz description..."
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Questions</h2>
            <button 
              onClick={addQuestion}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>

          {quiz.questions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No questions added yet. Click "Add Question" to get started.</p>
          ) : (
            <div className="space-y-6">
              {quiz.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold">Question {index + 1}</h3>
                    <button 
                      onClick={() => removeQuestion(question.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      value={question.questionText}
                      onChange={(e) => updateQuestion(question.id, 'questionText', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your question..."
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input 
                            type="radio" 
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === option}
                            onChange={() => updateQuestion(question.id, 'correctAnswer', option)}
                            className="text-green-600"
                          />
                          <input 
                            type="text" 
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...question.options]
                              newOptions[optionIndex] = e.target.value
                              updateQuestion(question.id, 'options', newOptions)
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Option ${optionIndex + 1}...`}
                          />
                        </div>
                      ))}
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
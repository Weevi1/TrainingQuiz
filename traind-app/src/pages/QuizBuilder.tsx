import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save, ArrowLeft, Edit, Move } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type Question, type Quiz } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const QuizBuilder: React.FC = () => {
  const navigate = useNavigate()
  const { quizId } = useParams<{ quizId: string }>()
  const { user, currentOrganization, hasPermission } = useAuth()

  const [quiz, setQuiz] = useState<Quiz>({
    title: '',
    description: '',
    timeLimit: 30, // seconds per question
    questions: [],
    organizationId: currentOrganization?.id || '',
    trainerId: user?.id || '',
    settings: {
      allowHints: true,
      confidenceScoring: false,
      teamMode: false,
      showExplanations: true,
      shuffleQuestions: false,
      passingScore: 70
    }
  })

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Check permissions
  useEffect(() => {
    if (!hasPermission('create_sessions') && !hasPermission('manage_content')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate])

  useEffect(() => {
    if (quizId) {
      setIsEditing(true)
      loadQuiz()
    }
  }, [quizId])

  const loadQuiz = async () => {
    if (!currentOrganization || !quizId) return

    setLoading(true)
    try {
      // Load quiz from organization-scoped collection
      const quizData = await FirestoreService.getQuiz(currentOrganization.id, quizId)
      if (!quizData) {
        alert('Quiz not found')
        navigate('/dashboard')
        return
      }

      setQuiz(quizData)
    } catch (error) {
      console.error('Error loading quiz:', error)
      alert('Error loading quiz')
    } finally {
      setLoading(false)
    }
  }

  const saveQuiz = async () => {
    if (!currentOrganization || !user) {
      alert('Please select an organization first')
      return
    }

    if (!quiz.title.trim()) {
      alert('Please enter a quiz title')
      return
    }

    if (quiz.questions.length === 0) {
      alert('Please add at least one question')
      return
    }

    setSaving(true)
    try {
      const quizData = {
        ...quiz,
        organizationId: currentOrganization.id,
        trainerId: user.id
      }

      if (isEditing && quizId) {
        await FirestoreService.updateQuiz(currentOrganization.id, quizId, quizData)
      } else {
        await FirestoreService.createQuiz(currentOrganization.id, quizData)
      }

      navigate('/quizzes')
    } catch (error) {
      console.error('Error saving quiz:', error)
      alert('Error saving quiz')
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      questionText: '',
      questionType: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      difficulty: 'medium'
    }

    setQuiz(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }))
  }

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    setQuiz(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === questionId ? { ...q, ...updates } : q
      )
    }))
  }

  const deleteQuestion = (questionId: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      setQuiz(prev => ({
        ...prev,
        questions: prev.questions.filter(q => q.id !== questionId)
      }))
    }
  }

  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    setQuiz(prev => {
      const questions = [...prev.questions]
      const index = questions.findIndex(q => q.id === questionId)

      if (direction === 'up' && index > 0) {
        [questions[index], questions[index - 1]] = [questions[index - 1], questions[index]]
      } else if (direction === 'down' && index < questions.length - 1) {
        [questions[index], questions[index + 1]] = [questions[index + 1], questions[index]]
      }

      return { ...prev, questions }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-primary">
                {isEditing ? 'Edit Quiz' : 'Create Quiz'}
              </h1>
            </div>
            <button
              onClick={saveQuiz}
              disabled={saving}
              className="btn-primary flex items-center space-x-2"
            >
              {saving ? <LoadingSpinner size="sm" /> : <Save size={16} />}
              <span>{saving ? 'Saving...' : 'Save Quiz'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quiz Settings */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-6">Quiz Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Quiz Title *
              </label>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="Enter quiz title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Time per Question (seconds)
              </label>
              <input
                type="number"
                value={quiz.timeLimit}
                onChange={(e) => setQuiz(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 30 }))}
                className="input"
                min="10"
                max="300"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={quiz.description}
                onChange={(e) => setQuiz(prev => ({ ...prev, description: e.target.value }))}
                className="input h-20 resize-none"
                placeholder="Quiz description (optional)"
              />
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="font-medium mb-4">Advanced Settings</h3>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={quiz.settings.showExplanations}
                onChange={(e) => setQuiz(prev => ({
                  ...prev,
                  settings: { ...prev.settings, showExplanations: e.target.checked }
                }))}
                className="rounded"
              />
              <span>Show explanations after each question</span>
            </label>
          </div>
        </div>

        {/* Questions */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">
              Questions ({quiz.questions.length})
            </h2>
            <button
              onClick={addQuestion}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>Add Question</span>
            </button>
          </div>

          {quiz.questions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">No questions added yet</p>
              <button
                onClick={addQuestion}
                className="btn-primary"
              >
                Add Your First Question
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {quiz.questions.map((question, index) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  index={index}
                  totalQuestions={quiz.questions.length}
                  onUpdate={(updates) => updateQuestion(question.id, updates)}
                  onDelete={() => deleteQuestion(question.id)}
                  onMove={(direction) => moveQuestion(question.id, direction)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Question Editor Component
interface QuestionEditorProps {
  question: Question
  index: number
  totalQuestions: number
  onUpdate: (updates: Partial<Question>) => void
  onDelete: () => void
  onMove: (direction: 'up' | 'down') => void
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  totalQuestions,
  onUpdate,
  onDelete,
  onMove
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 font-medium"
        >
          <span>Question {index + 1}</span>
          <Edit size={16} />
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-1 text-text-secondary hover:text-primary disabled:opacity-50"
          >
            <Move size={16} className="rotate-180" />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === totalQuestions - 1}
            className="p-1 text-text-secondary hover:text-primary disabled:opacity-50"
          >
            <Move size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:opacity-80"
            style={{ color: 'var(--error-color, #dc2626)' }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Question Text *
            </label>
            <textarea
              value={question.questionText}
              onChange={(e) => onUpdate({ questionText: e.target.value })}
              className="input h-20 resize-none"
              placeholder="Enter your question..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Question Type
              </label>
              <select
                value={question.questionType}
                onChange={(e) => onUpdate({
                  questionType: e.target.value as 'multiple_choice' | 'true_false',
                  options: e.target.value === 'true_false' ? ['True', 'False'] : ['', '', '', '']
                })}
                className="input"
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True/False</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Difficulty
              </label>
              <select
                value={question.difficulty}
                onChange={(e) => onUpdate({ difficulty: e.target.value as Question['difficulty'] })}
                className="input"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Answer Options */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Answer Options
            </label>
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name={`correct-${question.id}`}
                    checked={question.correctAnswer === optionIndex}
                    onChange={() => onUpdate({ correctAnswer: optionIndex })}
                    className="text-primary"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...question.options]
                      newOptions[optionIndex] = e.target.value
                      onUpdate({ options: newOptions })
                    }}
                    className="input flex-1"
                    placeholder={`Option ${optionIndex + 1}`}
                    disabled={question.questionType === 'true_false'}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Explanation (Optional)
            </label>
            <textarea
              value={question.explanation || ''}
              onChange={(e) => onUpdate({ explanation: e.target.value })}
              className="input h-16 resize-none"
              placeholder="Explain why this is the correct answer..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
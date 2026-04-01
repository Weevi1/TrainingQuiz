import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Save, ArrowLeft, Edit, Move, Globe, Lock, Sparkles, Music, X, Zap, ChevronDown, ChevronUp, Layers, ToggleLeft, ToggleRight, Upload, Loader2, Volume2, Crown, Target, Trophy } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OrgLogo } from '../components/OrgLogo'
import { FirestoreService, type Question, type Quiz, type InterstitialConfig, type MediaItem, type CustomFeedbackConfig, type MilestoneConfig, type MilestoneType, isPublished } from '../lib/firestore'
import { StorageService } from '../lib/storageService'
import { needsConversion, isVideoFile, convertToMp4 } from '../lib/mediaConverter'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { INTERSTITIAL_SOUND_OPTIONS, calculateTemplatePositions } from '../lib/interstitialPresets'
import { BUILT_IN_ANIMATIONS, getBuiltInAnimation } from '../lib/builtInAnimations'

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
    published: false, // New quizzes start as draft
    settings: {
      allowHints: true,
      confidenceScoring: false,
      teamMode: false,
      showExplanations: true,
      shuffleQuestions: false,
      passingScore: 70,
      cpdEnabled: false,
      cpdPoints: 1,
      cpdRequiresPass: false,
      cpdVerifiable: false
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

    // Validate all questions have text and non-empty options
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i]
      if (!q.questionText.trim()) {
        alert(`Question ${i + 1} has no text. Please fill in all questions.`)
        return
      }
      if (q.questionType !== 'true_false') {
        const emptyOption = q.options.findIndex(opt => !opt.trim())
        if (emptyOption !== -1) {
          alert(`Question ${i + 1}, Option ${emptyOption + 1} is empty. Please fill in all answer options.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const quizData = {
        ...quiz,
        organizationId: currentOrganization.id,
        // Preserve original trainerId when editing someone else's quiz
        trainerId: isEditing ? quiz.trainerId : user.id
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
      setQuiz(prev => {
        const deletedIndex = prev.questions.findIndex(q => q.id === questionId)
        const newQuestions = prev.questions.filter(q => q.id !== questionId)
        // Clean up interstitials: shift indices and remove orphaned
        const newInterstitials = (prev.interstitials || [])
          .filter(i => i.beforeQuestionIndex !== deletedIndex || deletedIndex >= newQuestions.length)
          .filter(i => {
            const adjusted = i.beforeQuestionIndex > deletedIndex
              ? i.beforeQuestionIndex - 1
              : i.beforeQuestionIndex
            return adjusted >= 0 && adjusted < newQuestions.length
          })
          .map(i => ({
            ...i,
            beforeQuestionIndex: i.beforeQuestionIndex > deletedIndex
              ? i.beforeQuestionIndex - 1
              : i.beforeQuestionIndex
          }))
        return { ...prev, questions: newQuestions, interstitials: newInterstitials }
      })
    }
  }

  // Remap interstitial indices when questions are swapped/moved
  const remapInterstitials = (interstitials: InterstitialConfig[] | undefined, fromIdx: number, toIdx: number) => {
    if (!interstitials?.length) return interstitials
    return interstitials.map(i => {
      let idx = i.beforeQuestionIndex
      if (idx === fromIdx) idx = toIdx
      else if (idx === toIdx) idx = fromIdx
      return { ...i, beforeQuestionIndex: idx }
    })
  }

  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    setQuiz(prev => {
      const questions = [...prev.questions]
      const index = questions.findIndex(q => q.id === questionId)

      if (direction === 'up' && index > 0) {
        [questions[index], questions[index - 1]] = [questions[index - 1], questions[index]]
        return { ...prev, questions, interstitials: remapInterstitials(prev.interstitials, index, index - 1) }
      } else if (direction === 'down' && index < questions.length - 1) {
        [questions[index], questions[index + 1]] = [questions[index + 1], questions[index]]
        return { ...prev, questions, interstitials: remapInterstitials(prev.interstitials, index, index + 1) }
      }

      return { ...prev, questions }
    })
  }

  const moveQuestionToPosition = (questionId: string, targetPosition: number) => {
    setQuiz(prev => {
      const questions = [...prev.questions]
      const currentIndex = questions.findIndex(q => q.id === questionId)
      if (currentIndex === -1) return prev
      const target = Math.max(0, Math.min(questions.length - 1, targetPosition - 1))
      if (target === currentIndex) return prev
      const [moved] = questions.splice(currentIndex, 1)
      questions.splice(target, 0, moved)
      // Rebuild interstitial indices: shift indices affected by the splice
      const newInterstitials = prev.interstitials?.map(i => {
        let idx = i.beforeQuestionIndex
        if (idx === currentIndex) {
          idx = target
        } else if (currentIndex < target) {
          // Moved forward: indices between (current, target] shift down by 1
          if (idx > currentIndex && idx <= target) idx--
        } else {
          // Moved backward: indices between [target, current) shift up by 1
          if (idx >= target && idx < currentIndex) idx++
        }
        return { ...i, beforeQuestionIndex: idx }
      })
      return { ...prev, questions, interstitials: newInterstitials }
    })
  }

  // ===== INTERSTITIAL HANDLERS =====

  // Available animations for this org
  const enabledBuiltInIds = currentOrganization?.branding?.interstitialAnimations || []
  const orgCustomAnimations: MediaItem[] = currentOrganization?.branding?.customAnimations || []
  const enabledBuiltIns = BUILT_IN_ANIMATIONS.filter(a => enabledBuiltInIds.includes(a.id))
  const hasAnimations = enabledBuiltIns.length > 0 || orgCustomAnimations.length > 0

  const addInterstitial = (beforeIndex: number, animationId: string, animationType: 'builtin' | 'custom') => {
    if (quiz.interstitials?.some(i => i.beforeQuestionIndex === beforeIndex)) return

    const builtIn = animationType === 'builtin' ? getBuiltInAnimation(animationId) : undefined
    const newInterstitial: InterstitialConfig = {
      id: `int_${Date.now()}`,
      beforeQuestionIndex: beforeIndex,
      animationId,
      animationType,
      text: '',
      sound: builtIn?.defaultSound || '',
      durationMs: builtIn?.defaultDurationMs || 3000
    }
    setQuiz(prev => ({
      ...prev,
      interstitials: [...(prev.interstitials || []), newInterstitial]
    }))
  }

  const updateInterstitial = (id: string, updates: Partial<InterstitialConfig>) => {
    setQuiz(prev => ({
      ...prev,
      interstitials: (prev.interstitials || []).map(i =>
        i.id === id ? { ...i, ...updates } : i
      )
    }))
  }

  const deleteInterstitial = (id: string) => {
    setQuiz(prev => ({
      ...prev,
      interstitials: (prev.interstitials || []).filter(i => i.id !== id)
    }))
  }

  const autoAddInterstitials = () => {
    if (quiz.questions.length < 3 || !hasAnimations) return
    const positions = calculateTemplatePositions(quiz.questions.length, enabledBuiltInIds)
    const existing = quiz.interstitials || []
    const newInterstitials = positions
      .filter(p => !existing.some(e => e.beforeQuestionIndex === p.beforeIndex))
      .map(p => {
        const builtIn = getBuiltInAnimation(p.template.animationId)
        return {
          id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          beforeQuestionIndex: p.beforeIndex,
          animationId: p.template.animationId,
          animationType: p.template.animationType as 'builtin' | 'custom',
          text: p.template.text,
          sound: builtIn?.defaultSound || '',
          durationMs: builtIn?.defaultDurationMs || 3000
        }
      })
    if (newInterstitials.length === 0) return
    setQuiz(prev => ({
      ...prev,
      interstitials: [...existing, ...newInterstitials]
    }))
  }

  const addSlide = (beforeIndex?: number) => {
    const idx = beforeIndex ?? quiz.questions.length
    // Don't add two interstitials at the same position
    if (quiz.interstitials?.some(i => i.beforeQuestionIndex === idx)) return
    const newSlide: InterstitialConfig = {
      id: `slide_${Date.now()}`,
      beforeQuestionIndex: idx,
      mode: 'slide',
      slideTitle: '',
      slideBody: '',
      slideAutoAdvance: false,
    }
    setQuiz(prev => ({
      ...prev,
      interstitials: [...(prev.interstitials || []), newSlide]
    }))
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
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <OrgLogo
                logo={currentOrganization?.branding?.logo}
                orgName={currentOrganization?.name}
                size="md"
              />
              <h1 className="text-xl font-bold text-primary">
                {isEditing ? 'Edit Quiz' : 'Create Quiz'}
              </h1>
            </div>
            <button
              onClick={saveQuiz}
              disabled={saving || quiz.questions.length === 0}
              className="btn-primary flex items-center space-x-2 disabled:opacity-50"
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

          {/* Visibility */}
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="font-medium mb-4">Visibility</h3>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished(quiz)}
                onChange={(e) => setQuiz(prev => ({ ...prev, published: e.target.checked }))}
                className="rounded"
              />
              <span className="flex items-center gap-1.5">
                {isPublished(quiz) ? <Globe size={14} /> : <Lock size={14} />}
                {isPublished(quiz)
                  ? 'Published — visible to all trainers in your organisation'
                  : 'Draft — only you can see this quiz'}
              </span>
            </label>
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

            {/* CPD Settings */}
            <div className="mt-4 pt-4 border-t border-border">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quiz.settings.cpdEnabled || false}
                  onChange={(e) => setQuiz(prev => ({
                    ...prev,
                    settings: { ...prev.settings, cpdEnabled: e.target.checked }
                  }))}
                  className="rounded"
                />
                <span className="font-medium">CPD Scoring</span>
              </label>
              <p className="text-sm text-text-secondary mt-1 ml-6">
                Award Continuing Professional Development points to participants
              </p>

              {quiz.settings.cpdEnabled && (
                <div className="ml-6 mt-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">CPD Points</label>
                    <input
                      type="number"
                      value={quiz.settings.cpdPoints || 1}
                      onChange={(e) => setQuiz(prev => ({
                        ...prev,
                        settings: { ...prev.settings, cpdPoints: Math.max(1, parseInt(e.target.value) || 1) }
                      }))}
                      className="input w-24"
                      min="1"
                      max="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">CPD Requirement</label>
                    <select
                      value={quiz.settings.cpdRequiresPass ? 'pass' : 'attendance'}
                      onChange={(e) => setQuiz(prev => ({
                        ...prev,
                        settings: { ...prev.settings, cpdRequiresPass: e.target.value === 'pass' }
                      }))}
                      className="input"
                    >
                      <option value="attendance">Attendance Only (everyone earns CPD)</option>
                      <option value="pass">Must Pass ({quiz.settings.passingScore}% required)</option>
                    </select>
                    <p className="text-sm text-text-secondary mt-1">
                      {quiz.settings.cpdRequiresPass
                        ? `Participants must score ${quiz.settings.passingScore}% or higher to earn CPD points`
                        : 'All participants who complete the session earn CPD points'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">CPD Verification</label>
                    <select
                      value={quiz.settings.cpdVerifiable ? 'verifiable' : 'non-verifiable'}
                      onChange={(e) => setQuiz(prev => ({
                        ...prev,
                        settings: { ...prev.settings, cpdVerifiable: e.target.value === 'verifiable' }
                      }))}
                      className="input"
                    >
                      <option value="non-verifiable">Non-Verifiable</option>
                      <option value="verifiable">Verifiable</option>
                    </select>
                    <p className="text-sm text-text-secondary mt-1">
                      {quiz.settings.cpdVerifiable
                        ? 'CPD points are independently verifiable by a professional body'
                        : 'CPD points are self-declared and not independently verified'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Answer Feedback */}
        <CustomFeedbackEditor
          quizId={quizId || 'new'}
          orgId={currentOrganization?.id || ''}
          config={quiz.customFeedback}
          onChange={(customFeedback) => setQuiz(prev => ({ ...prev, customFeedback }))}
        />

        {/* Milestone Triggers */}
        <MilestoneEditor
          quizId={quizId || 'new'}
          orgId={currentOrganization?.id || ''}
          milestones={quiz.milestones}
          onChange={(milestones) => setQuiz(prev => ({ ...prev, milestones }))}
        />

        {/* Questions */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">
                Questions ({quiz.questions.length})
              </h2>
              {quiz.questions.length >= 3 && hasAnimations && (
                <button
                  onClick={autoAddInterstitials}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:text-primary hover:border-primary transition-colors flex items-center gap-1.5"
                  title="Auto-add animation breaks at milestone positions"
                >
                  <Sparkles size={12} />
                  Auto-add breaks
                </button>
              )}
            </div>
            <button
              onClick={() => addSlide()}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-primary hover:border-primary transition-colors text-sm"
            >
              <Layers size={16} />
              <span>Add Slide</span>
            </button>
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
            <div className="space-y-4">
              {quiz.questions.map((question, index) => (
                <React.Fragment key={question.id}>
                  {/* Interstitial slot before this question */}
                  <InterstitialSlot
                    interstitial={(quiz.interstitials || []).find(i => i.beforeQuestionIndex === index)}
                    onAdd={(animId, animType) => addInterstitial(index, animId, animType)}
                    onAddSlide={() => addSlide(index)}
                    onUpdate={(id, updates) => updateInterstitial(id, updates)}
                    onDelete={(id) => deleteInterstitial(id)}
                    label={index === 0 ? 'Before first question' : `Between Q${index} and Q${index + 1}`}
                    enabledBuiltIns={enabledBuiltIns}
                    customAnimations={orgCustomAnimations}
                  />

                  <QuestionEditor
                    question={question}
                    index={index}
                    totalQuestions={quiz.questions.length}
                    onUpdate={(updates) => updateQuestion(question.id, updates)}
                    onDelete={() => deleteQuestion(question.id)}
                    onMove={(direction) => moveQuestion(question.id, direction)}
                    onMoveToPosition={(pos) => moveQuestionToPosition(question.id, pos)}
                    canDelete={quiz.questions.length > 1}
                  />
                </React.Fragment>
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
  onMoveToPosition: (position: number) => void
  canDelete: boolean
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  totalQuestions,
  onUpdate,
  onDelete,
  onMove,
  onMoveToPosition,
  canDelete
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
          {question.isBoss && <Crown size={14} style={{ color: '#f59e0b' }} />}
          <Edit size={16} />
        </button>
        <div className="flex items-center space-x-2">
          {totalQuestions > 3 && (
            <input
              type="number"
              min={1}
              max={totalQuestions}
              className="input w-14 text-center text-sm py-1 px-1"
              placeholder={`${index + 1}`}
              title="Move to position #"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt((e.target as HTMLInputElement).value)
                  if (val >= 1 && val <= totalQuestions) {
                    onMoveToPosition(val)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value)
                if (val >= 1 && val <= totalQuestions) {
                  onMoveToPosition(val)
                  e.target.value = ''
                }
              }}
            />
          )}
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
            disabled={!canDelete}
            className="p-1 hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
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

          {/* Boss Question Toggle */}
          <div className="pt-3 border-t border-border">
            <button
              onClick={() => onUpdate({ isBoss: !question.isBoss })}
              className="flex items-center gap-2 text-sm"
            >
              {question.isBoss ? (
                <ToggleRight size={20} style={{ color: '#f59e0b' }} />
              ) : (
                <ToggleLeft size={20} className="text-text-secondary" />
              )}
              <Crown size={14} style={{ color: question.isBoss ? '#f59e0b' : undefined }} className={question.isBoss ? '' : 'text-text-secondary'} />
              <span className={question.isBoss ? 'font-medium' : 'text-text-secondary'}>Boss Question</span>
              {question.isBoss && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                  {question.bossPointMultiplier || 2}x points
                </span>
              )}
            </button>
            {question.isBoss && (
              <div className="mt-3 ml-7 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Point Multiplier</label>
                    <select
                      value={question.bossPointMultiplier || 2}
                      onChange={(e) => onUpdate({ bossPointMultiplier: parseInt(e.target.value) })}
                      className="input text-sm"
                    >
                      <option value={2}>2x points</option>
                      <option value={3}>3x points</option>
                      <option value={5}>5x points</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Intro Text</label>
                    <input
                      type="text"
                      value={question.bossIntroText || ''}
                      onChange={(e) => onUpdate({ bossIntroText: e.target.value })}
                      className="input text-sm"
                      placeholder="BONUS ROUND!"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Interstitial Slot Component — shows between question cards with animation gallery picker or slide editor
interface InterstitialSlotProps {
  interstitial?: InterstitialConfig
  onAdd: (animationId: string, animationType: 'builtin' | 'custom') => void
  onAddSlide: () => void
  onUpdate: (id: string, updates: Partial<InterstitialConfig>) => void
  onDelete: (id: string) => void
  label: string
  enabledBuiltIns: typeof BUILT_IN_ANIMATIONS
  customAnimations: MediaItem[]
}

const InterstitialSlot: React.FC<InterstitialSlotProps> = ({
  interstitial,
  onAdd,
  onAddSlide,
  onUpdate,
  onDelete,
  label,
  enabledBuiltIns,
  customAnimations
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showGallery, setShowGallery] = useState(false)

  const hasAnimations = enabledBuiltIns.length > 0 || customAnimations.length > 0

  if (!interstitial) {
    return (
      <div className="flex items-center justify-center py-1 relative gap-2">
        {hasAnimations && (
          <button
            onClick={() => setShowGallery(!showGallery)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-border text-text-secondary text-xs hover:text-primary hover:border-primary transition-colors"
            title={label}
          >
            <Sparkles size={12} />
            Animation
          </button>
        )}
        <button
          onClick={onAddSlide}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-border text-text-secondary text-xs hover:text-primary hover:border-primary transition-colors"
          title={`Add slide break ${label.toLowerCase()}`}
        >
          <Layers size={12} />
          Slide
        </button>

        {/* Gallery popover */}
        {showGallery && (
          <div
            className="absolute top-full mt-1 z-20 w-72 max-h-64 overflow-y-auto rounded-lg shadow-xl border"
            style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}
          >
            <div className="p-2 space-y-2">
              {enabledBuiltIns.length > 0 && (
                <div>
                  <p className="text-xs font-medium px-2 py-1 text-text-secondary">Built-in</p>
                  <div className="grid grid-cols-3 gap-1">
                    {enabledBuiltIns.map(anim => (
                      <button
                        key={anim.id}
                        onClick={() => { onAdd(anim.id, 'builtin'); setShowGallery(false) }}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-primary/10 transition-colors text-center"
                      >
                        <Sparkles size={20} className="text-primary" />
                        <span className="text-xs text-text-secondary leading-tight">{anim.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {customAnimations.length > 0 && (
                <div>
                  <p className="text-xs font-medium px-2 py-1 text-text-secondary">Custom</p>
                  <div className="grid grid-cols-3 gap-1">
                    {customAnimations.map(anim => (
                      <button
                        key={anim.id}
                        onClick={() => { onAdd(anim.id, 'custom'); setShowGallery(false) }}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-primary/10 transition-colors text-center"
                      >
                        {anim.thumbnailUrl ? (
                          <img src={anim.thumbnailUrl} alt={anim.label} className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <Zap size={20} className="text-primary" />
                        )}
                        <span className="text-xs text-text-secondary leading-tight truncate w-full">{anim.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const isSlide = interstitial.mode === 'slide'

  // --- Slide mode display ---
  if (isSlide) {
    return (
      <div className="border border-dashed rounded-lg overflow-hidden" style={{ borderColor: 'var(--primary-color, #3b82f6)' }}>
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer"
          style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Layers size={14} className="text-primary flex-shrink-0" />
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)', fontSize: '0.65rem' }}>
              Slide
            </span>
            <span className="text-sm text-text-secondary truncate">
              {interstitial.slideTitle || '(untitled slide)'}
            </span>
            {interstitial.slideAudio && <Volume2 size={12} className="text-text-secondary flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(interstitial.id) }}
              className="p-1 hover:opacity-80"
              style={{ color: 'var(--error-color, #dc2626)' }}
            >
              <X size={14} />
            </button>
            {isExpanded ? <ChevronUp size={14} className="text-text-secondary" /> : <ChevronDown size={14} className="text-text-secondary" />}
          </div>
        </div>

        {isExpanded && (
          <div className="px-3 py-3 space-y-3 border-t" style={{ borderColor: 'rgba(59, 130, 246, 0.15)' }}>
            <div>
              <label className="block text-xs font-medium mb-1">Title</label>
              <input
                type="text"
                value={interstitial.slideTitle || ''}
                onChange={(e) => onUpdate(interstitial.id, { slideTitle: e.target.value })}
                className="input text-sm"
                placeholder="e.g. Section 2: Property Law"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Body Text</label>
              <textarea
                value={interstitial.slideBody || ''}
                onChange={(e) => onUpdate(interstitial.id, { slideBody: e.target.value })}
                className="input text-sm h-16 resize-none"
                placeholder="Optional description or instructions..."
              />
            </div>
            <SlideMediaUpload
              slideId={interstitial.id}
              currentUrl={interstitial.slideImage}
              onUploaded={(url, durationSec) => onUpdate(interstitial.id, {
                slideImage: url,
                ...(durationSec ? { slideDurationSec: durationSec } : {})
              })}
              onRemove={() => onUpdate(interstitial.id, { slideImage: undefined, slideDurationSec: undefined })}
            />
            {/* Show video duration when detected */}
            {interstitial.slideDurationSec && interstitial.slideDurationSec > 0 && (
              <p className="text-xs text-text-secondary">
                Animation duration: {interstitial.slideDurationSec}s
              </p>
            )}
            {/* Audio layer — available when slide has media */}
            {interstitial.slideImage && (
              <SlideAudioUpload
                slideId={interstitial.id}
                currentUrl={interstitial.slideAudio}
                onUploaded={(url) => onUpdate(interstitial.id, { slideAudio: url })}
                onRemove={() => onUpdate(interstitial.id, { slideAudio: undefined })}
              />
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => onUpdate(interstitial.id, { slideAutoAdvance: !interstitial.slideAutoAdvance })}
                className="flex items-center gap-2 text-sm"
              >
                {interstitial.slideAutoAdvance ? (
                  <ToggleRight size={20} className="text-primary" />
                ) : (
                  <ToggleLeft size={20} className="text-text-secondary" />
                )}
                <span>Auto-advance</span>
              </button>
              {interstitial.slideAutoAdvance && (
                <select
                  value={interstitial.slideAutoAdvanceMs || 5000}
                  onChange={(e) => onUpdate(interstitial.id, { slideAutoAdvanceMs: parseInt(e.target.value) })}
                  className="input text-sm w-24"
                >
                  <option value={3000}>3s</option>
                  <option value={5000}>5s</option>
                  <option value={7000}>7s</option>
                  <option value={10000}>10s</option>
                </select>
              )}
              {!interstitial.slideAutoAdvance && (
                <span className="text-xs text-text-secondary">Tap to continue</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- Animation mode display ---
  const animLabel = interstitial.animationType === 'builtin'
    ? getBuiltInAnimation(interstitial.animationId!)?.label || interstitial.animationId
    : customAnimations.find(a => a.id === interstitial.animationId)?.label || 'Custom'
  const customThumb = interstitial.animationType === 'custom'
    ? customAnimations.find(a => a.id === interstitial.animationId)?.thumbnailUrl
    : undefined

  return (
    <div className="border border-dashed rounded-lg overflow-hidden" style={{ borderColor: 'var(--accent-color, #f59e0b)' }}>
      {/* Compact header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {customThumb ? (
            <img src={customThumb} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
          ) : (
            <Sparkles size={14} className="text-primary flex-shrink-0" />
          )}
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)', fontSize: '0.65rem' }}>
            {animLabel}
          </span>
          <span className="text-sm text-text-secondary truncate">
            {interstitial.text || '(no message)'}
          </span>
          {interstitial.sound && <Music size={12} className="text-text-secondary flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(interstitial.id) }}
            className="p-1 hover:opacity-80"
            style={{ color: 'var(--error-color, #dc2626)' }}
          >
            <X size={14} />
          </button>
          {isExpanded ? <ChevronUp size={14} className="text-text-secondary" /> : <ChevronDown size={14} className="text-text-secondary" />}
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-3 py-3 space-y-3 border-t" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
          {/* Text overlay */}
          <div>
            <label className="block text-xs font-medium mb-1">Text Overlay</label>
            <input
              type="text"
              value={interstitial.text || ''}
              onChange={(e) => onUpdate(interstitial.id, { text: e.target.value })}
              className="input text-sm"
              placeholder="e.g. You're doing great!"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Sound (only for Lottie or silent MP4) */}
            <div>
              <label className="block text-xs font-medium mb-1">Sound</label>
              <select
                value={interstitial.sound || ''}
                onChange={(e) => onUpdate(interstitial.id, { sound: e.target.value || undefined })}
                className="input text-sm"
              >
                {INTERSTITIAL_SOUND_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium mb-1">Duration</label>
              <select
                value={interstitial.durationMs || 3000}
                onChange={(e) => onUpdate(interstitial.id, { durationMs: parseInt(e.target.value) })}
                className="input text-sm"
              >
                <option value={2000}>2s</option>
                <option value={2500}>2.5s</option>
                <option value={3000}>3s</option>
                <option value={3500}>3.5s</option>
                <option value={4000}>4s</option>
                <option value={5000}>5s</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Slide media upload (image or video) ---

const isVideoUrl = (url: string): boolean => /\.(mp4|webm|mov)(\?|$)/i.test(url)

const SlideMediaUpload: React.FC<{
  slideId: string
  currentUrl?: string
  onUploaded: (url: string, durationSec?: number) => void
  onRemove: () => void
}> = ({ slideId, currentUrl, onUploaded, onRemove }) => {
  const { currentOrganization } = useAuth()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [statusMsg, setStatusMsg] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  /** Get duration of a video file in seconds */
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve(Math.round(video.duration))
        URL.revokeObjectURL(video.src)
      }
      video.onerror = () => {
        resolve(0)
        URL.revokeObjectURL(video.src)
      }
      video.src = URL.createObjectURL(file)
    })
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentOrganization) return
    setError(null)
    setUploading(true)

    try {
      let uploadFile = file

      // Convert GIF → MP4 via FFmpeg for smaller file + hardware decode
      if (needsConversion(file)) {
        setStatusMsg('Loading conversion engine...')
        const result = await convertToMp4(file, {
          maxWidth: 720, maxHeight: 720, maxDurationSec: 10, crf: 28, keepAudio: true,
          onMessage: setStatusMsg
        })
        uploadFile = result.mp4
      } else if (!isVideoFile(file) && !file.type.startsWith('image/')) {
        throw new Error('Use an image (PNG, JPG, WebP) or video (MP4, GIF)')
      }

      // Detect video duration before uploading
      const isVideo = uploadFile.type.startsWith('video/') || uploadFile.name.endsWith('.mp4')
      let durationSec: number | undefined
      if (isVideo) {
        durationSec = await getVideoDuration(uploadFile)
      }

      setStatusMsg('Uploading...')
      const url = await StorageService.uploadSlideMedia(currentOrganization.id, slideId, uploadFile)
      onUploaded(url, durationSec || undefined)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      setStatusMsg('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1">Media (optional)</label>
      {currentUrl ? (
        <div className="relative inline-block">
          {isVideoUrl(currentUrl) ? (
            <video src={currentUrl} autoPlay muted loop playsInline className="max-h-28 rounded-lg object-contain" />
          ) : (
            <img src={currentUrl} alt="Slide" className="max-h-28 rounded-lg object-contain" />
          )}
          <button
            onClick={onRemove}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--error-color)', color: 'white' }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ backgroundColor: 'var(--surface-color)', border: '1px dashed var(--border-color)', color: 'var(--text-secondary-color)' }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? (statusMsg || 'Processing...') : 'Upload image or video'}
          </button>
        </>
      )}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--error-color)' }}>{error}</p>}
    </div>
  )
}

// --- Slide audio upload ---

const SlideAudioUpload: React.FC<{
  slideId: string
  currentUrl?: string
  onUploaded: (url: string) => void
  onRemove: () => void
}> = ({ slideId, currentUrl, onUploaded, onRemove }) => {
  const { currentOrganization } = useAuth()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentOrganization) return
    setError(null)
    setUploading(true)

    try {
      if (!file.type.startsWith('audio/')) {
        throw new Error('Use an audio file (MP3, WAV, M4A, OGG)')
      }
      const url = await StorageService.uploadSlideAudio(currentOrganization.id, slideId, file)
      onUploaded(url)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1">Audio Layer (optional)</label>
      {currentUrl ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
            <Volume2 size={14} className="text-primary flex-shrink-0" />
            <span className="text-text-secondary">Audio attached</span>
            <audio src={currentUrl} controls className="h-7" style={{ maxWidth: '140px' }} />
          </div>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:opacity-80"
            style={{ color: 'var(--error-color)' }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/m4a,audio/aac"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ backgroundColor: 'var(--surface-color)', border: '1px dashed var(--border-color)', color: 'var(--text-secondary-color)' }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
            {uploading ? 'Uploading...' : 'Add audio'}
          </button>
        </>
      )}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--error-color)' }}>{error}</p>}
    </div>
  )
}

// --- Generic media upload button (video or audio) ---

const QuizMediaUpload: React.FC<{
  label: string
  currentUrl?: string
  accept: string
  orgId: string
  quizId: string
  storageKey: string
  onUploaded: (url: string) => void
  onRemove: () => void
  isAudio?: boolean
}> = ({ label, currentUrl, accept, orgId, quizId, storageKey, onUploaded, onRemove, isAudio }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [statusMsg, setStatusMsg] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)

    try {
      let uploadFile = file

      // Convert GIF/video via FFmpeg if needed (not for audio)
      if (!isAudio && needsConversion(file)) {
        setStatusMsg('Converting...')
        const result = await convertToMp4(file, {
          maxWidth: 480, maxHeight: 480, maxDurationSec: 5, crf: 28, keepAudio: true,
          onMessage: setStatusMsg
        })
        uploadFile = result.mp4
      }

      setStatusMsg('Uploading...')
      const url = await StorageService.uploadQuizMedia(orgId, quizId, storageKey, uploadFile)
      onUploaded(url)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      setStatusMsg('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {currentUrl ? (
        <div className="flex items-center gap-2">
          {isAudio ? (
            <audio src={currentUrl} controls className="h-7" style={{ maxWidth: '160px' }} />
          ) : (
            <video src={currentUrl} autoPlay muted loop playsInline className="h-16 rounded-lg object-contain" />
          )}
          <button onClick={onRemove} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--error-color)' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <input ref={fileInputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ backgroundColor: 'var(--surface-color)', border: '1px dashed var(--border-color)', color: 'var(--text-secondary-color)' }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? (statusMsg || 'Processing...') : 'Upload'}
          </button>
        </>
      )}
      {error && <p className="text-xs mt-1" style={{ color: 'var(--error-color)' }}>{error}</p>}
    </div>
  )
}

// --- Custom Answer Feedback Editor ---

const CustomFeedbackEditor: React.FC<{
  quizId: string
  orgId: string
  config?: CustomFeedbackConfig
  onChange: (config: CustomFeedbackConfig | undefined) => void
}> = ({ quizId, orgId, config, onChange }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const hasAny = !!(config?.correctVideo || config?.correctAudio || config?.incorrectVideo || config?.incorrectAudio)

  const update = (field: keyof CustomFeedbackConfig, value: string | undefined) => {
    const next = { ...config, [field]: value }
    // If all fields cleared, remove the config entirely
    if (!next.correctVideo && !next.correctAudio && !next.incorrectVideo && !next.incorrectAudio) {
      onChange(undefined)
    } else {
      onChange(next)
    }
  }

  return (
    <div className="card mb-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Target size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Custom Answer Feedback</h2>
          {hasAny && <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-white">Active</span>}
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
      </button>
      {!isExpanded && (
        <p className="text-sm text-text-secondary mt-1">Replace the default correct/incorrect animations with custom videos and sounds</p>
      )}

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Upload custom animations and sounds to replace the default correct/incorrect feedback.
            Videos play during the 1.5s feedback window. Keep them short and punchy.
          </p>

          {/* Correct feedback */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: '#16a34a' }}>Correct Answer</h4>
            <div className="grid grid-cols-2 gap-3">
              <QuizMediaUpload
                label="Animation (video/GIF)"
                currentUrl={config?.correctVideo}
                accept="video/mp4,image/gif"
                orgId={orgId}
                quizId={quizId}
                storageKey="feedback_correct"
                onUploaded={(url) => update('correctVideo', url)}
                onRemove={() => update('correctVideo', undefined)}
              />
              <QuizMediaUpload
                label="Sound"
                currentUrl={config?.correctAudio}
                accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg"
                orgId={orgId}
                quizId={quizId}
                storageKey="feedback_correct_audio"
                onUploaded={(url) => update('correctAudio', url)}
                onRemove={() => update('correctAudio', undefined)}
                isAudio
              />
            </div>
          </div>

          {/* Incorrect feedback */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <h4 className="text-sm font-medium mb-2" style={{ color: '#dc2626' }}>Incorrect Answer</h4>
            <div className="grid grid-cols-2 gap-3">
              <QuizMediaUpload
                label="Animation (video/GIF)"
                currentUrl={config?.incorrectVideo}
                accept="video/mp4,image/gif"
                orgId={orgId}
                quizId={quizId}
                storageKey="feedback_incorrect"
                onUploaded={(url) => update('incorrectVideo', url)}
                onRemove={() => update('incorrectVideo', undefined)}
              />
              <QuizMediaUpload
                label="Sound"
                currentUrl={config?.incorrectAudio}
                accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg"
                orgId={orgId}
                quizId={quizId}
                storageKey="feedback_incorrect_audio"
                onUploaded={(url) => update('incorrectAudio', url)}
                onRemove={() => update('incorrectAudio', undefined)}
                isAudio
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Milestone Triggers Editor ---

const MILESTONE_DEFAULTS: Record<MilestoneType, { label: string; description: string; defaultText: string; icon: string }> = {
  streak3: { label: 'Hot Streak (3)', description: '3 correct in a row', defaultText: 'On Fire! 🔥', icon: '🔥' },
  streak5: { label: 'Hot Streak (5)', description: '5 correct in a row', defaultText: 'Unstoppable! ⚡', icon: '⚡' },
  streak10: { label: 'Hot Streak (10)', description: '10 correct in a row', defaultText: 'LEGENDARY! 🏆', icon: '🏆' },
  losing3: { label: 'Encouragement', description: '3 incorrect in a row', defaultText: 'Keep going, you got this! 💪', icon: '💪' },
  halfway: { label: 'Halfway', description: '50% of questions answered', defaultText: 'Halfway there! 🎯', icon: '🎯' },
  perfect_halfway: { label: 'Perfect Run', description: '100% correct at halfway+', defaultText: 'Perfect score so far! ⭐', icon: '⭐' },
  recovery: { label: 'Comeback', description: '3 correct after a miss streak', defaultText: 'Great recovery! 🚀', icon: '🚀' },
}

const ALL_MILESTONE_TYPES: MilestoneType[] = ['streak3', 'streak5', 'streak10', 'losing3', 'halfway', 'perfect_halfway', 'recovery']

const MilestoneEditor: React.FC<{
  quizId: string
  orgId: string
  milestones?: MilestoneConfig[]
  onChange: (milestones: MilestoneConfig[] | undefined) => void
}> = ({ quizId, orgId, milestones, onChange }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const enabledCount = milestones?.filter(m => m.enabled).length || 0

  const getMilestone = (type: MilestoneType): MilestoneConfig => {
    return milestones?.find(m => m.type === type) || { type, enabled: false }
  }

  const updateMilestone = (type: MilestoneType, updates: Partial<MilestoneConfig>) => {
    const existing = milestones || []
    const idx = existing.findIndex(m => m.type === type)
    let next: MilestoneConfig[]
    if (idx >= 0) {
      next = existing.map((m, i) => i === idx ? { ...m, ...updates } : m)
    } else {
      next = [...existing, { type, enabled: false, ...updates }]
    }
    // Remove disabled milestones with no custom media
    next = next.filter(m => m.enabled || m.video || m.audio || m.text)
    onChange(next.length > 0 ? next : undefined)
  }

  return (
    <div className="card mb-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-primary" />
          <h2 className="text-lg font-bold">Milestone Triggers</h2>
          {enabledCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-white">{enabledCount} active</span>}
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
      </button>
      {!isExpanded && (
        <p className="text-sm text-text-secondary mt-1">Auto-celebrate streaks, comebacks, and milestones during the quiz</p>
      )}

      {isExpanded && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-text-secondary mb-3">
            Celebrations and encouragement that trigger automatically based on participant performance.
            Each shows a brief overlay (2s) before the next question.
          </p>

          {ALL_MILESTONE_TYPES.map(type => {
            const meta = MILESTONE_DEFAULTS[type]
            const config = getMilestone(type)
            return (
              <MilestoneRow
                key={type}
                type={type}
                meta={meta}
                config={config}
                orgId={orgId}
                quizId={quizId}
                onUpdate={(updates) => updateMilestone(type, updates)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

const MilestoneRow: React.FC<{
  type: MilestoneType
  meta: { label: string; description: string; defaultText: string; icon: string }
  config: MilestoneConfig
  orgId: string
  quizId: string
  onUpdate: (updates: Partial<MilestoneConfig>) => void
}> = ({ type, meta, config, orgId, quizId, onUpdate }) => {
  const [showDetail, setShowDetail] = React.useState(false)
  const isEnabled = config.enabled

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: isEnabled ? 'var(--primary-color)' : 'var(--border-color)' }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">{meta.icon}</span>
          <div className="min-w-0">
            <span className="text-sm font-medium">{meta.label}</span>
            <span className="text-xs text-text-secondary ml-2">{meta.description}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEnabled && (
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="text-xs text-text-secondary hover:text-primary"
            >
              {showDetail ? 'Less' : 'Customize'}
            </button>
          )}
          <button onClick={() => onUpdate({ enabled: !isEnabled })}>
            {isEnabled ? (
              <ToggleRight size={22} className="text-primary" />
            ) : (
              <ToggleLeft size={22} className="text-text-secondary" />
            )}
          </button>
        </div>
      </div>

      {isEnabled && showDetail && (
        <div className="px-3 pb-3 pt-1 border-t space-y-2" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <label className="block text-xs font-medium mb-1">Message</label>
            <input
              type="text"
              value={config.text || ''}
              onChange={(e) => onUpdate({ text: e.target.value || undefined })}
              className="input text-sm"
              placeholder={meta.defaultText}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <QuizMediaUpload
              label="Animation"
              currentUrl={config.video}
              accept="video/mp4,image/gif"
              orgId={orgId}
              quizId={quizId}
              storageKey={`milestone_${type}`}
              onUploaded={(url) => onUpdate({ video: url })}
              onRemove={() => onUpdate({ video: undefined })}
            />
            <QuizMediaUpload
              label="Sound"
              currentUrl={config.audio}
              accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg"
              orgId={orgId}
              quizId={quizId}
              storageKey={`milestone_${type}_audio`}
              onUploaded={(url) => onUpdate({ audio: url })}
              onRemove={() => onUpdate({ audio: undefined })}
              isAudio
            />
          </div>
        </div>
      )}
    </div>
  )
}
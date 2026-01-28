import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Users, Clock, Settings, Play, QrCode, Target, Eye } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type GameSession, type Quiz } from '../lib/firestore'
import { PermissionService, AVAILABLE_MODULES, type ModuleType } from '../lib/permissions'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const SessionCreator: React.FC = () => {
  const navigate = useNavigate()
  const { gameType } = useParams<{ gameType?: ModuleType }>()
  const { user, currentOrganization, hasPermission, hasModuleAccess } = useAuth()

  // Helper to ensure complete settings
  const ensureCompleteSettings = (settings: Partial<GameSession['settings']> | undefined) => ({
    allowLateJoin: settings?.allowLateJoin ?? true,
    showLeaderboard: settings?.showLeaderboard ?? true,
    enableSounds: settings?.enableSounds ?? true,
    recordSession: settings?.recordSession ?? true
  })

  const [session, setSession] = useState<Partial<GameSession>>({
    title: '',
    gameType: gameType || 'quiz',
    participantLimit: 50,
    organizationId: currentOrganization?.id || '',
    trainerId: user?.id || '',
    code: '',
    status: 'waiting',
    currentParticipants: 0,
    gameData: {},
    settings: {
      allowLateJoin: true,
      showLeaderboard: true,
      enableSounds: true,
      recordSession: true
    }
  })

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check permissions
  useEffect(() => {
    if (!hasPermission('create_sessions')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate])

  // Check module access
  useEffect(() => {
    if (session.gameType && !hasModuleAccess(session.gameType)) {
      alert('You do not have access to this module. Please upgrade your subscription.')
      navigate('/dashboard')
      return
    }
  }, [session.gameType, hasModuleAccess, navigate])

  // Load quizzes if gameType is quiz
  useEffect(() => {
    if (session.gameType === 'quiz' && currentOrganization) {
      loadQuizzes()
    }
  }, [session.gameType, currentOrganization])

  // Generate session code
  useEffect(() => {
    if (!session.code) {
      setSession(prev => ({
        ...prev,
        code: FirestoreService.generateSessionCode()
      }))
    }
  }, [session.code])

  const loadQuizzes = async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      const quizList = await FirestoreService.getOrganizationQuizzes(currentOrganization.id)
      setQuizzes(quizList)
    } catch (error) {
      console.error('Error loading quizzes:', error)
      alert('Error loading quizzes')
    } finally {
      setLoading(false)
    }
  }

  const validateSession = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!session.title?.trim()) {
      errors.push('Session title is required')
    }

    if (!session.gameType) {
      errors.push('Game type is required')
    }

    // Quiz-based games require a quiz selection
    if (['quiz', 'millionaire', 'speedround'].includes(session.gameType || '') && !selectedQuizId) {
      errors.push('Please select a quiz for this session')
    }

    if (!session.participantLimit || session.participantLimit < 1) {
      errors.push('Participant limit must be at least 1')
    }

    // Game-specific validations
    if (session.gameType === 'bingo') {
      const cardSize = session.gameData?.cardSize || 5
      if (![3, 4, 5].includes(cardSize)) {
        errors.push('Invalid bingo card size')
      }
    }

    if (session.gameType === 'speedround') {
      const timeLimit = session.gameData?.timeLimit || 300
      const questionTimeLimit = session.gameData?.questionTimeLimit || 8

      if (timeLimit < 60 || timeLimit > 900) {
        errors.push('Game duration must be between 1 and 15 minutes')
      }

      if (questionTimeLimit < 5 || questionTimeLimit > 30) {
        errors.push('Question time limit must be between 5 and 30 seconds')
      }
    }

    // Check subscription limits
    if (currentOrganization && session.gameType) {
      const validation = PermissionService.validateSessionCreation(
        currentOrganization,
        session.gameType,
        0, // Current session count - would need to fetch this
        session.participantLimit || 0
      )

      errors.push(...validation.errors)
    }

    return { valid: errors.length === 0, errors }
  }

  const createSession = async () => {
    if (!currentOrganization || !user) {
      alert('Please select an organization first')
      return
    }

    const validation = validateSession()
    if (!validation.valid) {
      alert(`Please fix the following errors:\n${validation.errors.join('\n')}`)
      return
    }

    setSaving(true)
    try {
      // Prepare game-specific data
      let gameData = session.gameData || {}

      if (['quiz', 'millionaire', 'speedround'].includes(session.gameType || '') && selectedQuizId) {
        gameData = { ...gameData, quizId: selectedQuizId }
      }

      if (session.gameType === 'bingo') {
        gameData = {
          ...gameData,
          cardSize: session.gameData?.cardSize || 5,
          winCondition: session.gameData?.winCondition || 'line',
          timeLimit: 900 // 15 minutes default for bingo
        }
      }

      if (session.gameType === 'speedround') {
        gameData = {
          ...gameData,
          timeLimit: session.gameData?.timeLimit || 300,
          questionTimeLimit: session.gameData?.questionTimeLimit || 8,
          enableSkip: session.gameData?.enableSkip !== false
        }
      }

      if (session.gameType === 'millionaire') {
        gameData = {
          ...gameData,
          timeLimit: 45 // 45 seconds per question
        }
      }

      const sessionData: Partial<GameSession> = {
        ...session,
        organizationId: currentOrganization.id,
        trainerId: user.id,
        gameData
      }

      const sessionId = await FirestoreService.createSession(sessionData)
      navigate(`/session/${sessionId}`)
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Error creating session')
    } finally {
      setSaving(false)
    }
  }

  const availableModules = Object.entries(AVAILABLE_MODULES).filter(([module]) =>
    hasModuleAccess(module as ModuleType)
  )

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
                onClick={() => navigate('/sessions')}
                className="p-2 text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-primary">Create Training Session</h1>
            </div>
            <button
              onClick={createSession}
              disabled={saving}
              className="btn-primary flex items-center space-x-2"
            >
              {saving ? <LoadingSpinner size="sm" /> : <Save size={16} />}
              <span>{saving ? 'Creating...' : 'Create Session'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Basic Settings */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-6">Session Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Session Title *
              </label>
              <input
                type="text"
                value={session.title || ''}
                onChange={(e) => setSession(prev => ({ ...prev, title: e.target.value }))}
                className="input"
                placeholder="Enter session title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Game Type *
              </label>
              <select
                value={session.gameType || ''}
                onChange={(e) => setSession(prev => ({ ...prev, gameType: e.target.value as ModuleType }))}
                className="input"
                required
              >
                {availableModules.map(([moduleKey, moduleInfo]) => (
                  <option key={moduleKey} value={moduleKey}>
                    {moduleInfo.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Session Code
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={session.code || ''}
                  onChange={(e) => setSession(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="input font-mono"
                  placeholder="AUTO-GENERATED"
                  maxLength={6}
                />
                <button
                  onClick={() => setSession(prev => ({ ...prev, code: FirestoreService.generateSessionCode() }))}
                  className="btn-secondary btn-sm"
                >
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Users size={16} className="inline mr-1" />
                Participant Limit
              </label>
              <input
                type="number"
                value={session.participantLimit || ''}
                onChange={(e) => setSession(prev => ({ ...prev, participantLimit: parseInt(e.target.value) || 0 }))}
                className="input"
                min="1"
                max="1000"
              />
            </div>
          </div>
        </div>

        {/* Quiz Selection (for quiz-based game types) */}
        {['quiz', 'millionaire', 'speedround'].includes(session.gameType || '') && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-6">
              {session.gameType === 'quiz' ? 'Quiz Selection' :
               session.gameType === 'millionaire' ? 'Questions for Millionaire Game' :
               'Questions for Speed Round'}
            </h2>

            {quizzes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-text-secondary mb-4">No quizzes available</p>
                <button
                  onClick={() => navigate('/quiz/new')}
                  className="btn-primary"
                >
                  Create Your First Quiz
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Select Quiz {session.gameType !== 'bingo' ? '*' : '(Optional)'}
                </label>
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedQuizId === quiz.id
                        ? 'border-primary bg-primary-50'
                        : 'border-border hover:border-primary-300'
                    }`}
                    onClick={() => setSelectedQuizId(quiz.id!)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="quiz"
                        value={quiz.id}
                        checked={selectedQuizId === quiz.id}
                        onChange={() => setSelectedQuizId(quiz.id!)}
                        className="text-primary"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{quiz.title}</h4>
                        <p className="text-sm text-text-secondary">
                          {quiz.questions.length} questions • {quiz.timeLimit}s per question
                          {session.gameType === 'millionaire' && quiz.questions.length > 15 &&
                            ' (First 15 will be used)'}
                        </p>
                        {quiz.description && (
                          <p className="text-sm text-text-secondary mt-1">{quiz.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Game-Specific Configuration */}
        {session.gameType === 'millionaire' && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-6">Millionaire Game Settings</h2>
            <div
              className="rounded-lg p-4 border"
              style={{
                backgroundColor: 'var(--primary-light-color)',
                borderColor: 'var(--primary-color)'
              }}
            >
              <div className="flex items-start space-x-3">
                <div
                  className="rounded-full p-2"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  <Users size={16} style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
                </div>
                <div>
                  <h4 className="font-medium" style={{ color: 'var(--text-color)' }}>Game Show Experience</h4>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary-color)' }}>
                    Participants will experience the classic "Who Wants to be a Millionaire" format with:
                  </p>
                  <ul className="text-sm mt-2 space-y-1" style={{ color: 'var(--text-secondary-color)' }}>
                    <li>• Progressive money ladder with safe points</li>
                    <li>• Three lifelines: 50:50, Phone a Friend, Ask the Audience</li>
                    <li>• 45 seconds per question with increasing difficulty</li>
                    <li>• Option to walk away with current winnings</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {session.gameType === 'bingo' && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-6">Bingo Game Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Bingo Card Size
                </label>
                <select
                  className="input"
                  value={session.gameData?.cardSize || 5}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    gameData: { ...prev.gameData, cardSize: parseInt(e.target.value) }
                  }))}
                >
                  <option value={3}>3x3 (Quick Game)</option>
                  <option value={4}>4x4 (Medium Game)</option>
                  <option value={5}>5x5 (Classic Bingo)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Win Condition
                </label>
                <select
                  className="input"
                  value={session.gameData?.winCondition || 'line'}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    gameData: { ...prev.gameData, winCondition: e.target.value }
                  }))}
                >
                  <option value="line">Any Line (Row/Column/Diagonal)</option>
                  <option value="corners">Four Corners</option>
                  <option value="full_card">Full Card</option>
                  <option value="any_pattern">Any Pattern</option>
                </select>
              </div>
            </div>

            <div
              className="mt-6 rounded-lg p-4 border"
              style={{
                backgroundColor: 'var(--success-light-color)',
                borderColor: 'var(--success-color)'
              }}
            >
              <div className="flex items-start space-x-3">
                <div
                  className="rounded-full p-2"
                  style={{ backgroundColor: 'var(--success-color)' }}
                >
                  <Target size={16} style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
                </div>
                <div>
                  <h4 className="font-medium" style={{ color: 'var(--text-color)' }}>Training Bingo</h4>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary-color)' }}>
                    Participants mark off training activities and concepts as they complete them during the session.
                    Great for reinforcing learning objectives and keeping engagement high!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {session.gameType === 'speedround' && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-6">Speed Round Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Game Duration (minutes)
                </label>
                <select
                  className="input"
                  value={Math.floor((session.gameData?.timeLimit || 300) / 60)}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    gameData: { ...prev.gameData, timeLimit: parseInt(e.target.value) * 60 }
                  }))}
                >
                  <option value={3}>3 minutes</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Time per Question (seconds)
                </label>
                <select
                  className="input"
                  value={session.gameData?.questionTimeLimit || 8}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    gameData: { ...prev.gameData, questionTimeLimit: parseInt(e.target.value) }
                  }))}
                >
                  <option value={5}>5 seconds</option>
                  <option value={8}>8 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 mt-6">
                  <input
                    type="checkbox"
                    checked={session.gameData?.enableSkip !== false}
                    onChange={(e) => setSession(prev => ({
                      ...prev,
                      gameData: { ...prev.gameData, enableSkip: e.target.checked }
                    }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Allow question skipping</span>
                </label>
              </div>
            </div>

            <div
              className="mt-6 rounded-lg p-4 border"
              style={{
                backgroundColor: 'var(--warning-light-color)',
                borderColor: 'var(--warning-color)'
              }}
            >
              <div className="flex items-start space-x-3">
                <div
                  className="rounded-full p-2"
                  style={{ backgroundColor: 'var(--warning-color)' }}
                >
                  <Clock size={16} style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
                </div>
                <div>
                  <h4 className="font-medium" style={{ color: 'var(--text-color)' }}>Fast-Paced Learning</h4>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary-color)' }}>
                    Speed rounds test quick recall and decision-making. Participants earn bonus points for
                    fast answers and maintaining streaks. Perfect for reinforcing key concepts!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {session.gameType === 'spotdifference' && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-6">Document Detective Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Time Limit (minutes)
                </label>
                <select
                  className="input"
                  value={Math.floor((session.gameData?.timeLimit || 600) / 60)}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    gameData: { ...prev.gameData, timeLimit: parseInt(e.target.value) * 60 }
                  }))}
                >
                  <option value={5}>5 minutes</option>
                  <option value={8}>8 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Document Type Focus
                </label>
                <select
                  className="input"
                  value={session.gameData?.documentType || 'contract'}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    gameData: { ...prev.gameData, documentType: e.target.value }
                  }))}
                >
                  <option value="contract">Employment Contracts</option>
                  <option value="policy">Company Policies</option>
                  <option value="safety">Safety Procedures</option>
                  <option value="compliance">Compliance Documents</option>
                </select>
              </div>
            </div>

            <div
              className="mt-6 rounded-lg p-4 border"
              style={{
                backgroundColor: 'var(--error-light-color)',
                borderColor: 'var(--error-color)'
              }}
            >
              <div className="flex items-start space-x-3">
                <div
                  className="rounded-full p-2"
                  style={{ backgroundColor: 'var(--error-color)' }}
                >
                  <Eye size={16} style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
                </div>
                <div>
                  <h4 className="font-medium" style={{ color: 'var(--text-color)' }}>Compliance Training Excellence</h4>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary-color)' }}>
                    Participants will review contract clauses and legal documents to identify problematic changes.
                    Perfect for compliance officers, HR professionals, and legal teams!
                  </p>
                  <ul className="text-xs mt-2 space-y-1" style={{ color: 'var(--text-secondary-color)' }}>
                    <li>• Critical issues worth more points</li>
                    <li>• Real-world contract scenarios</li>
                    <li>• Detailed explanations for each difference</li>
                    <li>• Wrong guesses result in point penalties</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Session Settings */}
        <div className="card">
          <h2 className="text-xl font-bold mb-6">
            <Settings size={20} className="inline mr-2" />
            Session Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={session.settings?.allowLateJoin}
                onChange={(e) => setSession(prev => ({
                  ...prev,
                  settings: { ...ensureCompleteSettings(prev.settings), allowLateJoin: e.target.checked }
                }))}
                className="rounded"
              />
              <span>Allow participants to join after session starts</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={session.settings?.showLeaderboard}
                onChange={(e) => setSession(prev => ({
                  ...prev,
                  settings: { ...ensureCompleteSettings(prev.settings), showLeaderboard: e.target.checked }
                }))}
                className="rounded"
              />
              <span>Show live leaderboard</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={session.settings?.enableSounds}
                onChange={(e) => setSession(prev => ({
                  ...prev,
                  settings: { ...ensureCompleteSettings(prev.settings), enableSounds: e.target.checked }
                }))}
                className="rounded"
              />
              <span>Enable sound effects</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={session.settings?.recordSession}
                onChange={(e) => setSession(prev => ({
                  ...prev,
                  settings: { ...ensureCompleteSettings(prev.settings), recordSession: e.target.checked }
                }))}
                className="rounded"
              />
              <span>Record session for analytics</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
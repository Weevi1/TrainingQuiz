import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBranding } from '../contexts/BrandingContext'
import { LogOut, Play, Lock, ArrowRight, List, Settings, X } from 'lucide-react'
import { PlatformAdmin } from './PlatformAdmin'
import { AVAILABLE_MODULES, type ModuleType } from '../lib/permissions'
import { FirestoreService, type Quiz, type GameSession } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, currentOrganization, logout, availableOrganizations, switchOrganization, isPlatformAdmin, hasModuleAccess, createOrganization } = useAuth()
  const { brandingConfig } = useBranding()

  // Quick session modal state
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(false)
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)

  // Redirect Platform Admins to admin interface
  if (isPlatformAdmin()) {
    return <PlatformAdmin />
  }

  // Don't render anything if no organization - ProtectedRoute handles redirect
  if (!currentOrganization) {
    return null
  }

  // Check for pending organization creation (from self-service registration)
  useEffect(() => {
    const completePendingOrgCreation = async () => {
      const pendingData = localStorage.getItem('pendingOrgCreation')
      if (pendingData && user && !currentOrganization) {
        try {
          const { orgData, plan } = JSON.parse(pendingData)
          await createOrganization({
            name: orgData.name,
            domain: orgData.domain,
            branding: {
              primaryColor: orgData.primaryColor,
              secondaryColor: orgData.secondaryColor,
              theme: orgData.theme
            },
            subscription: {
              plan: plan,
              status: 'trial',
              modules: plan === 'basic'
                ? ['quiz', 'bingo']
                : plan === 'professional'
                ? ['quiz', 'bingo', 'millionaire', 'speedround']
                : ['quiz', 'bingo', 'millionaire', 'speedround', 'spotdifference'],
              limits: {
                maxParticipants: plan === 'basic' ? 50 : plan === 'professional' ? 200 : -1,
                maxSessions: -1,
                maxTrainers: plan === 'basic' ? 3 : plan === 'professional' ? 10 : -1
              }
            }
          })
          localStorage.removeItem('pendingOrgCreation')
        } catch (error) {
          console.error('Failed to create pending organization:', error)
          localStorage.removeItem('pendingOrgCreation')
        }
      }
    }
    completePendingOrgCreation()
  }, [user, currentOrganization, createOrganization])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Open quick session modal
  const openQuickSessionModal = async () => {
    setShowQuizModal(true)
    setLoadingQuizzes(true)
    setSelectedQuiz(null)

    try {
      const quizList = await FirestoreService.getOrganizationQuizzes(currentOrganization.id)
      setQuizzes(quizList)
    } catch (error) {
      console.error('Error loading quizzes:', error)
    } finally {
      setLoadingQuizzes(false)
    }
  }

  // Create session from selected quiz
  const startQuickSession = async () => {
    if (!selectedQuiz || !user) return

    setCreatingSession(true)

    try {
      const sessionCode = FirestoreService.generateSessionCode()

      const sessionData: Partial<GameSession> = {
        organizationId: currentOrganization.id,
        gameType: 'quiz',
        title: selectedQuiz.title,
        code: sessionCode,
        status: 'waiting',
        trainerId: user.id,
        participantLimit: 50,
        currentParticipants: 0,
        gameData: {
          quizId: selectedQuiz.id,
          quiz: selectedQuiz
        },
        settings: {
          allowLateJoin: true,
          showLeaderboard: true,
          enableSounds: true,
          recordSession: true
        }
      }

      const sessionId = await FirestoreService.createSession(sessionData)

      setShowQuizModal(false)
      setSelectedQuiz(null)
      window.open(
        `${window.location.origin}/session/${sessionId}`,
        '_blank',
        'width=1280,height=800,menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes'
      )

      // Navigate the trainer's window to SessionControl too (muted — projector popup handles sound)
      navigate(`/session/${sessionId}`, { state: { muteSound: true } })
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Error creating session. Please try again.')
    } finally {
      setCreatingSession(false)
    }
  }

  // Get available modules for quick access
  const availableModules = Object.entries(AVAILABLE_MODULES).filter(
    ([key]) => hasModuleAccess(key as ModuleType)
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background-color)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {brandingConfig?.logo && (
                <img src={brandingConfig.logo} alt="Logo" className="h-8 w-auto" />
              )}
              <h1 className="text-lg font-semibold" style={{ color: 'var(--primary-color)' }}>
                {currentOrganization?.name}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {availableOrganizations.length > 1 && (
                <select
                  value={currentOrganization?.id || ''}
                  onChange={(e) => switchOrganization(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-md"
                  style={{
                    backgroundColor: 'var(--background-color)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-color)'
                  }}
                >
                  {availableOrganizations.map((org) => (
                    <option key={org.orgId} value={org.orgId}>{org.orgName}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => navigate('/settings')}
                className="p-2 rounded-md transition-colors hover:bg-opacity-10"
                style={{ color: 'var(--text-secondary-color)' }}
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md transition-colors"
                style={{ color: 'var(--text-secondary-color)' }}
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero Section - Primary Action */}
        <div className="mb-12">
          <h2
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--text-color)', fontFamily: 'var(--font-family-heading)' }}
          >
            Welcome back, {user?.displayName?.split(' ')[0]}
          </h2>
          <p style={{ color: 'var(--text-secondary-color)' }}>
            What would you like to do today?
          </p>
        </div>

        {/* Primary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <button
            onClick={openQuickSessionModal}
            className="group p-8 rounded-xl text-left transition-all duration-200"
            style={{
              backgroundColor: 'var(--primary-color)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
              >
                <Play size={24} style={{ color: 'var(--text-on-primary-color)' }} />
              </div>
              <ArrowRight
                size={20}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-on-primary-color)' }}
              />
            </div>
            <h3
              className="text-xl font-semibold mb-1"
              style={{ color: 'var(--text-on-primary-color)' }}
            >
              Start a Session
            </h3>
            <p
              className="text-sm opacity-80"
              style={{ color: 'var(--text-on-primary-color)' }}
            >
              Launch a live training session with participants
            </p>
          </button>

          <button
            onClick={() => navigate('/sessions')}
            className="group p-8 rounded-xl text-left transition-all duration-200"
            style={{
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--surface-hover-color)' }}
              >
                <List size={24} style={{ color: 'var(--primary-color)' }} />
              </div>
              <ArrowRight
                size={20}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-color)' }}
              />
            </div>
            <h3
              className="text-xl font-semibold mb-1"
              style={{ color: 'var(--text-color)' }}
            >
              View Sessions
            </h3>
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary-color)' }}
            >
              Manage and review your training sessions
            </p>
          </button>
        </div>

        {/* Game Modules */}
        <div className="mb-12">
          <h3
            className="text-lg font-semibold mb-6"
            style={{ color: 'var(--text-color)' }}
          >
            Game Modules
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(AVAILABLE_MODULES).map(([moduleKey, moduleInfo]) => {
              const module = moduleKey as ModuleType
              const hasAccess = hasModuleAccess(module)

              return (
                <button
                  key={module}
                  onClick={() => {
                    if (hasAccess) {
                      if (module === 'quiz') {
                        navigate('/quizzes')
                      } else {
                        navigate(`/session/create/${module}`)
                      }
                    }
                  }}
                  disabled={!hasAccess}
                  className={`relative p-5 rounded-xl text-center transition-all duration-200 ${
                    hasAccess
                      ? 'cursor-pointer hover:scale-105'
                      : 'cursor-not-allowed opacity-50'
                  }`}
                  style={{
                    backgroundColor: 'var(--surface-color)',
                    border: hasAccess ? '1px solid var(--border-color)' : '1px solid transparent'
                  }}
                >
                  {!hasAccess && (
                    <div
                      className="absolute top-2 right-2"
                      style={{ color: 'var(--text-muted-color)' }}
                    >
                      <Lock size={12} />
                    </div>
                  )}
                  <div
                    className="text-2xl mb-2"
                    style={{ filter: hasAccess ? 'none' : 'grayscale(1)' }}
                  >
                    {module === 'quiz' && '📝'}
                    {module === 'bingo' && '🎯'}
                    {module === 'millionaire' && '💰'}
                    {module === 'speedround' && '⚡'}
                    {module === 'spotdifference' && '🔍'}
                  </div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: hasAccess ? 'var(--text-color)' : 'var(--text-muted-color)' }}
                  >
                    {moduleInfo.name}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Subscription Banner - Only if on basic plan */}
        {currentOrganization.subscription?.plan === 'basic' && (
          <div
            className="p-6 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--surface-color) 0%, var(--surface-hover-color) 100%)',
              border: '1px solid var(--border-color)'
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="font-medium mb-1"
                  style={{ color: 'var(--text-color)' }}
                >
                  Unlock more game modules
                </p>
                <p
                  className="text-sm"
                  style={{ color: 'var(--text-secondary-color)' }}
                >
                  Upgrade to Professional for Millionaire, Speed Round, and more
                </p>
              </div>
              <button
                onClick={() => navigate('/billing')}
                className="px-5 py-2.5 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--primary-color)',
                  color: 'var(--text-on-primary-color)'
                }}
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Quick Session Modal */}
      {showQuizModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            style={{
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)'
            }}
          >
            {/* Modal Header */}
            <div
              className="p-6 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--border-color)' }}
            >
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: 'var(--text-color)' }}
                >
                  Start a Session
                </h2>
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--text-secondary-color)' }}
                >
                  Select a quiz to start a live session
                </p>
              </div>
              <button
                onClick={() => {
                  setShowQuizModal(false)
                  setSelectedQuiz(null)
                }}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary-color)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {loadingQuizzes ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : quizzes.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: 'var(--text-secondary-color)' }}>
                    No quizzes available.
                  </p>
                  <button
                    onClick={() => {
                      setShowQuizModal(false)
                      navigate('/quiz/new')
                    }}
                    className="mt-4 px-4 py-2 rounded-lg font-medium"
                    style={{
                      backgroundColor: 'var(--primary-color)',
                      color: 'var(--text-on-primary-color)'
                    }}
                  >
                    Create Your First Quiz
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {quizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      onClick={() => setSelectedQuiz(quiz)}
                      className="p-4 rounded-lg cursor-pointer transition-all"
                      style={{
                        backgroundColor: selectedQuiz?.id === quiz.id
                          ? 'var(--primary-color)'
                          : 'var(--background-color)',
                        border: selectedQuiz?.id === quiz.id
                          ? '2px solid var(--primary-color)'
                          : '1px solid var(--border-color)'
                      }}
                    >
                      <h3
                        className="font-semibold"
                        style={{
                          color: selectedQuiz?.id === quiz.id
                            ? 'var(--text-on-primary-color)'
                            : 'var(--text-color)'
                        }}
                      >
                        {quiz.title}
                      </h3>
                      {quiz.description && (
                        <p
                          className="text-sm mt-1 line-clamp-2"
                          style={{
                            color: selectedQuiz?.id === quiz.id
                              ? 'var(--text-on-primary-color)'
                              : 'var(--text-secondary-color)',
                            opacity: selectedQuiz?.id === quiz.id ? 0.9 : 1
                          }}
                        >
                          {quiz.description}
                        </p>
                      )}
                      <p
                        className="text-xs mt-2"
                        style={{
                          color: selectedQuiz?.id === quiz.id
                            ? 'var(--text-on-primary-color)'
                            : 'var(--text-secondary-color)',
                          opacity: selectedQuiz?.id === quiz.id ? 0.8 : 0.7
                        }}
                      >
                        {quiz.questions.length} questions • {quiz.timeLimit}s per question
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {quizzes.length > 0 && (
              <div
                className="p-6 flex justify-end space-x-3"
                style={{ borderTop: '1px solid var(--border-color)' }}
              >
                <button
                  onClick={() => {
                    setShowQuizModal(false)
                    setSelectedQuiz(null)
                  }}
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={startQuickSession}
                  disabled={!selectedQuiz || creatingSession}
                  className="px-4 py-2 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--primary-color)',
                    color: 'var(--text-on-primary-color)'
                  }}
                >
                  {creatingSession ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Start Session</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


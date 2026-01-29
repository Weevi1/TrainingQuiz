import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Users, Clock, BarChart, Plus, Eye, Trash2, QrCode, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type GameSession } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const SessionManagement: React.FC = () => {
  const navigate = useNavigate()
  const { currentOrganization, hasPermission } = useAuth()
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [loading, setLoading] = useState(true)

  // Check permissions
  useEffect(() => {
    if (!hasPermission('create_sessions')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate])

  useEffect(() => {
    loadSessions()
  }, [currentOrganization])

  const loadSessions = async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      const sessionList = await FirestoreService.getOrganizationSessions(currentOrganization.id)
      setSessions(sessionList)
    } catch (error) {
      console.error('Error loading sessions:', error)
      alert('Error loading sessions')
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return
    }

    try {
      await FirestoreService.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Error deleting session')
    }
  }

  const createNewSession = () => {
    navigate('/session/create')
  }

  const viewSessionDetails = (sessionId: string) => {
    navigate(`/session/${sessionId}`)
  }

  const joinSession = (sessionCode: string) => {
    navigate(`/join/${sessionCode}`)
  }

  const getStatusStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'waiting':
        return { backgroundColor: 'var(--info-bg-color)', color: 'var(--info-color)' }
      case 'active':
        return { backgroundColor: 'var(--success-bg-color)', color: 'var(--success-color)' }
      case 'completed':
        return { backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary-color)' }
      default:
        return { backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary-color)' }
    }
  }

  const getGameTypeLabel = (gameType: string) => {
    const labels: Record<string, string> = {
      quiz: 'Quiz',
      millionaire: 'Millionaire',
      bingo: 'Bingo',
      speedround: 'Speed Round',
      spotdifference: 'Document Detective'
    }
    return labels[gameType] || gameType
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
              <h1 className="text-xl font-bold text-primary">Session Management</h1>
            </div>
            <button
              onClick={createNewSession}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>Create Session</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Sessions</p>
                <p className="text-3xl font-bold text-primary">{sessions.length}</p>
              </div>
              <BarChart className="text-primary" size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Active Sessions</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--success-color)' }}>
                  {sessions.filter(s => s.status === 'active').length}
                </p>
              </div>
              <Play size={32} style={{ color: 'var(--success-color)' }} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Waiting to Start</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--info-color)' }}>
                  {sessions.filter(s => s.status === 'waiting').length}
                </p>
              </div>
              <Clock size={32} style={{ color: 'var(--info-color)' }} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Participants</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--accent-color)' }}>
                  {sessions.reduce((acc, session) => acc + session.currentParticipants, 0)}
                </p>
              </div>
              <Users size={32} style={{ color: 'var(--accent-color)' }} />
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Training Sessions</h2>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Play className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-secondary-color)' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-color)' }}>No sessions yet</h3>
              <p className="text-text-secondary mb-6">
                Create your first training session to get started.
              </p>
              <button
                onClick={createNewSession}
                className="btn-primary"
              >
                Create Your First Session
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">Session</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Code</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Participants</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-border" style={{ ['--tw-bg-opacity' as string]: 1 }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-color)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{session.title}</div>
                          <div className="text-sm text-text-secondary">
                            Created by {session.trainerId}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="px-2 py-1 text-xs rounded capitalize"
                          style={{ backgroundColor: 'var(--accent-bg-color)', color: 'var(--accent-color)' }}
                        >
                          {getGameTypeLabel(session.gameType)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <code
                            className="px-2 py-1 rounded font-mono text-sm"
                            style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-color)' }}
                          >
                            {session.code}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(session.code)
                              alert('Session code copied!')
                            }}
                            className="hover:text-primary"
                            style={{ color: 'var(--text-secondary-color)' }}
                            title="Copy code"
                          >
                            <QrCode size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="px-2 py-1 text-xs rounded capitalize"
                          style={getStatusStyle(session.status)}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1">
                          <Users size={14} className="text-text-secondary" />
                          <span>{session.currentParticipants}/{session.participantLimit}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">
                        {session.createdAt.toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => viewSessionDetails(session.id)}
                            className="text-primary hover:underline text-sm flex items-center space-x-1"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>
                          {session.status === 'waiting' && (
                            <button
                              onClick={() => joinSession(session.code)}
                              className="hover:underline text-sm flex items-center space-x-1"
                              style={{ color: 'var(--success-color)' }}
                            >
                              <Play size={14} />
                              <span>Start</span>
                            </button>
                          )}
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="hover:underline text-sm flex items-center space-x-1"
                            style={{ color: 'var(--danger-color)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
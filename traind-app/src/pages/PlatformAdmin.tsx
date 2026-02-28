import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService } from '../lib/firestore'
import type { Organization } from '../lib/firestore'
import { Building, Users, CreditCard, BarChart, Plus, Settings, Crown, LogOut, Database, Edit2, Calendar, FileText, X, Check, Palette } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { BillingService, PLAN_PRICING, type PlanType } from '../lib/billing'
import { BrandingEditor } from '../components/BrandingEditor'

export const PlatformAdmin: React.FC = () => {
  const navigate = useNavigate()
  const { user, isPlatformAdmin, logout } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    totalUsers: 0,
    platformAdmins: 0,
    totalRevenue: 0,
    activeSubscriptions: 0
  })
  const [creatingData, setCreatingData] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [editForm, setEditForm] = useState({
    plan: 'basic' as PlanType,
    status: 'active' as 'active' | 'trial' | 'expired' | 'suspended',
    expiresAt: '',
    invoiceRef: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [managingTab, setManagingTab] = useState<'subscription' | 'branding'>('subscription')

  useEffect(() => {
    if (isPlatformAdmin()) {
      loadPlatformData()
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const createSampleData = async () => {
    if (!user) return

    setCreatingData(true)
    try {
      // Get first organization
      const orgs = await FirestoreService.getOrganizations()
      if (orgs.length === 0) {
        alert('Please create an organization first')
        return
      }

      const orgId = orgs[0].id
      console.log('Creating sample data for organization:', orgId)

      // Create sample quiz
      const sampleQuiz = {
        title: 'Workplace Safety Fundamentals',
        description: 'Essential safety protocols and emergency procedures for all employees',
        questions: [
          {
            id: 'q1',
            text: 'What is the first step when you discover a fire in the workplace?',
            type: 'multiple-choice',
            options: [
              'Try to extinguish it yourself',
              'Sound the alarm and evacuate',
              'Call your supervisor first',
              'Take a photo for documentation'
            ],
            correctAnswer: 1,
            timeLimit: 30,
            points: 100
          },
          {
            id: 'q2',
            text: 'How often should safety equipment be inspected?',
            type: 'multiple-choice',
            options: [
              'Once a year',
              'Monthly',
              'Weekly',
              'According to manufacturer guidelines'
            ],
            correctAnswer: 3,
            timeLimit: 25,
            points: 100
          },
          {
            id: 'q3',
            text: 'What does PPE stand for in workplace safety?',
            type: 'multiple-choice',
            options: [
              'Personal Protection Equipment',
              'Personnel Protective Equipment',
              'Personal Protective Equipment',
              'Public Protection Equipment'
            ],
            correctAnswer: 2,
            timeLimit: 20,
            points: 100
          }
        ],
        settings: {
          timeLimit: 30,
          showCorrectAnswers: true,
          allowReview: true,
          shuffleQuestions: false,
          shuffleAnswers: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: user.email,
        organizationId: orgId
      }

      await FirestoreService.createQuiz(orgId, sampleQuiz)

      // Create sample sessions
      const sampleSessions = [
        {
          type: 'quiz',
          title: 'Safety Training - Morning Shift',
          description: 'Mandatory safety training for all morning shift employees',
          status: 'created',
          settings: {
            maxParticipants: 50,
            allowLateJoin: true,
            showLeaderboard: true
          },
          createdAt: new Date(),
          organizationId: orgId,
          createdBy: user.email
        },
        {
          type: 'millionaire',
          title: 'Leadership Excellence Challenge',
          description: 'Test your leadership knowledge and climb to the top!',
          questions: [
            {
              level: 1,
              value: 100,
              question: 'What does effective communication primarily require?',
              options: ['Speaking loudly', 'Active listening', 'Using complex vocabulary', 'Talking frequently'],
              correctAnswer: 1,
              safetyNet: false
            },
            {
              level: 2,
              value: 200,
              question: 'Which leadership style involves shared decision-making?',
              options: ['Autocratic', 'Democratic', 'Laissez-faire', 'Bureaucratic'],
              correctAnswer: 1,
              safetyNet: false
            }
          ],
          lifelines: {
            fiftyFifty: true,
            phoneAFriend: true,
            askTheAudience: true
          },
          status: 'created',
          settings: {
            maxParticipants: 30,
            allowSpectators: true,
            timeLimit: 60
          },
          createdAt: new Date(),
          organizationId: orgId,
          createdBy: user.email
        },
        {
          type: 'bingo',
          title: 'Customer Service Excellence Bingo',
          description: 'Learn key customer service concepts while playing bingo!',
          terms: [
            'Active Listening', 'Empathy', 'Problem Solving', 'First Impression',
            'Follow-up', 'Complaint Resolution', 'Product Knowledge', 'Patience',
            'Communication Skills', 'Body Language', 'Tone of Voice', 'Rapport Building'
          ],
          callSequence: [
            { term: 'Active Listening', explanation: 'The foundation of great customer service' },
            { term: 'Empathy', explanation: 'Understanding and sharing customer feelings' }
          ],
          winPatterns: ['line', 'corners', 'fullHouse'],
          status: 'created',
          settings: {
            maxParticipants: 100,
            autoGenerate: true,
            callInterval: 30
          },
          createdAt: new Date(),
          organizationId: orgId,
          createdBy: user.email
        },
        {
          type: 'speedround',
          title: 'Tech Knowledge Sprint',
          description: 'Rapid-fire questions testing your technology knowledge!',
          questions: [
            { text: 'What does CPU stand for?', answer: 'Central Processing Unit', points: 10, timeLimit: 10 },
            { text: 'Which company created the iPhone?', answer: 'Apple', points: 10, timeLimit: 8 },
            { text: 'What does WWW stand for?', answer: 'World Wide Web', points: 10, timeLimit: 12 }
          ],
          rounds: 3,
          roundDuration: 120,
          status: 'created',
          settings: {
            maxParticipants: 50,
            showAnswers: true,
            allowSkip: true
          },
          createdAt: new Date(),
          organizationId: orgId,
          createdBy: user.email
        },
        {
          type: 'spotdifference',
          title: 'Policy Compliance Check',
          description: 'Spot the differences between old and new company policies',
          documents: [
            {
              title: 'Remote Work Policy Updates',
              differences: [
                {
                  section: 'Work Hours',
                  change: 'Flexibility increased from 2 hours to 4 hours daily',
                  importance: 'high'
                },
                {
                  section: 'Equipment Allowance',
                  change: 'Monthly allowance increased from $50 to $75',
                  importance: 'medium'
                }
              ],
              timeLimit: 300,
              minimumFinds: 3
            }
          ],
          status: 'created',
          settings: {
            maxParticipants: 25,
            showHints: true,
            collaborative: false
          },
          createdAt: new Date(),
          organizationId: orgId,
          createdBy: user.email
        }
      ]

      // Create all sample sessions
      for (const session of sampleSessions) {
        await FirestoreService.createSession(session)
      }

      alert('✅ Sample data created successfully! Check your organization dashboard to see the new quiz and sessions.')

    } catch (error) {
      console.error('Error creating sample data:', error)
      alert('Error creating sample data: ' + error.message)
    } finally {
      setCreatingData(false)
    }
  }

  const openEditModal = (org: Organization) => {
    setEditingOrg(org)
    setManagingTab('subscription')
    const expiresAt = org.subscription?.expiresAt
    setEditForm({
      plan: (org.subscription?.plan || 'basic') as PlanType,
      status: (org.subscription?.status || 'trial') as 'active' | 'trial' | 'expired' | 'suspended',
      expiresAt: expiresAt ? new Date(expiresAt).toISOString().split('T')[0] : '',
      invoiceRef: org.subscription?.invoiceRef || '',
      notes: org.subscription?.notes || ''
    })
  }

  const handleSaveSubscription = async () => {
    if (!editingOrg) return

    setSaving(true)
    try {
      const planData = PLAN_PRICING[editForm.plan]
      await FirestoreService.updateOrganization(editingOrg.id, {
        subscription: {
          plan: editForm.plan,
          status: editForm.status,
          modules: planData.modules,
          limits: planData.limits,
          expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt) : undefined,
          invoiceRef: editForm.invoiceRef || undefined,
          notes: editForm.notes || undefined
        }
      })

      // Refresh the organization list
      await loadPlatformData()
      setEditingOrg(null)
    } catch (error) {
      console.error('Error updating organization:', error)
      alert('Failed to update organization subscription')
    } finally {
      setSaving(false)
    }
  }

  const loadPlatformData = async () => {
    try {
      // Load actual organizations from Firestore
      const orgs = await FirestoreService.getOrganizations()
      setOrganizations(orgs)

      // Calculate real statistics
      let totalUsers = 0
      let activeSubscriptions = 0

      for (const org of orgs) {
        if (org.subscription?.status === 'active' || org.subscription?.status === 'trial') {
          activeSubscriptions++
        }
        // Note: We could count users per organization here if needed
        // But for now, we'll keep totalUsers as organization count since each org has at least 1 user
        totalUsers++
      }

      setStats({
        totalOrganizations: orgs.length,
        totalUsers: totalUsers, // Count of organizations (each has at least one user)
        platformAdmins: 1, // Just you for now
        totalRevenue: 0, // Revenue calculation would go here
        activeSubscriptions: activeSubscriptions
      })
    } catch (error) {
      console.error('Error loading platform data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isPlatformAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--error-color, #dc2626)' }}>Access Denied</h1>
          <p className="text-text-secondary">Platform Admin access required.</p>
        </div>
      </div>
    )
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
              <h1 className="text-xl font-bold text-primary">Platform Administration</h1>
              <span
                className="px-2 py-1 text-xs rounded font-medium"
                style={{ backgroundColor: 'var(--error-color-light, #fee2e2)', color: 'var(--error-color, #dc2626)' }}
              >
                SUPER ADMIN
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-text-secondary">
                {user?.displayName} • Platform Admin
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 text-sm rounded transition-colors"
                style={{ backgroundColor: 'var(--error-color, #dc2626)', color: 'var(--text-on-primary-color, #ffffff)' }}
                title="Sign Out"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Platform Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Organizations</p>
                <p className="text-3xl font-bold text-primary">{stats.totalOrganizations}</p>
              </div>
              <Building className="text-primary" size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Organization Users</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--success-color, #16a34a)' }}>{stats.totalUsers}</p>
              </div>
              <Users style={{ color: 'var(--success-color, #16a34a)' }} size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Platform Admins</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--primary-color, #2563eb)' }}>{stats.platformAdmins}</p>
              </div>
              <Crown style={{ color: 'var(--primary-color, #2563eb)' }} size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Monthly Revenue</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--secondary-color, #9333ea)' }}>${stats.totalRevenue}</p>
              </div>
              <CreditCard style={{ color: 'var(--secondary-color, #9333ea)' }} size={32} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Active Subscriptions</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--warning-color, #ea580c)' }}>{stats.activeSubscriptions}</p>
              </div>
              <BarChart style={{ color: 'var(--warning-color, #ea580c)' }} size={32} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div
            className="card hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              console.log('Platform Admin: Create Organization clicked')
              navigate('/setup')
            }}
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-color-light, #dbeafe)' }}>
                <Plus style={{ color: 'var(--primary-color, #2563eb)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold">Create Organization</h3>
                <p className="text-sm text-text-secondary">Set up a new customer organization</p>
              </div>
            </div>
          </div>

          <div className="card hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-color-light, #dcfce7)' }}>
                <Users style={{ color: 'var(--success-color, #16a34a)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold">Manage Users</h3>
                <p className="text-sm text-text-secondary">View and manage all platform users</p>
              </div>
            </div>
          </div>

          <div className="card hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary-color-light, #f3e8ff)' }}>
                <Settings style={{ color: 'var(--secondary-color, #9333ea)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold">Platform Settings</h3>
                <p className="text-sm text-text-secondary">Configure platform-wide settings</p>
              </div>
            </div>
          </div>

          <div
            className="card hover:shadow-md transition-shadow cursor-pointer"
            onClick={createSampleData}
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--warning-color-light, #fef3c7)' }}>
                <Database style={{ color: 'var(--warning-color, #d97706)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold">
                  {creatingData ? 'Creating...' : 'Create Sample Data'}
                </h3>
                <p className="text-sm text-text-secondary">
                  Add demo sessions for testing all game modules
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Organizations Table */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Organizations</h2>
            <button
              className="btn-primary flex items-center space-x-2"
              onClick={() => {
                console.log('Platform Admin: New Organization button clicked')
                navigate('/setup')
              }}
            >
              <Plus size={20} />
              <span>New Organization</span>
            </button>
          </div>

          {organizations.length === 0 ? (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-tertiary-color, #9ca3af)' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-color, #111827)' }}>No organizations yet</h3>
              <p className="text-text-secondary mb-6">
                Get started by creating the first organization on the platform.
              </p>
              <button
                className="btn-primary"
                onClick={() => {
                  console.log('Platform Admin: Create First Organization clicked')
                  navigate('/setup')
                }}
              >
                Create First Organization
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">Organization</th>
                    <th className="text-left py-3 px-4 font-medium">Plan</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Expires</th>
                    <th className="text-left py-3 px-4 font-medium">Invoice</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => {
                    const statusInfo = BillingService.getStatusMessage(org)
                    const daysLeft = BillingService.getDaysUntilExpiry(org)

                    return (
                      <tr key={org.id} className="border-b border-border">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-text-secondary">{org.domain || 'No domain'}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="px-2 py-1 text-xs rounded capitalize"
                            style={
                              org.subscription?.plan === 'enterprise'
                                ? { backgroundColor: 'var(--warning-color-light, #fef3c7)', color: 'var(--warning-color-dark, #92400e)' }
                                : org.subscription?.plan === 'professional'
                                ? { backgroundColor: 'var(--secondary-color-light, #f3e8ff)', color: 'var(--secondary-color-dark, #6b21a8)' }
                                : { backgroundColor: 'var(--primary-color-light, #dbeafe)', color: 'var(--primary-color-dark, #1e40af)' }
                            }
                          >
                            {org.subscription?.plan || 'None'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="px-2 py-1 text-xs rounded"
                            style={
                              statusInfo.color === 'green'
                                ? { backgroundColor: 'var(--success-color-light, #dcfce7)', color: 'var(--success-color-dark, #166534)' }
                                : statusInfo.color === 'yellow'
                                ? { backgroundColor: 'var(--warning-color-light, #fef3c7)', color: 'var(--warning-color-dark, #92400e)' }
                                : statusInfo.color === 'orange'
                                ? { backgroundColor: 'var(--warning-color-light, #ffedd5)', color: 'var(--warning-color-dark, #9a3412)' }
                                : statusInfo.color === 'red'
                                ? { backgroundColor: 'var(--error-color-light, #fee2e2)', color: 'var(--error-color-dark, #991b1b)' }
                                : { backgroundColor: 'var(--surface-color, #f3f4f6)', color: 'var(--text-secondary-color, #374151)' }
                            }
                          >
                            {statusInfo.message}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {org.subscription?.expiresAt ? (
                            <div>
                              <div>{new Date(org.subscription.expiresAt).toLocaleDateString('en-ZA')}</div>
                              {daysLeft !== null && (
                                <div
                                  className="text-xs"
                                  style={{ color: daysLeft <= 30 ? 'var(--warning-color, #ea580c)' : 'var(--text-secondary-color, #6b7280)' }}
                                >
                                  {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-secondary">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary">
                          {org.subscription?.invoiceRef || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openEditModal(org)}
                            className="text-primary hover:underline text-sm flex items-center space-x-1"
                          >
                            <Edit2 size={14} />
                            <span>Manage</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {/* Manage Organization Modal */}
      {editingOrg && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--modal-overlay-color, rgba(0,0,0,0.5))' }}>
          <div
            className={`rounded-lg p-6 w-full max-h-[90vh] overflow-y-auto transition-all ${managingTab === 'branding' ? 'max-w-4xl' : 'max-w-lg'}`}
            style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Manage {editingOrg.name}</h3>
              <button
                onClick={() => setEditingOrg(null)}
                className="p-2 rounded transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover-color, #f3f4f6)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--background-color, #f9fafb)' }}>
              <div className="font-medium">{editingOrg.name}</div>
              <div className="text-sm text-text-secondary">{editingOrg.domain || 'No domain set'}</div>
            </div>

            {/* Tab Bar */}
            <div className="flex space-x-1 mb-6 p-1 rounded-lg" style={{ backgroundColor: 'var(--background-color, #f3f4f6)' }}>
              <button
                onClick={() => setManagingTab('subscription')}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={managingTab === 'subscription'
                  ? { backgroundColor: 'var(--surface-color, #ffffff)', color: 'var(--primary-color, #2563eb)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                  : { color: 'var(--text-secondary-color, #6b7280)' }
                }
              >
                <CreditCard size={16} />
                <span>Subscription</span>
              </button>
              <button
                onClick={() => setManagingTab('branding')}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={managingTab === 'branding'
                  ? { backgroundColor: 'var(--surface-color, #ffffff)', color: 'var(--primary-color, #2563eb)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                  : { color: 'var(--text-secondary-color, #6b7280)' }
                }
              >
                <Palette size={16} />
                <span>Branding</span>
              </button>
            </div>

            {/* Subscription Tab */}
            {managingTab === 'subscription' && (
              <>
                <div className="space-y-4">
                  {/* Plan Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <CreditCard size={16} className="inline mr-2" />
                      Subscription Plan
                    </label>
                    <select
                      value={editForm.plan}
                      onChange={(e) => setEditForm({ ...editForm, plan: e.target.value as PlanType })}
                      className="input w-full"
                    >
                      {Object.entries(PLAN_PRICING).map(([key, plan]) => (
                        <option key={key} value={key}>
                          {plan.name} - {BillingService.formatZAR(plan.priceZAR)}/year
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-text-secondary mt-1">
                      Modules: {PLAN_PRICING[editForm.plan].modules.join(', ')}
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <Check size={16} className="inline mr-2" />
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as typeof editForm.status })}
                      className="input w-full"
                    >
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <Calendar size={16} className="inline mr-2" />
                      Expiry Date
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="date"
                        value={editForm.expiresAt}
                        onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                        className="input flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const oneYearFromNow = BillingService.calculateExpiryDate()
                          setEditForm({ ...editForm, expiresAt: oneYearFromNow.toISOString().split('T')[0] })
                        }}
                        className="btn-secondary text-sm"
                      >
                        +1 Year
                      </button>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      Set to 1 year from payment date
                    </p>
                  </div>

                  {/* Invoice Reference */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <FileText size={16} className="inline mr-2" />
                      Invoice Reference
                    </label>
                    <input
                      type="text"
                      value={editForm.invoiceRef}
                      onChange={(e) => setEditForm({ ...editForm, invoiceRef: e.target.value })}
                      className="input w-full"
                      placeholder="INV-2024-001"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Admin Notes
                    </label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="input w-full"
                      rows={3}
                      placeholder="Payment received via EFT on..."
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setEditingOrg(null)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSubscription}
                    disabled={saving}
                    className="flex-1 btn-primary flex items-center justify-center space-x-2"
                  >
                    {saving ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Branding Tab */}
            {managingTab === 'branding' && (
              <BrandingEditor
                orgId={editingOrg.id}
                organization={editingOrg}
                onUpdate={loadPlatformData}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService } from '../lib/firestore'
import type { Organization, User, PlatformSettings } from '../lib/firestore'
import {
  Building, Users, CreditCard, BarChart, Plus, Settings, Crown, LogOut,
  Database, Edit2, Calendar, FileText, X, Check, Palette, Search,
  UserCog, AlertTriangle, AlertCircle, Loader2, Trash2, ChevronDown, UserPlus, Mail
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { BillingService, PLAN_PRICING, type PlanType } from '../lib/billing'
import { BrandingEditor } from '../components/BrandingEditor'

// Per-org enriched data loaded during platform data fetch
type OrgUsageData = {
  members: User[]
  sessionCount: number
  activeSessionCount: number
  lastActive: Date | null
}

const ROLE_LABELS: Record<string, string> = {
  ORG_OWNER: 'Owner',
  ORG_ADMIN: 'Admin',
  TRAINER: 'Trainer',
  PARTICIPANT: 'Participant'
}

export const PlatformAdmin: React.FC = () => {
  const navigate = useNavigate()
  const { user, isPlatformAdmin, logout, resetPassword } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    totalUsers: 0,
    platformAdmins: 0,
    monthlyRevenue: 0,
    activeSubscriptions: 0
  })
  const [orgUsage, setOrgUsage] = useState<Record<string, OrgUsageData>>({})
  const [creatingData, setCreatingData] = useState(false)

  // Manage modal state
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [editForm, setEditForm] = useState({
    plan: 'basic' as PlanType,
    status: 'active' as 'active' | 'trial' | 'expired' | 'suspended',
    expiresAt: '',
    invoiceRef: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [managingTab, setManagingTab] = useState<'subscription' | 'branding' | 'team'>('subscription')

  // Team management in Manage modal
  const [editingMemberRole, setEditingMemberRole] = useState<string | null>(null)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  // Manage Users modal
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [usersSearch, setUsersSearch] = useState('')

  // Platform Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    defaultPlan: 'basic',
    trialDurationDays: 14,
    maxOrganizations: 100,
    maintenanceMode: false
  })
  const [savingSettings, setSavingSettings] = useState(false)

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
      const orgs = await FirestoreService.getOrganizations()
      if (orgs.length === 0) {
        alert('Please create an organization first')
        return
      }

      const orgId = orgs[0].id

      const sampleQuiz = {
        title: 'Workplace Safety Fundamentals',
        description: 'Essential safety protocols and emergency procedures for all employees',
        questions: [
          { id: 'q1', text: 'What is the first step when you discover a fire in the workplace?', type: 'multiple-choice', options: ['Try to extinguish it yourself', 'Sound the alarm and evacuate', 'Call your supervisor first', 'Take a photo for documentation'], correctAnswer: 1, timeLimit: 30, points: 100 },
          { id: 'q2', text: 'How often should safety equipment be inspected?', type: 'multiple-choice', options: ['Once a year', 'Monthly', 'Weekly', 'According to manufacturer guidelines'], correctAnswer: 3, timeLimit: 25, points: 100 },
          { id: 'q3', text: 'What does PPE stand for in workplace safety?', type: 'multiple-choice', options: ['Personal Protection Equipment', 'Personnel Protective Equipment', 'Personal Protective Equipment', 'Public Protection Equipment'], correctAnswer: 2, timeLimit: 20, points: 100 }
        ],
        settings: { timeLimit: 30, showCorrectAnswers: true, allowReview: true, shuffleQuestions: false, shuffleAnswers: true },
        createdAt: new Date(), updatedAt: new Date(), createdBy: user.email, organizationId: orgId
      }

      await FirestoreService.createQuiz(orgId, sampleQuiz)

      const sampleSessions = [
        { type: 'quiz', title: 'Safety Training - Morning Shift', description: 'Mandatory safety training for all morning shift employees', status: 'created', settings: { maxParticipants: 50, allowLateJoin: true, showLeaderboard: true }, createdAt: new Date(), organizationId: orgId, createdBy: user.email },
        { type: 'bingo', title: 'Customer Service Excellence Bingo', description: 'Learn key customer service concepts while playing bingo!', terms: ['Active Listening', 'Empathy', 'Problem Solving', 'First Impression', 'Follow-up', 'Complaint Resolution', 'Product Knowledge', 'Patience', 'Communication Skills', 'Body Language', 'Tone of Voice', 'Rapport Building'], callSequence: [{ term: 'Active Listening', explanation: 'The foundation of great customer service' }, { term: 'Empathy', explanation: 'Understanding and sharing customer feelings' }], winPatterns: ['line', 'corners', 'fullHouse'], status: 'created', settings: { maxParticipants: 100, autoGenerate: true, callInterval: 30 }, createdAt: new Date(), organizationId: orgId, createdBy: user.email }
      ]

      for (const session of sampleSessions) {
        await FirestoreService.createSession(session)
      }

      alert('Sample data created successfully! Check your organization dashboard.')
    } catch (error: any) {
      console.error('Error creating sample data:', error)
      alert('Error creating sample data: ' + error.message)
    } finally {
      setCreatingData(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toJsDate = (val: any): Date | null => {
    if (!val) return null
    if (val instanceof Date) return val
    if (typeof val.toDate === 'function') return val.toDate() // Firestore Timestamp
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }

  const openEditModal = (org: Organization) => {
    setEditingOrg(org)
    setManagingTab('subscription')
    const expiresDate = toJsDate(org.subscription?.expiresAt)
    setEditForm({
      plan: (org.subscription?.plan || 'basic') as PlanType,
      status: (org.subscription?.status || 'trial') as 'active' | 'trial' | 'expired' | 'suspended',
      expiresAt: expiresDate ? expiresDate.toISOString().split('T')[0] : '',
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

      await loadPlatformData()
      setEditingOrg(null)
    } catch (error) {
      console.error('Error updating organization:', error)
      alert('Failed to update organization subscription')
    } finally {
      setSaving(false)
    }
  }

  const handleRoleChange = async (orgId: string, userId: string, newRole: 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER') => {
    try {
      await FirestoreService.updateMemberRole(orgId, userId, newRole)
      // Refresh org usage data for this org
      const members = await FirestoreService.getOrgTeamMembers(orgId)
      setOrgUsage(prev => ({
        ...prev,
        [orgId]: { ...prev[orgId], members }
      }))
      setEditingMemberRole(null)
    } catch (error) {
      console.error('Error changing role:', error)
      alert('Failed to change role')
    }
  }

  const handleRemoveMember = async (orgId: string, userId: string) => {
    if (!confirm('Remove this member from the organization?')) return

    setRemovingMember(userId)
    try {
      await FirestoreService.removeMember(orgId, userId)
      const members = await FirestoreService.getOrgTeamMembers(orgId)
      setOrgUsage(prev => ({
        ...prev,
        [orgId]: { ...prev[orgId], members }
      }))
    } catch (error) {
      console.error('Error removing member:', error)
      alert('Failed to remove member')
    } finally {
      setRemovingMember(null)
    }
  }

  const handleUpdateMember = async (orgId: string, userId: string, updates: { displayName?: string; email?: string }) => {
    try {
      await FirestoreService.updateMemberDetails(orgId, userId, updates)
      const members = await FirestoreService.getOrgTeamMembers(orgId)
      setOrgUsage(prev => ({
        ...prev,
        [orgId]: { ...prev[orgId], members }
      }))
    } catch (error) {
      console.error('Error updating member:', error)
      alert('Failed to update member details')
    }
  }

  const [addMemberStatus, setAddMemberStatus] = useState<{ orgId: string; message: string; type: 'success' | 'error' | 'pending' } | null>(null)

  const handleAddMember = async (orgId: string, data: { email: string; displayName: string; role: 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER' }) => {
    try {
      const org = organizations.find(o => o.id === orgId)
      setAddMemberStatus({ orgId, message: `Creating account for ${data.email}...`, type: 'pending' })
      await FirestoreService.addMemberToOrg(orgId, data, org?.name)
      setAddMemberStatus({ orgId, message: `Account created! Welcome email sent to ${data.email}`, type: 'success' })
      // Cloud Function creates the user doc async — wait then refresh member list
      await new Promise(resolve => setTimeout(resolve, 4000))
      const members = await FirestoreService.getOrgTeamMembers(orgId)
      setOrgUsage(prev => ({
        ...prev,
        [orgId]: { ...prev[orgId], members }
      }))
      // Clear success message after 5s
      setTimeout(() => setAddMemberStatus(prev => prev?.orgId === orgId ? null : prev), 5000)
    } catch (error) {
      console.error('Error adding member:', error)
      setAddMemberStatus({ orgId, message: 'Failed to add member. Please try again.', type: 'error' })
      setTimeout(() => setAddMemberStatus(prev => prev?.orgId === orgId ? null : prev), 5000)
    }
  }

  const loadPlatformSettings = async () => {
    try {
      const settings = await FirestoreService.getPlatformSettings()
      setPlatformSettings({
        defaultPlan: settings.defaultPlan || 'basic',
        trialDurationDays: settings.trialDurationDays ?? 14,
        maxOrganizations: settings.maxOrganizations ?? 100,
        maintenanceMode: settings.maintenanceMode ?? false
      })
    } catch (error) {
      console.error('Error loading platform settings:', error)
    }
  }

  const handleSavePlatformSettings = async () => {
    setSavingSettings(true)
    try {
      await FirestoreService.updatePlatformSettings(platformSettings)
      setShowSettingsModal(false)
    } catch (error) {
      console.error('Error saving platform settings:', error)
      alert('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const loadPlatformData = async () => {
    try {
      const orgs = await FirestoreService.getOrganizations()
      setOrganizations(orgs)

      // Load per-org usage data in parallel
      const usageEntries = await Promise.all(
        orgs.map(async (org) => {
          try {
            const [members, sessions, activeCount] = await Promise.all([
              FirestoreService.getOrgTeamMembers(org.id),
              FirestoreService.getOrganizationSessions(org.id),
              FirestoreService.getActiveSessionCount(org.id)
            ])
            const lastActive = sessions.length > 0 ? sessions[0].createdAt : null
            return [org.id, { members, sessionCount: sessions.length, activeSessionCount: activeCount, lastActive }] as [string, OrgUsageData]
          } catch {
            return [org.id, { members: [], sessionCount: 0, activeSessionCount: 0, lastActive: null }] as [string, OrgUsageData]
          }
        })
      )
      const usageMap = Object.fromEntries(usageEntries)
      setOrgUsage(usageMap)

      // Calculate real statistics
      let totalUsers = 0
      let platformAdmins = 0
      let monthlyRevenue = 0
      let activeSubscriptions = 0

      for (const org of orgs) {
        const usage = usageMap[org.id]
        totalUsers += usage?.members.length || 0

        if (usage?.members) {
          for (const member of usage.members) {
            if (member.platformRole === 'PLATFORM_ADMIN') {
              platformAdmins++
            }
          }
        }

        const status = org.subscription?.status
        if (status === 'active' || status === 'trial') {
          activeSubscriptions++
          const plan = org.subscription?.plan as PlanType
          if (plan && PLAN_PRICING[plan] && status === 'active') {
            monthlyRevenue += PLAN_PRICING[plan].priceZAR / 12
          }
        }
      }

      // Ensure at least 1 platform admin (current user)
      if (platformAdmins === 0) platformAdmins = 1

      setStats({
        totalOrganizations: orgs.length,
        totalUsers,
        platformAdmins,
        monthlyRevenue,
        activeSubscriptions
      })
    } catch (error) {
      console.error('Error loading platform data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Collect all users across orgs for the Manage Users modal
  const allUsers = Object.entries(orgUsage).flatMap(([orgId, usage]) => {
    const org = organizations.find(o => o.id === orgId)
    return usage.members.map(member => ({
      ...member,
      orgId,
      orgName: org?.name || 'Unknown'
    }))
  })

  const filteredUsers = usersSearch
    ? allUsers.filter(u =>
        (u.displayName || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
        u.orgName.toLowerCase().includes(usersSearch.toLowerCase())
      )
    : allUsers

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
                <p className="text-sm font-medium text-text-secondary">Total Users</p>
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
                <p className="text-2xl font-bold" style={{ color: 'var(--secondary-color, #9333ea)' }}>
                  {BillingService.formatZAR(Math.round(stats.monthlyRevenue))}
                </p>
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
          <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/setup')}>
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

          <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShowUsersModal(true)}>
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

          <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => { loadPlatformSettings(); setShowSettingsModal(true) }}>
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

          <div className="card hover:shadow-md transition-shadow cursor-pointer" onClick={createSampleData}>
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--warning-color-light, #fef3c7)' }}>
                <Database style={{ color: 'var(--warning-color, #d97706)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold">{creatingData ? 'Creating...' : 'Create Sample Data'}</h3>
                <p className="text-sm text-text-secondary">Add demo sessions for testing</p>
              </div>
            </div>
          </div>
        </div>

        {/* Organizations Table */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Organizations</h2>
            <button className="btn-primary flex items-center space-x-2" onClick={() => navigate('/setup')}>
              <Plus size={20} />
              <span>New Organization</span>
            </button>
          </div>

          {organizations.length === 0 ? (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-tertiary-color, #9ca3af)' }} />
              <h3 className="text-lg font-medium mb-2">No organizations yet</h3>
              <p className="text-text-secondary mb-6">Get started by creating the first organization on the platform.</p>
              <button className="btn-primary" onClick={() => navigate('/setup')}>Create First Organization</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">Organization</th>
                    <th className="text-left py-3 px-4 font-medium">Plan</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Trainers</th>
                    <th className="text-left py-3 px-4 font-medium">Sessions</th>
                    <th className="text-left py-3 px-4 font-medium">Expires</th>
                    <th className="text-left py-3 px-4 font-medium">Last Active</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => {
                    const statusInfo = BillingService.getStatusMessage(org)
                    const daysLeft = BillingService.getDaysUntilExpiry(org)
                    const usage = orgUsage[org.id]
                    const trainerCount = usage?.members.filter(m => {
                      const role = m.organizations?.[org.id]?.role
                      return role === 'ORG_OWNER' || role === 'ORG_ADMIN' || role === 'TRAINER'
                    }).length || 0
                    const plan = org.subscription?.plan as PlanType
                    const trainerLimit = plan && PLAN_PRICING[plan] ? PLAN_PRICING[plan].limits.maxTrainers : 0

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
                          <span>{trainerCount}</span>
                          {trainerLimit > 0 && <span className="text-text-secondary"> / {trainerLimit}</span>}
                          {trainerLimit === -1 && <span className="text-text-secondary"> / ∞</span>}
                        </td>
                        <td className="py-3 px-4 text-sm">{usage?.sessionCount ?? '—'}</td>
                        <td className="py-3 px-4 text-sm">
                          {org.subscription?.expiresAt ? (
                            <div>
                              <div>{new Date(org.subscription.expiresAt).toLocaleDateString('en-ZA')}</div>
                              {daysLeft !== null && (
                                <div className="text-xs" style={{ color: daysLeft <= 30 ? 'var(--warning-color, #ea580c)' : 'var(--text-secondary-color, #6b7280)' }}>
                                  {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-secondary">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary">
                          {usage?.lastActive ? (toJsDate(usage.lastActive)?.toLocaleDateString('en-ZA') || 'Never') : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => openEditModal(org)} className="text-primary hover:underline text-sm flex items-center space-x-1">
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

      {/* ---- MODALS ---- */}

      {/* Manage Organization Modal */}
      {editingOrg && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--modal-overlay-color, rgba(0,0,0,0.5))' }}>
          <div
            className={`rounded-lg p-6 w-full max-h-[90vh] overflow-y-auto transition-all ${managingTab === 'branding' ? 'max-w-4xl' : 'max-w-2xl'}`}
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
              {([
                { key: 'subscription' as const, icon: CreditCard, label: 'Subscription' },
                { key: 'team' as const, icon: UserCog, label: 'Team' },
                { key: 'branding' as const, icon: Palette, label: 'Branding' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setManagingTab(tab.key)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  style={managingTab === tab.key
                    ? { backgroundColor: 'var(--surface-color, #ffffff)', color: 'var(--primary-color, #2563eb)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                    : { color: 'var(--text-secondary-color, #6b7280)' }
                  }
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
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

                  {/* Usage Gauges */}
                  <UsageGauges
                    org={editingOrg}
                    plan={editForm.plan}
                    orgUsage={orgUsage[editingOrg.id]}
                  />

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
                    <label className="block text-sm font-medium mb-2">Admin Notes</label>
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
                  <button onClick={() => setEditingOrg(null)} className="flex-1 btn-secondary">Cancel</button>
                  <button
                    onClick={handleSaveSubscription}
                    disabled={saving}
                    className="flex-1 btn-primary flex items-center justify-center space-x-2"
                  >
                    {saving ? <LoadingSpinner size="sm" /> : <><Check size={16} /><span>Save Changes</span></>}
                  </button>
                </div>
              </>
            )}

            {/* Team Tab */}
            {managingTab === 'team' && (
              <TeamTab
                org={editingOrg}
                members={orgUsage[editingOrg.id]?.members || []}
                editingMemberRole={editingMemberRole}
                setEditingMemberRole={setEditingMemberRole}
                removingMember={removingMember}
                onRoleChange={handleRoleChange}
                onRemove={handleRemoveMember}
                onUpdateMember={handleUpdateMember}
                onAddMember={handleAddMember}
                onResendEmail={resetPassword}
                addMemberStatus={addMemberStatus?.orgId === editingOrg?.id ? addMemberStatus : null}
              />
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

      {/* Manage Users Modal */}
      {showUsersModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--modal-overlay-color, rgba(0,0,0,0.5))' }}>
          <div className="rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">All Platform Users</h3>
              <button
                onClick={() => { setShowUsersModal(false); setUsersSearch('') }}
                className="p-2 rounded transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover-color, #f3f4f6)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
                placeholder="Search by name, email, or organization..."
                className="input w-full pl-9"
              />
            </div>

            <div className="text-sm text-text-secondary mb-3">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} across {organizations.length} organization{organizations.length !== 1 ? 's' : ''}
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                {usersSearch ? 'No users match your search.' : 'No users found.'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((u) => {
                  const orgRole = u.organizations?.[u.orgId]
                  const roleName = orgRole?.role ? (ROLE_LABELS[orgRole.role] || orgRole.role) : 'Member'

                  return (
                    <div
                      key={`${u.orgId}-${u.id}`}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                      style={{ backgroundColor: 'var(--background-color, #f9fafb)' }}
                      onClick={() => {
                        setShowUsersModal(false)
                        setUsersSearch('')
                        const org = organizations.find(o => o.id === u.orgId)
                        if (org) openEditModal(org)
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                          style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)' }}
                        >
                          {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.displayName || 'Unknown'}</p>
                          <p className="text-xs text-text-secondary">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-text-secondary">{u.orgName}</span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-hover-color)', color: 'var(--text-secondary-color)' }}>
                          {roleName}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Platform Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'var(--modal-overlay-color, rgba(0,0,0,0.5))' }}>
          <div className="rounded-lg p-6 w-full max-w-lg" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Platform Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 rounded transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover-color, #f3f4f6)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Default Plan for New Organizations</label>
                <select
                  value={platformSettings.defaultPlan}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, defaultPlan: e.target.value as PlatformSettings['defaultPlan'] })}
                  className="input w-full"
                >
                  <option value="basic">Basic</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Trial Duration (days)</label>
                <input
                  type="number"
                  value={platformSettings.trialDurationDays}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, trialDurationDays: parseInt(e.target.value) || 0 })}
                  className="input w-full"
                  min={0}
                  max={365}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Organizations</label>
                <input
                  type="number"
                  value={platformSettings.maxOrganizations}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, maxOrganizations: parseInt(e.target.value) || 0 })}
                  className="input w-full"
                  min={1}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--background-color, #f9fafb)' }}>
                <div>
                  <p className="font-medium text-sm">Maintenance Mode</p>
                  <p className="text-xs text-text-secondary">Prevents new sessions and sign-ups</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={platformSettings.maintenanceMode}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, maintenanceMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div
                    className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                    style={{ backgroundColor: platformSettings.maintenanceMode ? 'var(--error-color, #dc2626)' : 'var(--border-color, #d1d5db)' }}
                  />
                </label>
              </div>

              {platformSettings.maintenanceMode && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--error-color-light, #fee2e2)', color: 'var(--error-color, #dc2626)' }}>
                  <AlertTriangle size={16} />
                  <span>Maintenance mode is active. Users cannot create sessions or sign up.</span>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowSettingsModal(false)} className="flex-1 btn-secondary">Cancel</button>
              <button
                onClick={handleSavePlatformSettings}
                disabled={savingSettings}
                className="flex-1 btn-primary flex items-center justify-center space-x-2"
              >
                {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Usage Gauges Component ---

const UsageGauges: React.FC<{
  org: Organization
  plan: PlanType
  orgUsage?: OrgUsageData
}> = ({ org, plan, orgUsage }) => {
  const planData = PLAN_PRICING[plan]
  const trainerCount = orgUsage?.members.filter(m => {
    const role = m.organizations?.[org.id]?.role
    return role === 'ORG_OWNER' || role === 'ORG_ADMIN' || role === 'TRAINER'
  }).length || 0
  const activeSessionCount = orgUsage?.activeSessionCount || 0

  return (
    <div className="grid grid-cols-3 gap-3">
      <UsageGauge label="Trainers" current={trainerCount} limit={planData.limits.maxTrainers} />
      <UsageGauge label="Active Sessions" current={activeSessionCount} limit={planData.limits.maxSessions} />
      <UsageGauge label="Max Participants" current={0} limit={planData.limits.maxParticipants} showCurrent={false} />
    </div>
  )
}

const UsageGauge: React.FC<{
  label: string
  current: number
  limit: number
  showCurrent?: boolean
}> = ({ label, current, limit, showCurrent = true }) => {
  const isUnlimited = limit === -1
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min(100, (current / limit) * 100) : 0
  const color = pct >= 90 ? 'var(--error-color, #dc2626)' : pct >= 70 ? 'var(--warning-color, #ea580c)' : 'var(--success-color, #16a34a)'

  return (
    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--background-color, #f9fafb)' }}>
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className="text-sm font-medium">
        {showCurrent ? current : '—'} / {isUnlimited ? '∞' : limit}
      </p>
      {!isUnlimited && showCurrent && (
        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color, #e5e7eb)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      )}
    </div>
  )
}

// --- Team Tab Component ---

const TeamTab: React.FC<{
  org: Organization
  members: User[]
  editingMemberRole: string | null
  setEditingMemberRole: (id: string | null) => void
  removingMember: string | null
  onRoleChange: (orgId: string, userId: string, role: 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER') => void
  onRemove: (orgId: string, userId: string) => void
  onUpdateMember: (orgId: string, userId: string, updates: { displayName?: string; email?: string }) => void
  onAddMember: (orgId: string, data: { email: string; displayName: string; role: 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER' }) => Promise<void>
  onResendEmail: (email: string) => Promise<void>
  addMemberStatus: { message: string; type: 'success' | 'error' | 'pending' } | null
}> = ({ org, members, editingMemberRole, setEditingMemberRole, removingMember, onRoleChange, onRemove, onUpdateMember, onAddMember, onResendEmail, addMemberStatus }) => {
  const [editingDetails, setEditingDetails] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [newMember, setNewMember] = useState({ email: '', displayName: '', role: 'TRAINER' as 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER' })
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)

  const startEditing = (member: User) => {
    setEditingDetails(member.id)
    setEditName(member.displayName || '')
    setEditEmail(member.email || '')
  }

  const saveEditing = (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    if (!member) return
    const updates: { displayName?: string; email?: string } = {}
    if (editName !== (member.displayName || '')) updates.displayName = editName
    if (editEmail !== (member.email || '')) updates.email = editEmail
    if (Object.keys(updates).length > 0) {
      onUpdateMember(org.id, memberId, updates)
    }
    setEditingDetails(null)
  }

  const handleAdd = async () => {
    if (!newMember.email.trim() || !newMember.displayName.trim()) return
    setAddingMember(true)
    try {
      await onAddMember(org.id, newMember)
      setNewMember({ email: '', displayName: '', role: 'TRAINER' })
      setShowAddForm(false)
    } finally {
      setAddingMember(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-text-secondary">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1 text-sm px-3 py-1.5 rounded transition-colors"
          style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)' }}
        >
          <UserPlus size={14} />
          <span>Add Member</span>
        </button>
      </div>

      {showAddForm && (
        <div className="p-3 rounded-lg mb-3 space-y-2" style={{ backgroundColor: 'var(--background-color, #f9fafb)', border: '1px solid var(--border-color, #e5e7eb)' }}>
          <div className="text-sm font-medium mb-1">Add new member</div>
          <input
            value={newMember.displayName}
            onChange={(e) => setNewMember({ ...newMember, displayName: e.target.value })}
            className="input text-sm py-1.5 w-full"
            placeholder="Full name"
            autoFocus
          />
          <input
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
            className="input text-sm py-1.5 w-full"
            placeholder="Email address"
            type="email"
          />
          <select
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value as typeof newMember.role })}
            className="input text-sm py-1.5 w-full"
          >
            <option value="ORG_OWNER">Owner</option>
            <option value="ORG_ADMIN">Admin</option>
            <option value="TRAINER">Trainer</option>
          </select>
          <div className="flex space-x-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={addingMember || !newMember.email.trim() || !newMember.displayName.trim()}
              className="flex items-center space-x-1 text-sm px-3 py-1.5 rounded disabled:opacity-50"
              style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)' }}
            >
              {addingMember ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{addingMember ? 'Adding...' : 'Add'}</span>
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewMember({ email: '', displayName: '', role: 'TRAINER' }) }}
              className="text-sm px-3 py-1.5 rounded text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {addMemberStatus && (
        <div className={`flex items-center space-x-2 p-3 rounded-lg mb-3 text-sm ${
          addMemberStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          addMemberStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {addMemberStatus.type === 'pending' && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
          {addMemberStatus.type === 'success' && <Check size={14} className="flex-shrink-0" />}
          {addMemberStatus.type === 'error' && <AlertCircle size={14} className="flex-shrink-0" />}
          <span>{addMemberStatus.message}</span>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          <Users size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No team members found.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {members.map((member) => {
            const orgRole = member.organizations?.[org.id]
            const roleName = orgRole ? (ROLE_LABELS[orgRole.role] || orgRole.role) : 'Member'
            const isEditingRole = editingMemberRole === member.id
            const isEditingInfo = editingDetails === member.id

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: 'var(--background-color, #f9fafb)' }}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)' }}
                  >
                    {(member.displayName || member.email || '?').charAt(0).toUpperCase()}
                  </div>

                  {isEditingInfo ? (
                    <div className="flex-1 space-y-1">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input text-sm py-1 w-full"
                        placeholder="Display name"
                        autoFocus
                      />
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="input text-xs py-1 w-full"
                        placeholder="Email"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => saveEditing(member.id)}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingDetails(null)}
                          className="text-xs px-2 py-0.5 rounded text-text-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer min-w-0"
                      onClick={() => startEditing(member)}
                      title="Click to edit details"
                    >
                      <p className="font-medium text-sm truncate">{member.displayName || 'Unknown'}</p>
                      <p className="text-xs text-text-secondary truncate">{member.email}</p>
                    </div>
                  )}
                </div>

                {!isEditingInfo && (
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    {isEditingRole ? (
                      <select
                        defaultValue={orgRole?.role || 'TRAINER'}
                        onChange={(e) => onRoleChange(org.id, member.id, e.target.value as 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER')}
                        onBlur={() => setEditingMemberRole(null)}
                        autoFocus
                        className="input text-sm py-1"
                      >
                        <option value="ORG_OWNER">Owner</option>
                        <option value="ORG_ADMIN">Admin</option>
                        <option value="TRAINER">Trainer</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingMemberRole(member.id)}
                        className="text-xs px-2 py-1 rounded flex items-center space-x-1 transition-colors"
                        style={{ backgroundColor: 'var(--surface-hover-color)', color: 'var(--text-secondary-color)' }}
                        title="Change role"
                      >
                        <span>{roleName}</span>
                        <ChevronDown size={12} />
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        if (!member.email) return
                        setResendingEmail(member.id)
                        try {
                          await onResendEmail(member.email)
                          setResendSuccess(member.id)
                          setTimeout(() => setResendSuccess(prev => prev === member.id ? null : prev), 3000)
                        } catch {
                          alert('Failed to send reset email')
                        } finally {
                          setResendingEmail(null)
                        }
                      }}
                      disabled={resendingEmail === member.id}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: resendSuccess === member.id ? 'var(--success-color, #16a34a)' : 'var(--primary-color)' }}
                      title={resendSuccess === member.id ? 'Email sent!' : 'Send password reset email'}
                    >
                      {resendingEmail === member.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : resendSuccess === member.id ? (
                        <Check size={14} />
                      ) : (
                        <Mail size={14} />
                      )}
                    </button>

                    <button
                      onClick={() => onRemove(org.id, member.id)}
                      disabled={removingMember === member.id}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: 'var(--error-color, #dc2626)' }}
                      title="Remove member"
                    >
                      {removingMember === member.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

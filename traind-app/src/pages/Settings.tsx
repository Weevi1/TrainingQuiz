import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type Invitation, type User as FirestoreUser } from '../lib/firestore'
import { Timestamp } from 'firebase/firestore'
import {
  ArrowLeft,
  Users,
  Building,
  CreditCard,
  ChevronRight,
  Plus,
  Mail,
  Loader2,
  Clock,
  X,
  UserMinus,
  Shield,
  ChevronDown
} from 'lucide-react'
import { OrgLogo } from '../components/OrgLogo'

type SettingsTab = 'team' | 'organization' | 'billing'

export const Settings: React.FC = () => {
  const navigate = useNavigate()
  const { user, currentOrganization, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('team')

  if (!currentOrganization) {
    return null
  }

  const canManageTeam = hasPermission('manage_users')
  const canManageOrg = hasPermission('manage_organization')
  const canManageBilling = hasPermission('manage_billing')

  const tabs = [
    { id: 'team' as const, label: 'Team', icon: Users, show: canManageTeam },
    { id: 'organization' as const, label: 'Organization', icon: Building, show: canManageOrg },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard, show: canManageBilling },
  ].filter(tab => tab.show)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background-color)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 mr-3 rounded-md transition-colors"
              style={{ color: 'var(--text-secondary-color)' }}
            >
              <ArrowLeft size={20} />
            </button>
            <OrgLogo
              logo={currentOrganization?.branding?.logo}
              orgName={currentOrganization?.name}
              size="sm"
            />
            <h1 className="text-lg font-semibold ml-3" style={{ color: 'var(--text-color)' }}>
              Settings
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-56 flex-shrink-0">
            <div className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors"
                  style={{
                    backgroundColor: activeTab === tab.id ? 'var(--surface-color)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary-color)'
                  }}
                >
                  <tab.icon size={18} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'team' && <TeamSettings />}
            {activeTab === 'organization' && <OrganizationSettings />}
            {activeTab === 'billing' && <BillingSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

const ROLE_LABELS: Record<string, string> = {
  ORG_OWNER: 'Owner',
  ORG_ADMIN: 'Admin',
  TRAINER: 'Trainer',
  PARTICIPANT: 'Participant'
}

const TeamSettings: React.FC = () => {
  const { user, currentOrganization } = useAuth()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ORG_ADMIN' | 'TRAINER'>('TRAINER')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<FirestoreUser[]>([])
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  const orgId = currentOrganization?.id

  useEffect(() => {
    if (!orgId) return
    let cancelled = false

    const loadTeamData = async () => {
      try {
        const [members, invites] = await Promise.all([
          FirestoreService.getOrgTeamMembers(orgId),
          FirestoreService.getOrgInvitations(orgId, 'pending')
        ])
        if (!cancelled) {
          setTeamMembers(members)
          // Filter out expired invitations client-side
          setPendingInvites(invites.filter(inv => new Date(inv.expiresAt) > new Date()))
          setLoading(false)
        }
      } catch (err) {
        console.error('Error loading team data:', err)
        if (!cancelled) setLoading(false)
      }
    }

    loadTeamData()
    return () => { cancelled = true }
  }, [orgId])

  const handleInvite = async () => {
    if (!inviteEmail || !orgId || !user || !currentOrganization) return

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      setError('Please enter a valid email address.')
      setTimeout(() => setError(null), 4000)
      return
    }

    const normalizedEmail = inviteEmail.toLowerCase().trim()

    // Check if already a team member
    if (teamMembers.some(m => m.email?.toLowerCase() === normalizedEmail)) {
      setError('This person is already a team member.')
      setTimeout(() => setError(null), 4000)
      return
    }

    // Check if already has a pending invite
    if (pendingInvites.some(inv => inv.email === normalizedEmail)) {
      setError('An invitation for this email is already pending.')
      setTimeout(() => setError(null), 4000)
      return
    }

    setSending(true)
    setError(null)

    try {
      const token = crypto.randomUUID()
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

      const inviteData = {
        email: normalizedEmail,
        role: inviteRole,
        status: 'pending' as const,
        token,
        invitedBy: user.id || '',
        invitedByName: user.displayName || user.email || '',
        organizationId: orgId,
        organizationName: currentOrganization.name,
        expiresAt: expiresAt as any,
      }

      await FirestoreService.createInvitation(orgId, inviteData)

      // Add to local state
      setPendingInvites(prev => [{
        ...inviteData,
        id: 'temp-' + Date.now(),
        createdAt: new Date(),
        expiresAt: expiresAt.toDate(),
      }, ...prev])

      setInviteEmail('')
      setInviteRole('TRAINER')
      setSuccessMsg(`Invitation sent to ${normalizedEmail}`)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      console.error('Error sending invitation:', err)
      setError(err.message || 'Failed to send invitation. Please try again.')
      setTimeout(() => setError(null), 4000)
    } finally {
      setSending(false)
    }
  }

  const handleRevoke = async (invite: Invitation) => {
    if (!orgId) return

    try {
      await FirestoreService.updateInvitation(orgId, invite.id, { status: 'revoked' })
      setPendingInvites(prev => prev.filter(inv => inv.id !== invite.id))
      setSuccessMsg('Invitation revoked.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invitation.')
      setTimeout(() => setError(null), 4000)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-color)' }}>
        Team Members
      </h2>

      {successMsg && (
        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--success-light-color, #dcfce7)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--success-color, #16a34a)' }}>
            {successMsg}
          </p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--error-light-color, #fee2e2)' }}>
          <p className="text-sm" style={{ color: 'var(--error-color)' }}>
            {error}
          </p>
        </div>
      )}

      {/* Invite Form */}
      <div
        className="p-6 rounded-xl mb-8"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <h3 className="font-medium mb-4" style={{ color: 'var(--text-color)' }}>
          Invite team member
        </h3>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted-color)' }}
            />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="colleague@company.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg"
              style={{
                backgroundColor: 'var(--background-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)'
              }}
            />
          </div>
          <div className="relative">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'ORG_ADMIN' | 'TRAINER')}
              className="appearance-none pl-3 pr-8 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--background-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)'
              }}
            >
              <option value="TRAINER">Trainer</option>
              <option value="ORG_ADMIN">Admin</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted-color)' }}
            />
          </div>
          <button
            onClick={handleInvite}
            disabled={sending || !inviteEmail}
            className="px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2"
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'var(--text-on-primary-color)',
              opacity: (sending || !inviteEmail) ? 0.6 : 1
            }}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            <span>{sending ? 'Sending...' : 'Invite'}</span>
          </button>
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium mb-3 flex items-center space-x-2" style={{ color: 'var(--text-secondary-color)' }}>
            <Clock size={14} />
            <span>Pending Invitations ({pendingInvites.length})</span>
          </h3>
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
          >
            {pendingInvites.map((invite, index) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4"
                style={{
                  borderBottom: index < pendingInvites.length - 1 ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--surface-hover-color)',
                      color: 'var(--text-muted-color)'
                    }}
                  >
                    <Mail size={16} />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-color)' }}>
                      {invite.email}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted-color)' }}>
                      Invited {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : ''} &middot; Expires {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className="text-sm px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: 'var(--surface-hover-color)',
                      color: 'var(--text-secondary-color)'
                    }}
                  >
                    {ROLE_LABELS[invite.role] || invite.role}
                  </span>
                  <button
                    onClick={() => handleRevoke(invite)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--text-muted-color)' }}
                    title="Revoke invitation"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
        </div>
      ) : teamMembers.length > 0 ? (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
        >
          {teamMembers.map((member, index) => {
            const orgRole = member.organizations?.[orgId || '']
            const roleName = orgRole ? (ROLE_LABELS[orgRole.role] || orgRole.role) : 'Member'

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-4"
                style={{
                  borderBottom: index < teamMembers.length - 1 ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-medium"
                    style={{
                      backgroundColor: 'var(--primary-color)',
                      color: 'var(--text-on-primary-color)'
                    }}
                  >
                    {(member.displayName || member.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-color)' }}>
                      {member.displayName || 'Unknown'}{member.id === user?.id ? ' (You)' : ''}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className="text-sm px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: 'var(--surface-hover-color)',
                      color: 'var(--text-secondary-color)'
                    }}
                  >
                    {roleName}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12" style={{ color: 'var(--text-muted-color)' }}>
          <Users size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No team members yet. Invite someone above.</p>
        </div>
      )}
    </div>
  )
}

const OrganizationSettings: React.FC = () => {
  const { currentOrganization } = useAuth()
  const [orgName, setOrgName] = useState(currentOrganization?.name || '')
  const [enableAttendanceCerts, setEnableAttendanceCerts] = useState(
    currentOrganization?.settings?.enableAttendanceCertificates ?? false
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!currentOrganization) return

    setSaving(true)
    try {
      await FirestoreService.updateOrganization(currentOrganization.id, {
        name: orgName,
        settings: {
          ...currentOrganization.settings,
          enableAttendanceCertificates: enableAttendanceCerts
        }
      } as any)
      alert('Organization settings saved')
    } catch (error) {
      console.error('Error saving organization settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-color)' }}>
        Organization Settings
      </h2>

      <div
        className="p-6 rounded-xl"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="space-y-6">
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-color)' }}
            >
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg"
              style={{
                backgroundColor: 'var(--background-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)'
              }}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-color)' }}
            >
              Organization ID
            </label>
            <p
              className="px-4 py-2.5 rounded-lg text-sm font-mono"
              style={{
                backgroundColor: 'var(--background-color)',
                color: 'var(--text-secondary-color)'
              }}
            >
              {currentOrganization?.id}
            </p>
          </div>

          {/* Attendance Certificates Toggle */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableAttendanceCerts}
                onChange={(e) => setEnableAttendanceCerts(e.target.checked)}
                className="w-5 h-5 rounded"
                style={{ accentColor: 'var(--primary-color)' }}
              />
              <div>
                <span className="font-medium" style={{ color: 'var(--text-color)' }}>
                  Enable Attendance Certificates
                </span>
                <p className="text-sm" style={{ color: 'var(--text-secondary-color)' }}>
                  Allow participants to download attendance certificates from their results page.
                  Admins can also generate certificates in bulk from completed sessions.
                </p>
              </div>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg font-medium"
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'var(--text-on-primary-color)',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

const BillingSettings: React.FC = () => {
  const navigate = useNavigate()
  const { currentOrganization } = useAuth()

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-color)' }}>
        Billing
      </h2>

      <div
        className="p-6 rounded-xl"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-medium" style={{ color: 'var(--text-color)' }}>
              Current Plan
            </p>
            <p
              className="text-2xl font-bold capitalize"
              style={{ color: 'var(--primary-color)' }}
            >
              {currentOrganization?.subscription?.plan || 'Basic'}
            </p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'var(--success-light-color)',
              color: 'var(--success-color)'
            }}
          >
            {currentOrganization?.subscription?.status || 'Active'}
          </span>
        </div>

        <button
          onClick={() => navigate('/billing')}
          className="w-full flex items-center justify-between p-4 rounded-lg transition-colors"
          style={{
            backgroundColor: 'var(--background-color)',
            border: '1px solid var(--border-color)'
          }}
        >
          <span style={{ color: 'var(--text-color)' }}>Manage subscription & billing</span>
          <ChevronRight size={18} style={{ color: 'var(--text-secondary-color)' }} />
        </button>
      </div>
    </div>
  )
}

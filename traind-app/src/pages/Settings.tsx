import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBranding } from '../contexts/BrandingContext'
import {
  ArrowLeft,
  Users,
  Building,
  Palette,
  CreditCard,
  ChevronRight,
  Plus,
  Trash2,
  Mail
} from 'lucide-react'

type SettingsTab = 'team' | 'organization' | 'branding' | 'billing'

export const Settings: React.FC = () => {
  const navigate = useNavigate()
  const { user, currentOrganization, hasPermission } = useAuth()
  const { brandingConfig } = useBranding()
  const [activeTab, setActiveTab] = useState<SettingsTab>('team')

  if (!currentOrganization) {
    return null
  }

  const canManageTeam = hasPermission('manage_users')
  const canManageOrg = hasPermission('manage_organization')
  const canManageBranding = hasPermission('manage_branding')
  const canManageBilling = hasPermission('manage_billing')

  const tabs = [
    { id: 'team' as const, label: 'Team', icon: Users, show: canManageTeam },
    { id: 'organization' as const, label: 'Organization', icon: Building, show: canManageOrg },
    { id: 'branding' as const, label: 'Branding', icon: Palette, show: canManageBranding },
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
              className="p-2 mr-4 rounded-md transition-colors"
              style={{ color: 'var(--text-secondary-color)' }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-color)' }}>
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
            {activeTab === 'branding' && <BrandingSettings />}
            {activeTab === 'billing' && <BillingSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

const TeamSettings: React.FC = () => {
  const { currentOrganization } = useAuth()
  const [inviteEmail, setInviteEmail] = useState('')

  // Mock team data - would come from Firestore
  const teamMembers = [
    { id: '1', name: 'You', email: 'current@user.com', role: 'Owner' }
  ]

  const handleInvite = () => {
    if (inviteEmail) {
      alert(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-color)' }}>
        Team Members
      </h2>

      {/* Invite */}
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
              placeholder="colleague@company.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg"
              style={{
                backgroundColor: 'var(--background-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)'
              }}
            />
          </div>
          <button
            onClick={handleInvite}
            className="px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2"
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'var(--text-on-primary-color)'
            }}
          >
            <Plus size={18} />
            <span>Invite</span>
          </button>
        </div>
      </div>

      {/* Team List */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        {teamMembers.map((member, index) => (
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
                {member.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-color)' }}>
                  {member.name}
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
                {member.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const OrganizationSettings: React.FC = () => {
  const { currentOrganization } = useAuth()
  const [orgName, setOrgName] = useState(currentOrganization?.name || '')

  const handleSave = () => {
    alert('Organization settings saved')
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

          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg font-medium"
            style={{
              backgroundColor: 'var(--primary-color)',
              color: 'var(--text-on-primary-color)'
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

const BrandingSettings: React.FC = () => {
  const { brandingConfig } = useBranding()

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-color)' }}>
        Branding
      </h2>

      <div
        className="p-6 rounded-xl"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
      >
        <p className="mb-6" style={{ color: 'var(--text-secondary-color)' }}>
          Customize your organization's look and feel
        </p>

        <div className="space-y-6">
          {/* Current Theme Preview */}
          <div>
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: 'var(--text-color)' }}
            >
              Current Theme
            </label>
            <div className="flex items-center space-x-4">
              <div
                className="w-12 h-12 rounded-lg"
                style={{ backgroundColor: 'var(--primary-color)' }}
                title="Primary Color"
              />
              <div
                className="w-12 h-12 rounded-lg"
                style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
                title="Surface Color"
              />
              <div
                className="w-12 h-12 rounded-lg"
                style={{ backgroundColor: 'var(--background-color)', border: '1px solid var(--border-color)' }}
                title="Background Color"
              />
            </div>
          </div>

          <p className="text-sm" style={{ color: 'var(--text-muted-color)' }}>
            Theme customization coming soon. Contact support for custom branding.
          </p>
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

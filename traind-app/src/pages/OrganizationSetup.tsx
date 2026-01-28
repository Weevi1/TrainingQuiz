import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Building, Palette, CreditCard, X, Calendar, FileText, Check } from 'lucide-react'
import { getAllThemePresets, getThemePreset, type ThemePresetId, type ThemeColors, type ThemeTypography, type ThemeBackground } from '../lib/themePresets'
import { loadFont } from '../lib/fontLoader'

export const OrganizationSetup: React.FC = () => {
  const { createOrganization, availableOrganizations, switchOrganization, isPlatformAdmin, firebaseUser, register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreateNew, setShowCreateNew] = useState(false)

  // Debug logging - only once per mount
  useEffect(() => {
    console.log('OrganizationSetup - availableOrganizations:', availableOrganizations)
    console.log('OrganizationSetup - isPlatformAdmin:', isPlatformAdmin())
  }, [availableOrganizations])

  // Organization data
  const [orgData, setOrgData] = useState({
    name: '',
    domain: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e40af',
    theme: 'corporate' as const,
    plan: 'basic' as const,
    // Manual billing fields (Platform Admin only)
    expiresAt: '',
    invoiceRef: '',
    // New theming fields
    themePreset: 'corporate-blue' as ThemePresetId,
    colors: getThemePreset('corporate-blue').colors,
    typography: getThemePreset('corporate-blue').typography,
    background: getThemePreset('corporate-blue').background
  })

  // First admin user data
  const [adminUser, setAdminUser] = useState({
    email: '',
    displayName: '',
    password: '',
    confirmPassword: ''
  })

  const handleCreateOrganization = async () => {
    setLoading(true)
    setError('')

    // Remember if this was a Platform Admin operation before user creation changes auth state
    const wasPlatformAdminOperation = isPlatformAdmin()

    try {
      // For self-service registration (no firebaseUser), create user account first
      if (!firebaseUser) {
        console.log('Self-service registration - creating user account first...')
        if (!adminUser.email || !adminUser.password || !adminUser.displayName) {
          throw new Error('Please fill in all user account details')
        }

        // Create the user account first
        await register(adminUser.email, adminUser.password, adminUser.displayName)
        console.log('User account created successfully')

        // Store org data in localStorage to continue after auth state updates
        localStorage.setItem('pendingOrgCreation', JSON.stringify({
          orgData,
          plan: orgData.plan
        }))

        // The auth state listener will redirect to dashboard, where we'll complete org creation
        return
      }

      // Existing flow for authenticated users
      const orgId = await createOrganization({
        name: orgData.name,
        domain: orgData.domain,
        branding: {
          primaryColor: orgData.primaryColor,
          secondaryColor: orgData.secondaryColor,
          theme: orgData.theme,
          // New theming fields
          themePreset: orgData.themePreset,
          colors: orgData.colors,
          typography: orgData.typography,
          background: orgData.background
        },
        subscription: {
          plan: orgData.plan,
          status: orgData.expiresAt ? 'active' : 'trial',
          modules: orgData.plan === 'basic'
            ? ['quiz', 'bingo']
            : orgData.plan === 'professional'
            ? ['quiz', 'bingo', 'millionaire', 'speedround', 'spotdifference']
            : ['quiz', 'bingo', 'millionaire', 'speedround', 'spotdifference'],
          limits: {
            maxParticipants: orgData.plan === 'basic' ? 50 : orgData.plan === 'professional' ? 200 : 1000,
            maxSessions: orgData.plan === 'basic' ? 10 : orgData.plan === 'professional' ? 50 : -1,
            maxTrainers: orgData.plan === 'basic' ? 3 : orgData.plan === 'professional' ? 10 : -1
          },
          // Manual billing fields
          expiresAt: orgData.expiresAt ? new Date(orgData.expiresAt) : undefined,
          invoiceRef: orgData.invoiceRef || undefined
        }
      }, isPlatformAdmin() ? {
        email: adminUser.email,
        displayName: adminUser.displayName,
        password: adminUser.password
      } : undefined)

      // Navigate based on user type
      if (wasPlatformAdminOperation) {
        // Platform Admin created org for client - show success and redirect to admin dashboard
        alert('✅ Organization created successfully!\n\nThe client user has been created with the following credentials:\nEmail: ' + adminUser.email + '\nPassword: ' + adminUser.password + '\n\nPlease share these credentials with your client.')

        // Since createUserWithEmailAndPassword logged in the client user,
        // we need to redirect to login page so Platform Admin can log back in
        navigate('/login')
      } else {
        navigate('/dashboard') // Organization dashboard (after auto-switch)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }


  const handleJoinExisting = async (orgId: string) => {
    try {
      await switchOrganization(orgId)
      navigate('/dashboard')
    } catch (error: any) {
      setError(error.message || 'Failed to switch to organization')
    }
  }

  // If user has organizations available and hasn't chosen to create new, show selection (but not for Platform Admins)
  if (availableOrganizations.length > 0 && !showCreateNew && !isPlatformAdmin()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="card relative">
            {/* Close Button */}
            <button
              onClick={() => navigate('/dashboard')}
              className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
              title="Cancel and return to dashboard"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">Select Organization</h1>
              <p className="text-text-secondary">
                Choose an organization to continue or create a new one.
              </p>
            </div>

            <div className="space-y-4">
              {availableOrganizations.map((org) => (
                <button
                  key={org.orgId}
                  onClick={() => handleJoinExisting(org.orgId)}
                  className="w-full p-4 text-left border border-border rounded-lg hover:bg-surface transition-colors"
                >
                  <div className="font-medium">{org.orgName}</div>
                  <div className="text-sm text-text-secondary">Role: {org.role}</div>
                </button>
              ))}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-background text-text-secondary">or</span>
                </div>
              </div>

              <button
                onClick={() => {
                  console.log('Create New Organization clicked')
                  setShowCreateNew(true)
                  setStep(1)
                }}
                className="w-full btn-primary"
              >
                Create New Organization
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="card relative">
          {/* Close Button */}
          <button
            onClick={() => {
              console.log('Closing organization setup wizard')
              setShowCreateNew(false)
              navigate('/dashboard')
            }}
            className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg transition-colors"
            title="Cancel and return to dashboard"
          >
            <X size={20} />
          </button>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3, 4].map((stepNumber) => (
                <React.Fragment key={stepNumber}>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                    style={{
                      backgroundColor: step >= stepNumber ? 'var(--primary-color)' : 'var(--border-color)',
                      color: step >= stepNumber ? 'var(--text-on-primary-color)' : 'var(--text-secondary-color)'
                    }}
                  >
                    {stepNumber}
                  </div>
                  {stepNumber < 4 && (
                    <div
                      className="w-12 h-0.5"
                      style={{
                        backgroundColor: step > stepNumber ? 'var(--primary-color)' : 'var(--border-color)'
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {error && (
            <div
              className="mb-6 p-4 rounded-lg"
              style={{
                backgroundColor: 'var(--error-bg-color, rgba(239, 68, 68, 0.1))',
                border: '1px solid var(--error-border-color, rgba(239, 68, 68, 0.3))'
              }}
            >
              <p style={{ color: 'var(--error-color)' }}>{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Building className="mx-auto h-12 w-12 text-primary mb-4" />
                <h2 className="text-2xl font-bold mb-2">Organization Details</h2>
                <p className="text-text-secondary">
                  Let's start by setting up your organization's basic information.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    className="input"
                    placeholder="Acme Corporation"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={orgData.domain}
                    onChange={(e) => setOrgData({ ...orgData, domain: e.target.value })}
                    className="input"
                    placeholder="acme.com"
                  />
                  <p className="text-sm text-text-secondary mt-1">
                    Optional: Used for email domain verification
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  console.log('Continue to step 2, current step:', step)
                  setStep(2)
                }}
                disabled={!orgData.name.trim()}
                className="w-full btn-primary"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Palette className="mx-auto h-12 w-12 text-primary mb-4" />
                <h2 className="text-2xl font-bold mb-2">Choose Your Theme</h2>
                <p className="text-text-secondary">
                  Select a theme that matches your organization's style.
                </p>
              </div>

              {/* Theme Preset Gallery */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(getAllThemePresets()).map(([id, preset]) => {
                  const isSelected = orgData.themePreset === id
                  const { colors, typography, background } = preset

                  // Generate preview background
                  const previewBg = background?.type === 'gradient' && background.value
                    ? background.value
                    : colors.background

                  return (
                    <button
                      key={id}
                      onClick={async () => {
                        // Load fonts if needed
                        const fontName = typography?.fontFamily?.split(',')[0]?.replace(/['"]/g, '').trim()
                        if (fontName) await loadFont(fontName)

                        setOrgData({
                          ...orgData,
                          themePreset: id as ThemePresetId,
                          primaryColor: colors.primary,
                          secondaryColor: colors.secondary,
                          colors: colors,
                          typography: typography,
                          background: background
                        })
                      }}
                      className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected ? 'ring-2 ring-offset-2' : 'hover:shadow-lg'
                      }`}
                      style={{
                        borderColor: isSelected ? colors.primary : 'var(--border-color)',
                        ['--tw-ring-color' as string]: colors.primary
                      }}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div
                          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Check size={12} style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
                        </div>
                      )}

                      {/* Preview area */}
                      <div
                        className="h-16 rounded mb-2 overflow-hidden"
                        style={{ background: previewBg }}
                      >
                        <div className="p-2 h-full flex flex-col justify-between">
                          <div className="h-2 w-10 rounded" style={{ backgroundColor: colors.primary }} />
                          <div className="flex gap-1">
                            <div className="h-4 flex-1 rounded" style={{ backgroundColor: colors.surface }} />
                            <div className="h-4 w-6 rounded" style={{ backgroundColor: colors.success }} />
                          </div>
                        </div>
                      </div>

                      {/* Preset name and description */}
                      <h4 className="text-sm font-medium">{preset.name}</h4>
                      <p className="text-xs text-text-secondary truncate" title={preset.description}>
                        {preset.description}
                      </p>

                      {/* Color swatches */}
                      <div className="flex gap-1 mt-1">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: colors.primary, borderColor: 'var(--border-color)' }} />
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: colors.secondary, borderColor: 'var(--border-color)' }} />
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: colors.success, borderColor: 'var(--border-color)' }} />
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Custom Color Override (Optional) */}
              <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-sm text-text-secondary mb-3">
                  Or override with custom colors:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Primary</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={orgData.primaryColor}
                        onChange={(e) => {
                          const newColors = { ...orgData.colors, primary: e.target.value }
                          setOrgData({ ...orgData, primaryColor: e.target.value, colors: newColors })
                        }}
                        className="w-10 h-8 border border-border rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={orgData.primaryColor}
                        onChange={(e) => {
                          const newColors = { ...orgData.colors, primary: e.target.value }
                          setOrgData({ ...orgData, primaryColor: e.target.value, colors: newColors })
                        }}
                        className="input flex-1 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Secondary</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={orgData.secondaryColor}
                        onChange={(e) => {
                          const newColors = { ...orgData.colors, secondary: e.target.value }
                          setOrgData({ ...orgData, secondaryColor: e.target.value, colors: newColors })
                        }}
                        className="w-10 h-8 border border-border rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={orgData.secondaryColor}
                        onChange={(e) => {
                          const newColors = { ...orgData.colors, secondary: e.target.value }
                          setOrgData({ ...orgData, secondaryColor: e.target.value, colors: newColors })
                        }}
                        className="input flex-1 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="p-4 border border-border rounded-lg">
                <p className="text-sm font-medium mb-2">Preview:</p>
                <div
                  className="rounded overflow-hidden"
                  style={{
                    background: orgData.background?.type === 'gradient' && orgData.background.value
                      ? orgData.background.value
                      : orgData.colors?.background || '#f8fafc'
                  }}
                >
                  <div
                    className="p-4 text-center"
                    style={{
                      backgroundColor: orgData.colors?.primary || orgData.primaryColor,
                      fontFamily: orgData.typography?.fontFamily || 'inherit'
                    }}
                  >
                    <p className="font-bold" style={{ color: orgData.colors?.textOnPrimary || 'white' }}>
                      {orgData.name || 'Your Organization'}
                    </p>
                    <p className="text-sm opacity-90" style={{ color: orgData.colors?.textOnPrimary || 'white' }}>
                      Training Dashboard
                    </p>
                  </div>
                  <div className="p-4 flex gap-2">
                    <div
                      className="flex-1 p-3 rounded"
                      style={{ backgroundColor: orgData.colors?.surface || 'white' }}
                    >
                      <div className="h-2 w-16 rounded mb-2" style={{ backgroundColor: orgData.colors?.primary || orgData.primaryColor }} />
                      <div className="h-2 w-24 rounded" style={{ backgroundColor: orgData.colors?.border || '#e5e7eb' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: orgData.colors?.success || '#22c55e' }} />
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: orgData.colors?.error || '#ef4444' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 btn-primary"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <CreditCard className="mx-auto h-12 w-12 text-primary mb-4" />
                <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
                <p className="text-text-secondary">
                  Select a subscription plan that fits your needs.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  {
                    plan: 'basic',
                    name: 'Basic',
                    price: 'R5,000/year',
                    features: ['Quiz & Bingo modules', 'Up to 50 participants', 'Basic analytics', 'Email support']
                  },
                  {
                    plan: 'professional',
                    name: 'Professional',
                    price: 'R14,000/year',
                    features: ['All Basic features', 'Millionaire, Speed Rounds & Document Detective', 'Up to 200 participants', 'Advanced analytics']
                  },
                  {
                    plan: 'enterprise',
                    name: 'Enterprise',
                    price: 'R35,000/year',
                    features: ['All modules included', 'Up to 1000 participants', 'Custom branding', 'Priority support']
                  }
                ].map((planOption) => (
                  <div
                    key={planOption.plan}
                    className="p-4 rounded-lg cursor-pointer transition-all"
                    style={{
                      border: orgData.plan === planOption.plan
                        ? '1px solid var(--primary-color)'
                        : '1px solid var(--border-color)',
                      backgroundColor: orgData.plan === planOption.plan
                        ? 'var(--primary-bg-color, rgba(59, 130, 246, 0.1))'
                        : 'transparent'
                    }}
                    onClick={() => setOrgData({ ...orgData, plan: planOption.plan as any })}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold">{planOption.name}</h3>
                      <span className="font-bold text-primary">{planOption.price}</span>
                    </div>
                    <ul className="text-sm text-text-secondary space-y-1">
                      {planOption.features.map((feature, index) => (
                        <li key={index}>• {feature}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Manual Billing Fields - Platform Admin Only */}
              {isPlatformAdmin() && (
                <div className="border-t border-border pt-6 space-y-4">
                  <h3 className="font-medium text-sm text-text-secondary">
                    Subscription Details (Platform Admin)
                  </h3>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <Calendar size={16} className="inline mr-2" />
                      Subscription Expiry Date
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="date"
                        value={orgData.expiresAt}
                        onChange={(e) => setOrgData({ ...orgData, expiresAt: e.target.value })}
                        className="input flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const oneYearFromNow = new Date()
                          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
                          setOrgData({ ...orgData, expiresAt: oneYearFromNow.toISOString().split('T')[0] })
                        }}
                        className="btn-secondary text-sm"
                      >
                        +1 Year
                      </button>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      Leave empty for trial status. Set after payment received.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <FileText size={16} className="inline mr-2" />
                      Invoice Reference
                    </label>
                    <input
                      type="text"
                      value={orgData.invoiceRef}
                      onChange={(e) => setOrgData({ ...orgData, invoiceRef: e.target.value })}
                      className="input w-full"
                      placeholder="INV-2024-001"
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 btn-primary"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-2">
                  {!firebaseUser ? 'Create Your Account' : 'Set Up First Admin User'}
                </h2>
                <p className="text-text-secondary">
                  {!firebaseUser
                    ? 'Create your account to become the organization owner.'
                    : 'Create the first administrator account for your organization.'
                  }
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {!firebaseUser ? 'Your Full Name' : 'Admin Name'}
                  </label>
                  <input
                    type="text"
                    value={adminUser.displayName}
                    onChange={(e) => setAdminUser({ ...adminUser, displayName: e.target.value })}
                    className="input w-full"
                    placeholder={!firebaseUser ? 'Your full name' : 'John Smith'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {!firebaseUser ? 'Your Email Address' : 'Admin Email'}
                  </label>
                  <input
                    type="email"
                    value={adminUser.email}
                    onChange={(e) => setAdminUser({ ...adminUser, email: e.target.value })}
                    className="input w-full"
                    placeholder={!firebaseUser ? 'your@email.com' : 'admin@company.com'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={adminUser.password}
                    onChange={(e) => setAdminUser({ ...adminUser, password: e.target.value })}
                    className="input w-full"
                    placeholder="••••••••"
                  />
                  <p className="text-sm text-text-secondary mt-1">
                    Must be at least 6 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={adminUser.confirmPassword}
                    onChange={(e) => setAdminUser({ ...adminUser, confirmPassword: e.target.value })}
                    className="input w-full"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateOrganization}
                  disabled={loading ||
                    !adminUser.email ||
                    !adminUser.displayName ||
                    adminUser.password.length < 6 ||
                    adminUser.password !== adminUser.confirmPassword}
                  className="flex-1 btn-primary flex items-center justify-center"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    'Create Organization & Admin'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
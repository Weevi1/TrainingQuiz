import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard, Calendar, Users, Zap, Crown, Shield,
  Check, AlertCircle, CheckCircle, Mail, Phone, MessageCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { OrgLogo } from '../components/OrgLogo'
import { BillingService, PLAN_PRICING, type PlanType } from '../lib/billing'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const BillingManagement: React.FC = () => {
  const navigate = useNavigate()
  const { currentOrganization, hasPermission } = useAuth()

  // Check permissions
  useEffect(() => {
    if (!hasPermission('manage_organization')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate])

  if (!currentOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const currentPlan = currentOrganization.subscription?.plan || 'basic'
  const currentPlanData = PLAN_PRICING[currentPlan as PlanType]
  const statusInfo = BillingService.getStatusMessage(currentOrganization)
  const daysLeft = BillingService.getDaysUntilExpiry(currentOrganization)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <OrgLogo
                logo={currentOrganization?.branding?.logo}
                orgName={currentOrganization?.name}
                size="sm"
              />
              <h1 className="text-xl font-bold text-primary">Subscription & Billing</h1>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Plan Overview */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-6">Your Current Plan</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plan Details */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: currentPlan === 'basic'
                        ? 'var(--primary-color-light, rgba(var(--primary-rgb), 0.1))'
                        : currentPlan === 'professional'
                        ? 'var(--secondary-color-light, rgba(var(--secondary-rgb), 0.1))'
                        : 'var(--warning-color-light, rgba(var(--warning-rgb), 0.1))'
                    }}
                  >
                    {currentPlan === 'basic' ? <Zap style={{ color: 'var(--primary-color)' }} size={28} /> :
                     currentPlan === 'professional' ? <Crown style={{ color: 'var(--secondary-color)' }} size={28} /> :
                     <Shield style={{ color: 'var(--warning-color)' }} size={28} />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold capitalize">{currentPlan} Plan</h3>
                    <p className="text-text-secondary">
                      {BillingService.formatZAR(currentPlanData?.priceZAR || 0)} / year
                    </p>
                  </div>
                </div>

                <div
                  className="px-4 py-2 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: statusInfo.color === 'green'
                      ? 'var(--success-color-light, rgba(var(--success-rgb), 0.1))'
                      : statusInfo.color === 'yellow'
                      ? 'var(--warning-color-light, rgba(var(--warning-rgb), 0.1))'
                      : statusInfo.color === 'orange'
                      ? 'var(--warning-color-light, rgba(var(--warning-rgb), 0.1))'
                      : statusInfo.color === 'red'
                      ? 'var(--error-color-light, rgba(var(--error-rgb), 0.1))'
                      : 'var(--surface-color)',
                    color: statusInfo.color === 'green'
                      ? 'var(--success-color)'
                      : statusInfo.color === 'yellow' || statusInfo.color === 'orange'
                      ? 'var(--warning-color)'
                      : statusInfo.color === 'red'
                      ? 'var(--error-color)'
                      : 'var(--text-color)'
                  }}
                >
                  {statusInfo.message}
                </div>
              </div>

              {/* Plan Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Included Modules</h4>
                  <div className="space-y-2">
                    {(currentOrganization.subscription?.modules || []).map((module) => (
                      <div key={module} className="flex items-center space-x-2 text-sm">
                        <CheckCircle size={18} style={{ color: 'var(--success-color)' }} />
                        <span className="capitalize">{module === 'spotdifference' ? 'Document Detective' : module}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Usage Limits</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Users size={16} className="text-text-secondary" />
                      <span>
                        {currentOrganization.subscription?.limits?.maxParticipants || 0} participants per session
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar size={16} className="text-text-secondary" />
                      <span>
                        {(currentOrganization.subscription?.limits?.maxSessions || 0) === -1
                          ? 'Unlimited sessions'
                          : `${currentOrganization.subscription?.limits?.maxSessions} active sessions`}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users size={16} className="text-text-secondary" />
                      <span>
                        {(currentOrganization.subscription?.limits?.maxTrainers || 0) === -1
                          ? 'Unlimited trainers'
                          : `${currentOrganization.subscription?.limits?.maxTrainers} trainer accounts`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expiry Warning */}
              {daysLeft !== null && daysLeft <= 30 && daysLeft > 0 && (
                <div
                  className="mt-6 border rounded-lg p-4"
                  style={{
                    backgroundColor: 'var(--warning-color-light, rgba(var(--warning-rgb), 0.05))',
                    borderColor: 'var(--warning-color-border, rgba(var(--warning-rgb), 0.2))'
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <AlertCircle style={{ color: 'var(--warning-color)' }} size={24} />
                    <div>
                      <p className="font-medium" style={{ color: 'var(--warning-color)' }}>Subscription Expiring Soon</p>
                      <p className="text-sm" style={{ color: 'var(--warning-color-muted, var(--warning-color))' }}>
                        Your subscription expires in {daysLeft} days. Contact us to renew.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Expired Warning */}
              {(statusInfo.status === 'expired' || (daysLeft !== null && daysLeft <= 0)) && (
                <div
                  className="mt-6 border rounded-lg p-4"
                  style={{
                    backgroundColor: 'var(--error-color-light, rgba(var(--error-rgb), 0.05))',
                    borderColor: 'var(--error-color-border, rgba(var(--error-rgb), 0.2))'
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <AlertCircle style={{ color: 'var(--error-color)' }} size={24} />
                    <div>
                      <p className="font-medium" style={{ color: 'var(--error-color)' }}>Subscription Expired</p>
                      <p className="text-sm" style={{ color: 'var(--error-color-muted, var(--error-color))' }}>
                        Your subscription has expired. Contact us immediately to restore access.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Subscription Summary */}
            <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--surface-color)' }}>
              <h4 className="font-medium mb-4">Subscription Details</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Plan</span>
                  <span className="font-medium capitalize">{currentPlan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Annual Cost</span>
                  <span className="font-medium">
                    {BillingService.formatZAR(currentPlanData?.priceZAR || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status</span>
                  <span
                    className="font-medium"
                    style={{
                      color: statusInfo.color === 'green'
                        ? 'var(--success-color)'
                        : statusInfo.color === 'red'
                        ? 'var(--error-color)'
                        : 'var(--warning-color)'
                    }}
                  >
                    {statusInfo.message}
                  </span>
                </div>
                {currentOrganization.subscription?.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Expires</span>
                    <span className="font-medium">
                      {new Date(currentOrganization.subscription.expiresAt).toLocaleDateString('en-ZA')}
                    </span>
                  </div>
                )}
                {currentOrganization.subscription?.invoiceRef && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Invoice Ref</span>
                    <span className="font-medium">
                      {currentOrganization.subscription.invoiceRef}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Available Plans */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-6">Available Plans</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(PLAN_PRICING).map(([planId, plan]) => {
              const isCurrentPlan = planId === currentPlan
              const isUpgrade = (
                (currentPlan === 'basic' && planId !== 'basic') ||
                (currentPlan === 'professional' && planId === 'enterprise')
              )

              return (
                <div
                  key={planId}
                  className="border-2 rounded-lg p-6 relative"
                  style={{
                    borderColor: isCurrentPlan ? 'var(--primary-color)' : 'var(--border-color)',
                    backgroundColor: isCurrentPlan ? 'var(--primary-color-light, rgba(var(--primary-rgb), 0.05))' : 'transparent'
                  }}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                      >
                        Current Plan
                      </div>
                    </div>
                  )}

                  {planId === 'professional' && !isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <div
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'var(--secondary-color)', color: 'white' }}
                      >
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div
                      className="inline-block p-3 rounded-lg mb-3"
                      style={{
                        backgroundColor: planId === 'basic'
                          ? 'var(--primary-color-light, rgba(var(--primary-rgb), 0.1))'
                          : planId === 'professional'
                          ? 'var(--secondary-color-light, rgba(var(--secondary-rgb), 0.1))'
                          : 'var(--warning-color-light, rgba(var(--warning-rgb), 0.1))'
                      }}
                    >
                      {planId === 'basic' ? <Zap style={{ color: 'var(--primary-color)' }} size={24} /> :
                       planId === 'professional' ? <Crown style={{ color: 'var(--secondary-color)' }} size={24} /> :
                       <Shield style={{ color: 'var(--warning-color)' }} size={24} />}
                    </div>
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="text-2xl font-bold">
                      {BillingService.formatZAR(plan.priceZAR)}
                    </div>
                    <div className="text-text-secondary text-sm">per year</div>
                  </div>

                  <div className="space-y-2 mb-6">
                    {plan.features.slice(0, 6).map((feature, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Check size={16} style={{ color: 'var(--success-color)' }} className="mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    {plan.features.length > 6 && (
                      <div className="text-sm text-text-secondary text-center">
                        +{plan.features.length - 6} more features
                      </div>
                    )}
                  </div>

                  {isCurrentPlan ? (
                    <div
                      className="w-full py-2 px-4 rounded font-medium text-center"
                      style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary-color)' }}
                    >
                      Current Plan
                    </div>
                  ) : isUpgrade ? (
                    <div
                      className="w-full py-2 px-4 rounded font-medium text-center"
                      style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
                    >
                      Contact to Upgrade
                    </div>
                  ) : (
                    <div
                      className="w-full py-2 px-4 rounded font-medium text-center"
                      style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-secondary-color)' }}
                    >
                      Contact to Change
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Contact Section */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(to right, var(--primary-color), var(--primary-color-dark, var(--primary-color)))',
            color: 'white'
          }}
        >
          <div className="text-center py-6">
            <h2 className="text-2xl font-bold mb-2">Need to Upgrade or Renew?</h2>
            <p className="mb-6" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              Contact us to upgrade your plan, renew your subscription, or discuss custom requirements.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <a
                href="mailto:support@trained.fifo.systems"
                className="flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: 'white', color: 'var(--primary-color)' }}
              >
                <Mail size={20} />
                <span>support@trained.fifo.systems</span>
              </a>

              <a
                href="https://wa.me/27825254011"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: 'var(--success-color)', color: 'white' }}
              >
                <MessageCircle size={20} />
                <span>WhatsApp Us</span>
              </a>
            </div>

            <p className="text-sm mt-6" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              We accept EFT payments. Invoices issued upon request.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, ArrowRight, CreditCard, Users, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { BillingService } from '../lib/billing'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const BillingSuccess: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentOrganization } = useAuth()
  const [loading, setLoading] = useState(true)
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)

  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) {
      navigate('/billing')
      return
    }

    // In mock mode, we'll simulate loading the completed subscription
    loadSubscriptionDetails()
  }, [sessionId])

  const loadSubscriptionDetails = async () => {
    setLoading(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // In mock mode, we'll use the current organization's subscription
      if (currentOrganization?.subscription) {
        const planName = currentOrganization.subscription.plan
        const priceData = BillingService.getAllPrices().find(p =>
          p.planName.toLowerCase() === planName
        )

        setSubscriptionDetails({
          planName: planName.charAt(0).toUpperCase() + planName.slice(1),
          amount: priceData?.amount || 0,
          interval: 'month', // Default to monthly
          features: priceData?.features || [],
          modules: currentOrganization.subscription.modules,
          limits: currentOrganization.subscription.limits
        })
      }
    } catch (error) {
      console.error('Error loading subscription details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Confirming your subscription...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div
            className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--success-light-color)' }}
          >
            <CheckCircle style={{ color: 'var(--success-color)' }} size={32} />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">
            Welcome to {subscriptionDetails?.planName} Plan!
          </h1>
          <p className="text-lg text-text-secondary">
            Your subscription has been activated successfully
          </p>
        </div>

        {/* Subscription Details */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-6">Subscription Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-medium mb-2 flex items-center space-x-2">
                <CreditCard size={16} />
                <span>Plan Information</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="font-medium">{subscriptionDetails?.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Billing:</span>
                  <span className="font-medium">
                    {BillingService.formatAmount(subscriptionDetails?.amount || 0)}
                    /{subscriptionDetails?.interval}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-medium" style={{ color: 'var(--success-color)' }}>Active</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2 flex items-center space-x-2">
                <Users size={16} />
                <span>Usage Limits</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Participants:</span>
                  <span className="font-medium">
                    {subscriptionDetails?.limits?.maxParticipants === -1
                      ? 'Unlimited'
                      : subscriptionDetails?.limits?.maxParticipants}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sessions:</span>
                  <span className="font-medium">
                    {subscriptionDetails?.limits?.maxSessions === -1
                      ? 'Unlimited'
                      : subscriptionDetails?.limits?.maxSessions}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trainers:</span>
                  <span className="font-medium">
                    {subscriptionDetails?.limits?.maxTrainers === -1
                      ? 'Unlimited'
                      : subscriptionDetails?.limits?.maxTrainers}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Available Modules */}
          <div className="mb-6">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <Zap size={16} />
              <span>Available Game Modules</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {subscriptionDetails?.modules?.map((module: string) => (
                <div key={module} className="flex items-center space-x-2 text-sm">
                  <CheckCircle size={14} style={{ color: 'var(--success-color)' }} />
                  <span className="capitalize">{module}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Features */}
          <div>
            <h3 className="font-medium mb-3">Plan Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {subscriptionDetails?.features?.map((feature: string, index: number) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--success-color)' }} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">What's Next?</h2>
          <div className="space-y-4">
            <div
              className="flex items-center space-x-3 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--primary-light-color)' }}
            >
              <div
                className="rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: 'var(--primary-color)', color: 'var(--surface-color)' }}
              >1</div>
              <div>
                <h4 className="font-medium">Create Your First Quiz</h4>
                <p className="text-sm text-text-secondary">Build engaging quizzes for your training sessions</p>
              </div>
            </div>

            <div
              className="flex items-center space-x-3 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--success-light-color)' }}
            >
              <div
                className="rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: 'var(--success-color)', color: 'var(--surface-color)' }}
              >2</div>
              <div>
                <h4 className="font-medium">Start a Training Session</h4>
                <p className="text-sm text-text-secondary">Launch live interactive sessions with your participants</p>
              </div>
            </div>

            <div
              className="flex items-center space-x-3 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--accent-light-color)' }}
            >
              <div
                className="rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--surface-color)' }}
              >3</div>
              <div>
                <h4 className="font-medium">Explore Game Modules</h4>
                <p className="text-sm text-text-secondary">Try out all the interactive game formats available in your plan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary flex items-center justify-center space-x-2 flex-1"
          >
            <span>Go to Dashboard</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => navigate('/quizzes')}
            className="btn-secondary flex items-center justify-center space-x-2 flex-1"
          >
            <span>Create First Quiz</span>
          </button>

          <button
            onClick={() => navigate('/billing')}
            className="btn-secondary flex items-center justify-center space-x-2 flex-1"
          >
            <span>Manage Billing</span>
          </button>
        </div>

        {/* Help Section */}
        <div
          className="text-center mt-8 p-6 rounded-lg"
          style={{ backgroundColor: 'var(--background-color)' }}
        >
          <h3 className="font-medium mb-2">Need Help Getting Started?</h3>
          <p className="text-sm text-text-secondary mb-4">
            Our team is here to help you make the most of your new subscription
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button className="text-primary hover:underline text-sm">
              View Documentation
            </button>
            <span className="hidden sm:inline text-text-secondary">•</span>
            <button className="text-primary hover:underline text-sm">
              Contact Support
            </button>
            <span className="hidden sm:inline text-text-secondary">•</span>
            <button className="text-primary hover:underline text-sm">
              Schedule Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
// Manual billing service for South Africa (no Stripe)
// Subscriptions are managed manually via invoicing

import type { Organization } from './firestore'

// Plan pricing (annual, in ZAR)
export const PLAN_PRICING = {
  basic: {
    name: 'Basic',
    priceZAR: 5000,       // R5,000/year
    priceUSD: 290,        // ~$290/year (for reference)
    interval: 'year' as const,
    modules: ['quiz', 'bingo'],
    limits: {
      maxParticipants: 50,
      maxSessions: 10,
      maxTrainers: 3
    },
    features: [
      'Interactive Quiz Module',
      'Training Bingo',
      'Up to 50 participants per session',
      '10 active sessions',
      '3 trainer accounts',
      'Basic analytics',
      'Email support'
    ]
  },
  professional: {
    name: 'Professional',
    priceZAR: 14000,      // R14,000/year
    priceUSD: 790,        // ~$790/year (for reference)
    interval: 'year' as const,
    modules: ['quiz', 'bingo', 'millionaire', 'speedround', 'spotdifference'],
    limits: {
      maxParticipants: 200,
      maxSessions: 50,
      maxTrainers: 10
    },
    features: [
      'All Basic features',
      'Who Wants to be a Millionaire',
      'Speed Rounds',
      'Document Detective (Compliance)',
      'Up to 200 participants per session',
      '50 active sessions',
      '10 trainer accounts',
      'Advanced analytics',
      'Priority support',
      'Custom branding'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    priceZAR: 35000,      // R35,000/year
    priceUSD: 1990,       // ~$1990/year (for reference)
    interval: 'year' as const,
    modules: ['quiz', 'bingo', 'millionaire', 'speedround', 'spotdifference'],
    limits: {
      maxParticipants: 1000,
      maxSessions: -1,    // unlimited
      maxTrainers: -1     // unlimited
    },
    features: [
      'All Professional features',
      'Up to 1000 participants per session',
      'Unlimited sessions',
      'Unlimited trainers',
      'Premium analytics & reports',
      'Dedicated account manager',
      'Custom integrations',
      'SLA support',
      'On-site training available'
    ]
  }
} as const

export type PlanType = keyof typeof PLAN_PRICING

// Helper functions
export class BillingService {
  /**
   * Format currency for display
   */
  static formatZAR(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  /**
   * Get plan details
   */
  static getPlan(plan: PlanType) {
    return PLAN_PRICING[plan]
  }

  /**
   * Get all plans
   */
  static getAllPlans() {
    return Object.entries(PLAN_PRICING).map(([key, value]) => ({
      id: key as PlanType,
      ...value
    }))
  }

  /**
   * Check if subscription is expired
   */
  static isExpired(organization: Organization): boolean {
    if (!organization.subscription?.expiresAt) {
      return false // No expiry set = not expired (trial/legacy)
    }
    return new Date() > new Date(organization.subscription.expiresAt)
  }

  /**
   * Get days until expiry
   */
  static getDaysUntilExpiry(organization: Organization): number | null {
    if (!organization.subscription?.expiresAt) {
      return null
    }
    const expiresAt = new Date(organization.subscription.expiresAt)
    const now = new Date()
    const diffTime = expiresAt.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Check if subscription is expiring soon (within 30 days)
   */
  static isExpiringSoon(organization: Organization): boolean {
    const days = this.getDaysUntilExpiry(organization)
    return days !== null && days > 0 && days <= 30
  }

  /**
   * Get subscription status message
   */
  static getStatusMessage(organization: Organization): { status: string; message: string; color: string } {
    const subscription = organization.subscription

    if (!subscription) {
      return { status: 'none', message: 'No subscription', color: 'gray' }
    }

    if (subscription.status === 'suspended') {
      return { status: 'suspended', message: 'Account suspended', color: 'red' }
    }

    if (subscription.status === 'expired' || this.isExpired(organization)) {
      return { status: 'expired', message: 'Subscription expired', color: 'red' }
    }

    if (subscription.status === 'trial') {
      return { status: 'trial', message: 'Trial period', color: 'yellow' }
    }

    if (this.isExpiringSoon(organization)) {
      const days = this.getDaysUntilExpiry(organization)
      return { status: 'expiring', message: `Expires in ${days} days`, color: 'orange' }
    }

    return { status: 'active', message: 'Active', color: 'green' }
  }

  /**
   * Calculate expiry date (1 year from now)
   */
  static calculateExpiryDate(fromDate?: Date): Date {
    const start = fromDate || new Date()
    const expiry = new Date(start)
    expiry.setFullYear(expiry.getFullYear() + 1)
    return expiry
  }
}

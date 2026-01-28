import type { Organization, UserOrgRole } from './firestore'

// Available modules and their dependencies
export const AVAILABLE_MODULES = {
  quiz: {
    name: 'Interactive Quiz',
    description: 'Real-time quizzes with scoring and analytics',
    requiredPlan: 'basic'
  },
  millionaire: {
    name: 'Who Wants to be a Millionaire',
    description: 'Game show style questions with lifelines',
    requiredPlan: 'professional'
  },
  bingo: {
    name: 'Training Bingo',
    description: 'Customizable bingo cards for engagement',
    requiredPlan: 'basic'
  },
  speedround: {
    name: 'Speed Round',
    description: 'Fast-paced rapid-fire questions',
    requiredPlan: 'professional'
  },
  spotdifference: {
    name: 'Document Detective',
    description: 'Find compliance issues in contracts and documents',
    requiredPlan: 'professional'
  }
} as const

export type ModuleType = keyof typeof AVAILABLE_MODULES

// Subscription plans and their module access
export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic',
    modules: ['quiz', 'bingo'] as ModuleType[],
    limits: {
      maxParticipants: 50,
      maxSessions: 10,
      maxTrainers: 3
    }
  },
  professional: {
    name: 'Professional',
    modules: ['quiz', 'bingo', 'millionaire', 'speedround', 'spotdifference'] as ModuleType[],
    limits: {
      maxParticipants: 200,
      maxSessions: 50,
      maxTrainers: 10
    }
  },
  enterprise: {
    name: 'Enterprise',
    modules: ['quiz', 'bingo', 'millionaire', 'speedround', 'spotdifference'] as ModuleType[],
    limits: {
      maxParticipants: 1000,
      maxSessions: -1, // unlimited
      maxTrainers: -1   // unlimited
    }
  }
} as const

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS

// Permission types for organizational roles
export const ROLE_PERMISSIONS = {
  ORG_OWNER: [
    'manage_organization',
    'manage_billing',
    'manage_users',
    'manage_content',
    'create_sessions',
    'view_analytics',
    'manage_branding'
  ],
  ORG_ADMIN: [
    'manage_users',
    'manage_content',
    'create_sessions',
    'view_analytics'
  ],
  TRAINER: [
    'create_sessions',
    'manage_own_content',
    'view_own_analytics'
  ],
  PARTICIPANT: [
    'join_sessions'
  ]
} as const

export type Permission = typeof ROLE_PERMISSIONS[keyof typeof ROLE_PERMISSIONS][number]

// Permission checking utilities
export class PermissionService {
  /**
   * Check if subscription has expired based on expiresAt date
   */
  static isSubscriptionExpired(organization: Organization): boolean {
    if (!organization.subscription?.expiresAt) {
      return false // No expiry set = not expired (trial/legacy)
    }
    return new Date() > new Date(organization.subscription.expiresAt)
  }

  /**
   * Check if an organization has access to a specific module
   */
  static hasModuleAccess(organization: Organization, module: ModuleType): boolean {
    if (!organization.subscription) return false

    // Check subscription status
    const status = organization.subscription.status
    if (status === 'suspended' || status === 'expired') return false

    // Check if subscription has expired by date
    if (this.isSubscriptionExpired(organization)) return false

    // Allow access for active and trial subscriptions
    if (status !== 'active' && status !== 'trial') return false

    // Check if module is included in subscription
    return organization.subscription.modules.includes(module)
  }

  /**
   * Get available modules for an organization
   */
  static getAvailableModules(organization: Organization): ModuleType[] {
    if (!organization.subscription ||
        (organization.subscription.status !== 'active' && organization.subscription.status !== 'trial')) {
      return []
    }

    return organization.subscription.modules.filter((module): module is ModuleType =>
      typeof module === 'string' && module in AVAILABLE_MODULES && this.hasModuleAccess(organization, module as ModuleType)
    )
  }

  /**
   * Check if user has a specific permission in an organization
   */
  static hasPermission(
    userRole: UserOrgRole | undefined,
    permission: Permission
  ): boolean {
    if (!userRole) return false

    const rolePermissions = ROLE_PERMISSIONS[userRole.role] || []
    return rolePermissions.includes(permission)
  }

  /**
   * Check subscription limits
   */
  static checkSubscriptionLimit(
    organization: Organization,
    limitType: 'maxParticipants' | 'maxSessions' | 'maxTrainers',
    currentCount: number
  ): { allowed: boolean; limit: number; message?: string } {
    if (!organization.subscription) {
      return { allowed: false, limit: 0, message: 'No active subscription' }
    }

    const plan = SUBSCRIPTION_PLANS[organization.subscription.plan as SubscriptionPlan]
    if (!plan) {
      return { allowed: false, limit: 0, message: 'Invalid subscription plan' }
    }

    const limit = plan.limits[limitType]

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1 }
    }

    const allowed = currentCount < limit
    const message = allowed ? undefined : `Limit reached: ${currentCount}/${limit}`

    return { allowed, limit, message }
  }

  /**
   * Get upgrade suggestions for accessing a module
   */
  static getUpgradeSuggestion(
    currentPlan: SubscriptionPlan,
    desiredModule: ModuleType
  ): { needsUpgrade: boolean; suggestedPlan?: SubscriptionPlan; message: string } {
    const currentModules = SUBSCRIPTION_PLANS[currentPlan].modules

    if (currentModules.includes(desiredModule)) {
      return { needsUpgrade: false, message: 'Module already available' }
    }

    // Find the minimum plan that includes this module
    const availablePlans = Object.entries(SUBSCRIPTION_PLANS) as [SubscriptionPlan, typeof SUBSCRIPTION_PLANS[SubscriptionPlan]][]

    for (const [planName, planDetails] of availablePlans) {
      if (planDetails.modules.includes(desiredModule)) {
        return {
          needsUpgrade: true,
          suggestedPlan: planName,
          message: `Upgrade to ${planDetails.name} plan to access ${AVAILABLE_MODULES[desiredModule].name}`
        }
      }
    }

    return { needsUpgrade: true, message: 'Module not available in any plan' }
  }

  /**
   * Validate session creation against subscription limits
   */
  static validateSessionCreation(
    organization: Organization,
    gameType: ModuleType,
    currentSessionCount: number,
    expectedParticipants: number
  ): { allowed: boolean; errors: string[] } {
    const errors: string[] = []

    // Check module access
    if (!this.hasModuleAccess(organization, gameType)) {
      const suggestion = this.getUpgradeSuggestion(
        organization.subscription.plan as SubscriptionPlan,
        gameType
      )
      errors.push(suggestion.message)
    }

    // Check session limit
    const sessionLimit = this.checkSubscriptionLimit(organization, 'maxSessions', currentSessionCount)
    if (!sessionLimit.allowed) {
      errors.push(sessionLimit.message || 'Session limit exceeded')
    }

    // Check participant limit
    const participantLimit = this.checkSubscriptionLimit(organization, 'maxParticipants', expectedParticipants)
    if (!participantLimit.allowed) {
      errors.push(participantLimit.message || 'Participant limit exceeded')
    }

    return {
      allowed: errors.length === 0,
      errors
    }
  }
}

// Hook for easier use in React components
export const usePermissions = (organization?: Organization, userRole?: UserOrgRole) => {
  return {
    hasModuleAccess: (module: ModuleType) =>
      organization ? PermissionService.hasModuleAccess(organization, module) : false,

    hasPermission: (permission: Permission) =>
      PermissionService.hasPermission(userRole, permission),

    getAvailableModules: () =>
      organization ? PermissionService.getAvailableModules(organization) : [],

    checkLimit: (limitType: 'maxParticipants' | 'maxSessions' | 'maxTrainers', currentCount: number) =>
      organization ? PermissionService.checkSubscriptionLimit(organization, limitType, currentCount) :
      { allowed: false, limit: 0, message: 'No organization' },

    validateSessionCreation: (gameType: ModuleType, currentSessionCount: number, expectedParticipants: number) =>
      organization ? PermissionService.validateSessionCreation(organization, gameType, currentSessionCount, expectedParticipants) :
      { allowed: false, errors: ['No organization selected'] }
  }
}
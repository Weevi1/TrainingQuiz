// Multi-tenant authentication context
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User as FirebaseUser } from 'firebase/auth'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { FirestoreService } from '../lib/firestore'
import type { User, Organization, UserOrgRole } from '../lib/firestore'
import { PermissionService, type Permission, type ModuleType } from '../lib/permissions'

interface AuthContextType {
  // Authentication state
  firebaseUser: FirebaseUser | null
  user: User | null
  loading: boolean
  organizationsLoading: boolean

  // Current organization context
  currentOrganization: Organization | null
  userRole: string | null
  availableOrganizations: Array<{ orgId: string; role: string; orgName: string }>

  // Authentication methods
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>

  // Organization methods
  switchOrganization: (orgId: string) => Promise<void>
  createOrganization: (orgData: Partial<Organization>) => Promise<string>
  joinOrganization: (orgId: string, role: string) => Promise<void>

  // Helper methods
  hasPermission: (permission: Permission) => boolean
  hasModuleAccess: (module: ModuleType) => boolean
  isPlatformAdmin: () => boolean
  getCurrentUserRole: () => UserOrgRole | undefined
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [availableOrganizations, setAvailableOrganizations] = useState<Array<{ orgId: string; role: string; orgName: string }>>([])
  const [loading, setLoading] = useState(true)
  const [organizationsLoading, setOrganizationsLoading] = useState(true)

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser)
      setOrganizationsLoading(true)

      if (firebaseUser) {
        // Load user data from Firestore
        try {
          // First try to get user from Platform Admin collection
          let userData = await FirestoreService.getUser(firebaseUser.uid)

          // If not found in Platform Admin collection, search organization collections
          if (!userData) {
            const userResult = await FirestoreService.findUserInAnyOrganization(firebaseUser.uid)
            if (userResult) {
              userData = userResult.user
              console.log(`Found user in organization: ${userResult.orgId}`)
            }
          }

          if (userData) {
            // Set user first, then load organizations
            setUser(userData)
            // Load organizations and wait for completion
            try {
              await loadUserOrganizations(userData)
            } catch (orgError) {
              console.warn('Error loading organizations, continuing without org selection:', orgError)
              // Continue without organization selection - user can select manually
            }
          } else {
            // User not found - this is expected for newly created organization users
            // Don't auto-create user profiles here - they should be created during org setup
            console.log('User not found in any collection - waiting for organization setup to complete')
            setUser(null)
          }
        } catch (error) {
          console.error('Error loading user data:', error)
        }
      } else {
        // User is signed out
        setUser(null)
        setCurrentOrganization(null)
        setUserRole(null)
        setAvailableOrganizations([])
      }

      // Mark loading as complete
      setOrganizationsLoading(false)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const loadUserOrganizations = async (userData: User) => {
    if (!userData.organizations) {
      setAvailableOrganizations([])
      return
    }

    const orgPromises = Object.entries(userData.organizations).map(async ([orgId, orgRole]) => {
      try {
        const org = await FirestoreService.getOrganization(orgId)
        return {
          orgId,
          role: orgRole.role,
          orgName: org?.name || 'Unknown Organization'
        }
      } catch (error) {
        console.error(`Error loading organization ${orgId}:`, error)
        return null
      }
    })

    const orgs = (await Promise.all(orgPromises)).filter(Boolean) as Array<{ orgId: string; role: string; orgName: string }>
    setAvailableOrganizations(orgs)

    // Auto-select first organization if none selected (but not for Platform Admins)
    if (orgs.length > 0 && !currentOrganization && userData.platformRole !== 'PLATFORM_ADMIN') {
      console.log('Auto-switching to first organization:', orgs[0].orgId)
      try {
        // Pass userData directly to avoid race condition with state update
        await switchOrganization(orgs[0].orgId, userData)
      } catch (error) {
        console.warn('Failed to auto-switch to organization:', error)
        // Don't throw - just continue without selecting an organization
        // User can manually select one from the dashboard
      }
    } else if (userData.platformRole === 'PLATFORM_ADMIN') {
      console.log('Platform Admin detected - skipping auto-organization selection')
    }
  }

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const register = async (email: string, password: string, displayName: string): Promise<void> => {
    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(userCredential.user, { displayName })

      // Create user document in Firestore (global users collection for new registrations)
      await FirestoreService.createUser(userCredential.user.uid, {
        email: email,
        displayName: displayName,
        organizations: {}
      })
      console.log('User profile created in Firestore')
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const logout = async (): Promise<void> => {
    await signOut(auth)
  }

  const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email)
  }

  const switchOrganization = async (orgId: string, userToCheck?: User): Promise<void> => {
    const activeUser = userToCheck || user
    console.log('Attempting to switch to organization:', orgId)
    console.log('Current user:', activeUser)
    console.log('User organizations:', activeUser?.organizations)

    if (!activeUser?.organizations?.[orgId]) {
      console.error('Access check failed - user does not have access to org:', orgId)
      throw new Error('User does not have access to this organization')
    }

    try {
      const org = await FirestoreService.getOrganization(orgId)
      if (!org) {
        throw new Error('Organization not found')
      }

      setCurrentOrganization(org)
      setUserRole(activeUser.organizations[orgId].role)

      // Store current org in localStorage for persistence
      localStorage.setItem('currentOrganizationId', orgId)
    } catch (error) {
      console.error('Error switching organization:', error)
      throw error
    }
  }

  const createOrganization = async (
    orgData: Partial<Organization>,
    adminUserData?: { email: string; displayName: string; password: string }
  ): Promise<string> => {
    console.log('Creating organization with data:', orgData)
    if (!firebaseUser) {
      throw new Error('User must be authenticated to create an organization')
    }

    try {
      // Create organization
      console.log('Calling FirestoreService.createOrganization...')
      const orgId = await FirestoreService.createOrganization({
        ...orgData,
        subscription: {
          plan: 'basic',
          status: 'active',
          modules: ['quiz', 'bingo'],
          limits: {
            maxParticipants: 50,
            maxSessions: -1,
            maxTrainers: 3
          },
          ...orgData.subscription
        },
        branding: {
          primaryColor: '#3b82f6',
          secondaryColor: '#1e40af',
          theme: 'corporate',
          ...orgData.branding
        },
        settings: {
          defaultTimeZone: 'UTC',
          emailNotifications: true,
          ssoEnabled: false,
          ...orgData.settings
        }
      })

      // Handle user creation and organization ownership
      if (adminUserData && user?.platformRole === 'PLATFORM_ADMIN') {
        // Platform Admin creating org for a client - create new user
        console.log('Platform Admin creating organization for client, creating new user...')

        // Store current Platform Admin credentials to restore session
        const platformAdminEmail = firebaseUser?.email
        if (!platformAdminEmail) {
          throw new Error('Platform Admin email not found')
        }

        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            adminUserData.email,
            adminUserData.password
          )
          await updateProfile(userCredential.user, {
            displayName: adminUserData.displayName
          })

          // Create user document in organization-scoped collection
          await FirestoreService.createUser(userCredential.user.uid, {
            email: adminUserData.email,
            displayName: adminUserData.displayName,
            // Note: platformRole is omitted for regular users (not platform admins)
            organizations: {
              [orgId]: {
                role: 'ORG_OWNER',
                joinedAt: new Date(),
                permissions: getRolePermissions('ORG_OWNER')
              }
            }
          }, orgId) // Pass orgId to store in organizations/{orgId}/users/

          console.log('Client user created and added as organization owner')

          // Sign out the new client user and restore Platform Admin session
          await signOut(auth)
          console.log('Client user signed out, Platform Admin needs to sign back in')

          // Note: Platform Admin will need to sign back in to continue
          // This ensures proper session management and security
        } catch (error) {
          console.error('Error creating client user:', error)
          throw new Error('Failed to create client user account')
        }
      } else {
        // Current user (Platform Admin) becomes organization owner
        console.log('Adding current user as organization owner...')
        const updatedUser = await joinOrganization(orgId, 'ORG_OWNER')
        console.log('User added as organization owner successfully')

        // Only switch to the organization if the user is not a Platform Admin
        if (user?.platformRole !== 'PLATFORM_ADMIN') {
          console.log('Switching to new organization...')
          await switchOrganization(orgId, updatedUser)
          console.log('Successfully switched to new organization')
        } else {
          console.log('Platform Admin - staying in admin view, not switching to organization')
        }
      }

      return orgId
    } catch (error) {
      console.error('Error creating organization:', error)
      throw error
    }
  }

  const joinOrganization = async (orgId: string, role: string): Promise<User> => {
    if (!firebaseUser || !user) {
      throw new Error('User must be authenticated to join an organization')
    }

    try {
      console.log('Joining organization with role:', role)
      const permissions = getRolePermissions(role)
      console.log('Role permissions:', permissions)

      // Update user's organization memberships
      const updatedOrganizations = {
        ...user.organizations,
        [orgId]: {
          role: role as 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER' | 'PARTICIPANT',
          joinedAt: new Date(),
          permissions: permissions
        }
      }

      console.log('Updated organizations object:', updatedOrganizations)

      await FirestoreService.updateUser(firebaseUser.uid, {
        organizations: updatedOrganizations
      })

      // Update local state immediately with the new organization
      const updatedUser = {
        ...user,
        organizations: updatedOrganizations
      }
      setUser(updatedUser)

      // Also reload the organizations list for the UI
      await loadUserOrganizations(updatedUser)

      return updatedUser
    } catch (error) {
      console.error('Error joining organization:', error)
      throw error
    }
  }

  const getRolePermissions = (role: string): string[] => {
    switch (role) {
      case 'ORG_OWNER':
        return [
          'manage_organization',
          'manage_billing',
          'manage_users',
          'manage_content',
          'create_sessions',
          'view_analytics',
          'manage_branding'
        ]
      case 'ORG_ADMIN':
        return [
          'manage_users',
          'manage_content',
          'create_sessions',
          'view_analytics'
        ]
      case 'TRAINER':
        return [
          'manage_own_content',
          'create_sessions',
          'view_own_analytics'
        ]
      case 'PARTICIPANT':
        return [
          'join_sessions'
        ]
      default:
        return ['join_sessions']
    }
  }

  const hasPermission = (permission: Permission): boolean => {
    if (!user || !currentOrganization || !userRole) return false

    const userOrgRole = user.organizations[currentOrganization.id]
    return PermissionService.hasPermission(userOrgRole, permission)
  }

  const hasModuleAccess = (module: ModuleType): boolean => {
    if (!currentOrganization) return false
    return PermissionService.hasModuleAccess(currentOrganization, module)
  }

  const getCurrentUserRole = (): UserOrgRole | undefined => {
    if (!user || !currentOrganization) return undefined
    return user.organizations[currentOrganization.id]
  }

  const isPlatformAdmin = (): boolean => {
    return user?.platformRole === 'PLATFORM_ADMIN'
  }

  const value: AuthContextType = {
    firebaseUser,
    user,
    loading,
    organizationsLoading,
    currentOrganization,
    userRole,
    availableOrganizations,
    login,
    register,
    logout,
    resetPassword,
    switchOrganization,
    createOrganization,
    joinOrganization,
    hasPermission,
    hasModuleAccess,
    isPlatformAdmin,
    getCurrentUserRole
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from './LoadingSpinner'
import { type Permission } from '../lib/permissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: Permission
  requireOrganization?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requireOrganization = false
}) => {
  const { firebaseUser, user, currentOrganization, hasPermission, loading, organizationsLoading } = useAuth()

  const isPlatformAdmin = user?.platformRole === 'PLATFORM_ADMIN'
  const userHasOrgs = user?.organizations && Object.keys(user.organizations).length > 0

  // Show spinner while: auth loading, orgs loading, OR user exists but no org selected yet (unless platform admin)
  const stillLoading = loading || organizationsLoading || (user && !currentOrganization && !isPlatformAdmin)

  if (stillLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-color)' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If user has no organizations, redirect to setup (handled here, not in Dashboard)
  if (user && !currentOrganization && !userHasOrgs && !isPlatformAdmin) {
    return <Navigate to="/setup" replace />
  }

  // Redirect to login if not authenticated
  if (!firebaseUser || !user) {
    return <Navigate to="/login" replace />
  }

  // Check if organization is required but not selected
  if (requireOrganization && !currentOrganization) {
    return <Navigate to="/setup" replace />
  }

  // Check if specific permission is required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--error-color, #dc2626)' }}>Access Denied</h1>
          <p className="text-text-secondary">
            You don't have permission to access this resource.
          </p>
          <p className="text-sm text-text-secondary mt-2">
            Required permission: {requiredPermission}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
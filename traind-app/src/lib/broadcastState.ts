// Instant-bootstrap for popup windows via localStorage
// Parent writes auth state before window.open().
// Popup reads it synchronously during AuthProvider initialization (before first render).
// This lets ProtectedRoute pass immediately — no loading spinner, no redirect.
// Uses localStorage (shared same-origin) instead of sessionStorage (per-tab).

import type { User, Organization } from './firestore'

const STORAGE_KEY = 'traind-auth-bootstrap'

export interface AuthBootstrapPayload {
  user: User
  currentOrganization: Organization
  userRole: string
  availableOrganizations: Array<{ orgId: string; role: string; orgName: string }>
}

/**
 * Write auth state to localStorage before opening the popup.
 * Includes a timestamp so stale data (>30s) is ignored.
 */
export function sendAuthBootstrap(data: AuthBootstrapPayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, _ts: Date.now() }))
  } catch {}
}

/**
 * Read bootstrap data synchronously. Returns null if not available or stale.
 * Called during AuthProvider state initialization (not in an effect).
 * Only consumed in popup windows (window.opener check).
 */
export function readAuthBootstrap(): AuthBootstrapPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    // Ignore stale data (older than 30 seconds)
    if (Date.now() - (data._ts || 0) > 30000) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    // Clean up so it's not reused on refresh
    localStorage.removeItem(STORAGE_KEY)
    const { _ts, ...payload } = data
    return payload as AuthBootstrapPayload
  } catch {
    return null
  }
}

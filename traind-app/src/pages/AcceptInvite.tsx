import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type Invitation } from '../lib/firestore'
import { serverTimestamp } from 'firebase/firestore'
import { Loader2, AlertCircle, CheckCircle, Mail, LogOut } from 'lucide-react'

export const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { firebaseUser, user, login, register, logout, joinOrganization, loading: authLoading } = useAuth()

  const token = searchParams.get('token')
  const orgId = searchParams.get('org')

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  // Load invitation by token
  useEffect(() => {
    if (!token || !orgId) {
      setInviteError('Invalid invitation link. Missing token or organization.')
      setLoadingInvite(false)
      return
    }

    const loadInvitation = async () => {
      try {
        const inv = await FirestoreService.getInvitationByToken(orgId, token)
        if (!inv) {
          setInviteError('Invitation not found. It may have been revoked or the link is invalid.')
        } else if (inv.status === 'accepted') {
          setInviteError('This invitation has already been accepted.')
        } else if (inv.status === 'revoked') {
          setInviteError('This invitation has been revoked. Please ask your administrator for a new one.')
        } else if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
          setInviteError('This invitation has expired. Please ask your administrator to send a new one.')
        } else {
          setInvitation(inv)
        }
      } catch (err) {
        console.error('Error loading invitation:', err)
        setInviteError('Failed to load invitation. Please try again.')
      } finally {
        setLoadingInvite(false)
      }
    }

    loadInvitation()
  }, [token, orgId])

  const handleAccept = async () => {
    if (!invitation || !orgId || !firebaseUser || !user) return

    // Email match check
    if (firebaseUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setAuthError(
        `This invitation was sent to ${invitation.email}. Please sign in with that email address.`
      )
      return
    }

    // Already a member check
    if (user.organizations?.[orgId]) {
      setAccepted(true)
      setTimeout(() => navigate('/dashboard'), 1500)
      return
    }

    setAccepting(true)
    setAuthError(null)

    try {
      // Re-verify invitation is still pending
      const freshInvite = await FirestoreService.getInvitationByToken(orgId, invitation.token)
      if (!freshInvite || freshInvite.status !== 'pending') {
        setAuthError('This invitation is no longer available.')
        setAccepting(false)
        return
      }

      // Join the organization (updates global user doc)
      await joinOrganization(orgId, invitation.role)

      // Also create org-scoped user doc so team list queries work
      await FirestoreService.createUser(firebaseUser.uid, {
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || user.displayName || '',
        organizations: {
          ...user.organizations,
          [orgId]: {
            role: invitation.role as any,
            joinedAt: new Date(),
            permissions: []
          }
        }
      }, orgId)

      // Mark invitation as accepted
      await FirestoreService.updateInvitation(orgId, invitation.id, {
        status: 'accepted',
        acceptedAt: serverTimestamp() as any,
        acceptedByUserId: firebaseUser.uid
      })

      setAccepted(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      setAuthError(err.message || 'Failed to accept invitation. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setAuthError(null)

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (!displayName.trim()) {
          setAuthError('Please enter your name.')
          setSubmitting(false)
          return
        }
        await register(email, password, displayName.trim())
      }
      // After auth, the useEffect watching firebaseUser will trigger accept
    } catch (err: any) {
      console.error('Auth error:', err)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password.')
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Try signing in instead.')
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password must be at least 6 characters.')
      } else {
        setAuthError(err.message || 'Authentication failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-accept after login/register if invitation is loaded
  useEffect(() => {
    if (firebaseUser && user && invitation && !accepted && !accepting) {
      handleAccept()
    }
  }, [firebaseUser, user, invitation])

  const roleName = invitation?.role === 'ORG_ADMIN' ? 'Admin' : 'Trainer'

  // Loading states
  if (authLoading || loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <Loader2 size={32} className="animate-spin text-sky-400" />
      </div>
    )
  }

  // Invalid/expired invitation
  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a' }}>
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-800/80 rounded-2xl p-8 border border-slate-700">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="text-xl font-semibold text-white mb-2">Invitation Unavailable</h1>
            <p className="text-slate-400 mb-6">{inviteError}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 rounded-lg font-medium bg-sky-500 text-white hover:bg-sky-600 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Accepted successfully
  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a' }}>
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-800/80 rounded-2xl p-8 border border-slate-700">
            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-400" />
            <h1 className="text-xl font-semibold text-white mb-2">Welcome to {invitation?.organizationName}!</h1>
            <p className="text-slate-400">Redirecting to your dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0f172a' }}>
      <div className="w-full max-w-md">
        <div className="bg-slate-800/80 rounded-2xl p-8 border border-slate-700">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-wider text-white mb-2">TRAINED</h1>
            <p className="text-slate-400">You've been invited to join</p>
            <p className="text-xl font-semibold text-white mt-1">{invitation?.organizationName}</p>
            <p className="text-sm text-slate-500 mt-1">
              as a <span className="text-sky-400 font-medium">{roleName}</span>
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{authError}</p>
            </div>
          )}

          {/* User is logged in — show accept button */}
          {firebaseUser && user ? (
            <div className="space-y-4">
              {accepting ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={24} className="animate-spin text-sky-400 mr-2" />
                  <span className="text-slate-400">Joining organization...</span>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
                    <p className="text-sm text-slate-400 mb-1">Signed in as</p>
                    <p className="text-white font-medium">{user.displayName || firebaseUser.email}</p>
                    <p className="text-sm text-slate-500">{firebaseUser.email}</p>
                  </div>

                  <button
                    onClick={handleAccept}
                    className="w-full py-3 rounded-lg font-semibold bg-sky-500 text-white hover:bg-sky-600 transition-colors"
                  >
                    Accept Invitation
                  </button>

                  <button
                    onClick={logout}
                    className="w-full py-2.5 rounded-lg font-medium text-slate-400 hover:text-white transition-colors flex items-center justify-center space-x-2"
                  >
                    <LogOut size={16} />
                    <span>Sign in with a different account</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            /* User not logged in — show login/register form */
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={invitation?.email || 'your@email.com'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Create a password (min 6 chars)' : 'Your password'}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg font-semibold bg-sky-500 text-white hover:bg-sky-600 transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin mx-auto" />
                ) : mode === 'login' ? (
                  'Sign In & Accept'
                ) : (
                  'Create Account & Accept'
                )}
              </button>

              <p className="text-center text-sm text-slate-500">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('register'); setAuthError(null) }}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setAuthError(null) }}
                      className="text-sky-400 hover:text-sky-300"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Invited by {invitation?.invitedByName}
        </p>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

export const Login: React.FC = () => {
  const { firebaseUser, login, register, resetPassword, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  if (firebaseUser && !loading) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      if (isForgotPassword) {
        await resetPassword(email)
        setSuccessMessage('Password reset email sent! Check your inbox.')
        setIsForgotPassword(false)
      } else if (isRegister) {
        if (!displayName.trim()) {
          throw new Error('Display name is required')
        }
        await register(email, password, displayName)
      } else {
        await login(email, password)
      }
    } catch (error: any) {
      console.error('Login error:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      setError(`Firebase: Error (${error.code || 'unknown'}).`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">
              Trained
            </h1>
            <p className="text-text-secondary">
              Interactive Post-Training Engagement
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegister && !isForgotPassword && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium mb-2">
                  Full Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="Enter your email"
                required
              />
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
              </div>
            )}

            {successMessage && (
              <div
                className="p-3 border rounded-md"
                style={{
                  backgroundColor: 'var(--success-light-color, #dcfce7)',
                  borderColor: 'var(--success-color, #22c55e)'
                }}
              >
                <p className="text-sm" style={{ color: 'var(--success-color, #22c55e)' }}>{successMessage}</p>
              </div>
            )}

            {error && (
              <div
                className="p-3 border rounded-md"
                style={{
                  backgroundColor: 'var(--error-bg-color, #fef2f2)',
                  borderColor: 'var(--error-border-color, #fecaca)'
                }}
              >
                <p className="text-sm" style={{ color: 'var(--error-color, #dc2626)' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary flex items-center justify-center"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" />
              ) : (
                isForgotPassword ? 'Send Reset Link' : isRegister ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {!isForgotPassword && !isRegister && (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true)
                  setError('')
                  setSuccessMessage('')
                }}
                className="text-primary hover:underline text-sm block w-full"
              >
                Forgot your password?
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isForgotPassword) {
                  setIsForgotPassword(false)
                } else {
                  setIsRegister(!isRegister)
                }
                setError('')
                setSuccessMessage('')
                setDisplayName('')
              }}
              className="text-primary hover:underline text-sm"
            >
              {isForgotPassword
                ? 'Back to Sign In'
                : isRegister
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"
              }
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">New to Trained?</h3>
              <p className="text-sm text-text-secondary mb-4">
                Start your free trial and create your organization today
              </p>
              <Link
                to="/register"
                className="btn-primary inline-flex items-center"
              >
                Start Free Trial
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-center text-sm text-text-secondary">
              Need help? Contact support at{' '}
              <a href="mailto:support@trained.fifo.systems" className="text-primary hover:underline">
                support@trained.fifo.systems
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
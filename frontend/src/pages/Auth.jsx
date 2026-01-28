import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { User, Mail, Lock, AlertCircle } from 'lucide-react'

function Auth({ mode = 'signin' }) {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(mode === 'signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (isSignUp && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const result = isSignUp 
        ? await signUp(formData.email, formData.password, formData.name)
        : await signIn(formData.email, formData.password)

      if (result.error) {
        setError(result.error.message)
      } else {
        navigate('/admin/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(to bottom right, var(--primary-color), var(--accent-color, #9333ea))' }}
    >
      <div
        className="rounded-lg shadow-xl w-full max-w-md p-8"
        style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}
      >
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold"
            style={{ color: 'var(--text-color, #111827)' }}
          >
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p
            className="mt-2"
            style={{ color: 'var(--text-secondary-color, #4b5563)' }}
          >
            {isSignUp ? 'Start creating engaging quizzes' : 'Sign in to manage your quizzes'}
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 border rounded-lg flex items-center"
            style={{
              backgroundColor: 'var(--error-bg-color, #fef2f2)',
              borderColor: 'var(--error-border-color, #fecaca)',
              color: 'var(--error-color, #b91c1c)'
            }}
          >
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary-color, #374151)' }}
              >
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-muted-color, #9ca3af)' }} />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required={isSignUp}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--border-color, #d1d5db)',
                    '--tw-ring-color': 'var(--primary-color, #3b82f6)'
                  }}
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary-color, #374151)' }}
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-muted-color, #9ca3af)' }} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'var(--border-color, #d1d5db)',
                  '--tw-ring-color': 'var(--primary-color, #3b82f6)'
                }}
                placeholder="trainer@example.com"
              />
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary-color, #374151)' }}
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-muted-color, #9ca3af)' }} />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{
                  borderColor: 'var(--border-color, #d1d5db)',
                  '--tw-ring-color': 'var(--primary-color, #3b82f6)'
                }}
                placeholder="••••••••"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary-color, #374151)' }}
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-muted-color, #9ca3af)' }} />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required={isSignUp}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--border-color, #d1d5db)',
                    '--tw-ring-color': 'var(--primary-color, #3b82f6)'
                  }}
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--primary-color, #2563eb)',
              color: 'var(--primary-text-color, #ffffff)'
            }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p style={{ color: 'var(--text-secondary-color, #4b5563)' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
                setFormData({ email: '', password: '', name: '', confirmPassword: '' })
              }}
              className="hover:underline font-medium"
              style={{ color: 'var(--primary-color, #2563eb)' }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="text-sm hover:opacity-80"
            style={{ color: 'var(--text-muted-color, #6b7280)' }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Auth
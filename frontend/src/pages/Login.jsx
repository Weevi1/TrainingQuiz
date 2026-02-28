import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'

function Login() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields')
      return
    }

    if (isSignUp && !formData.name) {
      setError('Please enter your name')
      return
    }

    setLoading(true)
    setError('')

    if (isSignUp) {
      const { data, error: signUpError } = await signUp(formData.email, formData.password, formData.name)
      
      if (signUpError) {
        setError(signUpError.message || 'Error creating account')
        setLoading(false)
      } else if (data.user) {
        navigate('/admin')
      }
    } else {
      const { data, error: signInError } = await signIn(formData.email, formData.password)

      if (signInError) {
        setError(signInError.message || 'Invalid email or password')
        setLoading(false)
      } else if (data.user) {
        navigate('/admin')
      }
    }
  }

  const fillTestCredentials = () => {
    setFormData({
      email: 'admin@gblaw.co.za',
      password: 'test123456',
      name: 'Test Admin'
    })
  }

  return (
    <div className="min-h-screen bg-gb-navy flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/gblogo.png" 
            alt="Gustav Barkhuysen Attorneys" 
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gb-gold font-serif mb-2">
            Training Quiz Admin
          </h1>
          <p className="text-gb-gold/80">
            {isSignUp ? 'Create an admin account' : 'Sign in to manage training quizzes'}
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-xl shadow-2xl border border-gb-gold/20 p-8" style={{ backgroundColor: 'var(--surface-color, rgba(255,255,255,0.95))' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field - Only for signup */}
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gb-navy mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gb-gold/30 rounded-lg focus:ring-2 focus:ring-gb-gold focus:border-gb-gold outline-none transition-colors"
                  placeholder="Enter your full name"
                  disabled={loading}
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gb-navy mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gb-gold/30 rounded-lg focus:ring-2 focus:ring-gb-gold focus:border-gb-gold outline-none transition-colors"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gb-navy mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 pr-12 border border-gb-gold/30 rounded-lg focus:ring-2 focus:ring-gb-gold focus:border-gb-gold outline-none transition-colors"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gb-navy/50 hover:text-gb-navy transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{
                  backgroundColor: 'var(--error-bg-color, #fef2f2)',
                  borderColor: 'var(--error-border-color, #fecaca)',
                  border: '1px solid var(--error-border-color, #fecaca)',
                  color: 'var(--error-color, #b91c1c)'
                }}
              >
                {error}
              </div>
            )}

            {/* Test Credentials Helper */}
            <div className="bg-gb-gold/10 border border-gb-gold/20 rounded-lg p-3 text-sm">
              <p className="text-gb-navy/80 mb-2">Test Credentials:</p>
              <button
                type="button"
                onClick={fillTestCredentials}
                className="text-gb-navy hover:underline font-medium"
                disabled={loading}
              >
                Click to fill: admin@gblaw.co.za / test123456 {isSignUp && '/ Test Admin'}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gb-gold text-gb-navy font-semibold py-3 px-4 rounded-lg hover:bg-gb-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gb-navy border-t-transparent"></div>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>

            {/* Toggle Sign In/Sign Up */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                }}
                className="text-gb-navy/70 hover:text-gb-navy text-sm"
                disabled={loading}
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gb-gold/60 text-sm">
          <p>Gustav Barkhuysen Attorneys | Training Department</p>
        </div>
      </div>
    </div>
  )
}

export default Login
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Gift, Users, Target } from 'lucide-react'
import { db } from '../lib/firebase'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'

function ScratchCardSetup() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prizes, setPrizes] = useState([
    { prize_name: 'Coffee Voucher', prize_value: 'R50', prize_description: 'Starbucks gift card', quantity: 3 },
    { prize_name: 'Discount Coupon', prize_value: '10%', prize_description: 'Store discount', quantity: 5 }
  ])
  const [loading, setLoading] = useState(false)

  const addPrize = () => {
    setPrizes([...prizes, {
      prize_name: '',
      prize_value: '',
      prize_description: '',
      quantity: 1
    }])
  }

  const removePrize = (index) => {
    setPrizes(prizes.filter((_, i) => i !== index))
  }

  const updatePrize = (index, field, value) => {
    const updated = [...prizes]
    updated[index][field] = value
    setPrizes(updated)
  }

  const totalPrizes = prizes.reduce((sum, prize) => sum + (parseInt(prize.quantity) || 0), 0)

  const createScratchSession = async () => {
    if (!title.trim()) {
      alert('Please enter a session title')
      return
    }

    if (!user) {
      alert('You must be logged in to create a session')
      return
    }

    setLoading(true)
    try {
      // Generate unique session code
      const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Create scratch session in Firebase
      const sessionData = {
        title: title.trim(),
        description: description.trim(),
        sessionCode: sessionCode,
        status: 'setup',
        trainerId: user.uid,
        createdAt: Timestamp.now(),
        type: 'scratch-card'
      }

      const sessionRef = await addDoc(collection(db, 'scratch_sessions'), sessionData)
      console.log('✅ Scratch session created:', sessionRef.id)

      // Create prizes for the session
      const validPrizes = prizes.filter(p => p.prize_name.trim() && p.quantity > 0)
      if (validPrizes.length > 0) {
        const prizePromises = validPrizes.map(prize =>
          addDoc(collection(db, 'scratch_sessions', sessionRef.id, 'prizes'), {
            prizeName: prize.prize_name.trim(),
            prizeValue: prize.prize_value.trim(),
            prizeDescription: prize.prize_description.trim(),
            quantity: parseInt(prize.quantity),
            createdAt: Timestamp.now()
          })
        )

        await Promise.all(prizePromises)
        console.log('✅ Prizes created for session')
      }

      // Navigate to session management
      navigate(`/scratch-session/${sessionRef.id}`)
    } catch (error) {
      console.error('❌ Error creating scratch session:', error)
      alert('Failed to create scratch card session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, var(--brand-primary), var(--gradient-bg-start), var(--gradient-bg-end))', color: 'var(--text-on-primary-color, #ffffff)' }}>
      {/* Header */}
      <header className="relative z-10 bg-gb-navy/95 backdrop-blur-sm shadow-2xl border-b-2 border-gb-gold">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gb-gold hover:text-gb-gold-light transition-colors px-3 py-2 rounded-lg hover:bg-gb-gold/10"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Admin</span>
            </button>
            <img src="/gbname.png" alt="GB Logo" className="h-16" />
            <div>
              <h1 className="text-xl font-bold text-gb-gold drop-shadow-lg font-serif">
                Scratch Card Setup
              </h1>
              <p className="text-gb-gold/80 text-sm">Configure giveaway prizes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 px-3 sm:px-4 lg:px-6 py-6">
        <div className="max-w-4xl mx-auto">

          {/* Session Details */}
          <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-6 border-2 border-gb-gold mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gb-gold p-2 rounded-lg">
                <Gift className="w-6 h-6 text-gb-navy" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Scratch Card Session</h2>
                <p className="text-gb-gold text-sm">Setup your giveaway event</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-gb-gold font-bold mb-2">Session Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gb-gold/30 focus:outline-none focus:border-gb-gold"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-on-primary-color, #ffffff)' }}
                  placeholder="e.g., 'End of Training Giveaway'"
                />
              </div>

              <div>
                <label className="block text-gb-gold font-bold mb-2">Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gb-gold/30 focus:outline-none focus:border-gb-gold"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-on-primary-color, #ffffff)' }}
                  placeholder="Brief description of the giveaway"
                />
              </div>
            </div>
          </div>

          {/* Prizes Configuration */}
          <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-6 border-2 border-gb-gold mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gb-gold p-2 rounded-lg">
                  <Target className="w-6 h-6 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Prize Configuration</h2>
                  <p className="text-gb-gold text-sm">Define what participants can win</p>
                </div>
              </div>

              <button
                onClick={addPrize}
                className="flex items-center gap-2 px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Prize
              </button>
            </div>

            <div className="space-y-4">
              {prizes.map((prize, index) => (
                <div key={index} className="rounded-lg p-4 border border-gb-gold/20" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-gb-gold text-sm font-medium mb-1">Prize Name</label>
                      <input
                        type="text"
                        value={prize.prize_name}
                        onChange={(e) => updatePrize(index, 'prize_name', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gb-gold/30 text-sm focus:outline-none focus:border-gb-gold"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-on-primary-color, #ffffff)' }}
                        placeholder="Coffee Voucher"
                      />
                    </div>

                    <div>
                      <label className="block text-gb-gold text-sm font-medium mb-1">Value</label>
                      <input
                        type="text"
                        value={prize.prize_value}
                        onChange={(e) => updatePrize(index, 'prize_value', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gb-gold/30 text-sm focus:outline-none focus:border-gb-gold"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-on-primary-color, #ffffff)' }}
                        placeholder="R50"
                      />
                    </div>

                    <div>
                      <label className="block text-gb-gold text-sm font-medium mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={prize.quantity}
                        onChange={(e) => updatePrize(index, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gb-gold/30 text-sm focus:outline-none focus:border-gb-gold"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-on-primary-color, #ffffff)' }}
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => removePrize(index)}
                        className="w-full px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                        style={{ backgroundColor: 'var(--error-color)', color: 'var(--text-on-primary-color, #ffffff)' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--error-hover)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--error-color)'}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-gb-gold text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={prize.prize_description}
                      onChange={(e) => updatePrize(index, 'prize_description', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gb-gold/30 text-sm focus:outline-none focus:border-gb-gold"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-on-primary-color, #ffffff)' }}
                      placeholder="Additional details about this prize"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Prize Summary */}
            <div className="mt-6 bg-gb-gold/10 rounded-lg p-4 border border-gb-gold/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gb-gold" />
                  <span className="font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Total Prizes to Distribute:</span>
                </div>
                <span className="text-gb-gold font-bold text-xl">{totalPrizes}</span>
              </div>
              <p className="text-sm mt-2" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                The remaining participants will receive "Try Again" cards
              </p>
            </div>
          </div>

          {/* Create Session Button */}
          <div className="flex justify-end">
            <button
              onClick={createScratchSession}
              disabled={loading || !title.trim()}
              className="px-8 py-4 bg-gb-gold text-gb-navy rounded-xl hover:bg-gb-gold-light font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
            >
              {loading ? 'Creating Session...' : 'Create Scratch Card Session'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ScratchCardSetup
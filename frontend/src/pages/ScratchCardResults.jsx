import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Gift, Users, Download, CheckCircle, Clock, Award } from 'lucide-react'
import { db } from '../lib/firebase'
import { doc, getDoc, collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'

function ScratchCardResults() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [scratchCards, setScratchCards] = useState([])
  const [prizes, setPrizes] = useState([])
  const [winners, setWinners] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('prize') // 'prize', 'name', 'time'

  useEffect(() => {
    if (!sessionId) return
    loadResultsData()
  }, [sessionId])

  const loadResultsData = async () => {
    try {
      // Load session details
      const sessionDoc = await getDoc(doc(db, 'scratch_sessions', sessionId))
      if (!sessionDoc.exists()) {
        throw new Error('Session not found')
      }
      const sessionData = { id: sessionDoc.id, ...sessionDoc.data() }
      setSession(sessionData)

      // Load participants
      const participantsQuery = query(
        collection(db, 'scratch_sessions', sessionId, 'participants'),
        orderBy('joinedAt')
      )
      const participantsSnapshot = await getDocs(participantsQuery)
      const participantsData = participantsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setParticipants(participantsData)

      // Load scratch cards
      const cardsQuery = query(
        collection(db, 'scratch_sessions', sessionId, 'cards'),
        orderBy('cardNumber')
      )
      const cardsSnapshot = await getDocs(cardsQuery)
      const cardsData = cardsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setScratchCards(cardsData)

      // Load prizes
      const prizesQuery = query(
        collection(db, 'scratch_sessions', sessionId, 'prizes'),
        orderBy('createdAt')
      )
      const prizesSnapshot = await getDocs(prizesQuery)
      const prizesData = prizesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPrizes(prizesData)

      // Process winners data
      const winnersData = []
      for (const card of cardsData) {
        if (card.prizeId && card.scratched) {
          const participant = participantsData.find(p => p.id === card.participantId)
          const prize = prizesData.find(p => p.id === card.prizeId)

          if (participant && prize) {
            winnersData.push({
              id: card.id,
              participantName: participant.name,
              participantId: participant.id,
              cardNumber: card.cardNumber,
              prize: prize,
              scratchedAt: card.scratchedAt,
              distributed: false // Could be tracked in future
            })
          }
        }
      }
      setWinners(winnersData)

    } catch (error) {
      console.error('Error loading results data:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedWinners = [...winners].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.participantName.localeCompare(b.participantName)
      case 'time':
        return new Date(a.scratchedAt?.toDate()) - new Date(b.scratchedAt?.toDate())
      case 'prize':
      default:
        return a.prize.prizeName.localeCompare(b.prize.prizeName)
    }
  })

  const exportResults = () => {
    const csvContent = [
      ['Winner Name', 'Prize', 'Prize Value', 'Card Number', 'Scratched Time'],
      ...sortedWinners.map(winner => [
        winner.participantName,
        winner.prize.prizeName,
        winner.prize.prizeValue,
        winner.cardNumber,
        winner.scratchedAt?.toDate().toLocaleString() || 'Unknown'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scratch-card-winners-${session?.sessionCode || 'results'}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--brand-primary), var(--gradient-bg-start), var(--gradient-bg-end))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gb-gold mx-auto"></div>
          <p className="mt-4 text-gb-gold text-lg">Loading scratch card results...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--brand-primary), var(--gradient-bg-start), var(--gradient-bg-end))' }}>
        <div className="text-center" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>
          <h1 className="text-2xl font-bold mb-4">Session not found</h1>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 bg-gb-gold text-gb-navy rounded-lg font-bold"
          >
            Back to Admin
          </button>
        </div>
      </div>
    )
  }

  const totalParticipants = participants.length
  const totalWinners = winners.length
  const totalPrizes = prizes.reduce((sum, prize) => sum + prize.quantity, 0)
  const scratchedCards = scratchCards.filter(card => card.scratched).length

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, var(--brand-primary), var(--gradient-bg-start), var(--gradient-bg-end))', color: 'var(--text-on-primary-color, #ffffff)' }}>
      {/* Header */}
      <header className="relative z-10 bg-gb-navy/95 backdrop-blur-sm shadow-2xl border-b-2 border-gb-gold">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/scratch-session/${sessionId}`)}
              className="flex items-center gap-2 text-gb-gold hover:text-gb-gold-light transition-colors px-3 py-2 rounded-lg hover:bg-gb-gold/10"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Session</span>
            </button>
            <img src="/gbname.png" alt="GB Logo" className="h-16" />
            <div className="text-right">
              <h1 className="text-xl font-bold text-gb-gold drop-shadow-lg font-serif">
                Scratch Card Results
              </h1>
              <p className="text-gb-gold/80 text-sm">{session.title}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 px-3 sm:px-4 lg:px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Session Summary */}
          <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-6 border-2 border-gb-gold">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gb-gold p-2 rounded-lg">
                <Gift className="w-6 h-6 text-gb-navy" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Session Summary</h2>
                <p className="text-gb-gold text-sm">Code: {session.sessionCode}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gb-gold/10 rounded-lg p-4 border border-gb-gold/30 text-center">
                <Users className="w-8 h-8 text-gb-gold mx-auto mb-2" />
                <div className="text-2xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{totalParticipants}</div>
                <div className="text-gb-gold text-sm">Total Participants</div>
              </div>

              <div className="rounded-lg p-4 text-center" style={{ backgroundColor: 'var(--stat-green-bg)', border: '1px solid var(--stat-green-border)' }}>
                <Trophy className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--stat-green-text)' }} />
                <div className="text-2xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{totalWinners}</div>
                <div className="text-sm" style={{ color: 'var(--stat-green-text)' }}>Winners</div>
              </div>

              <div className="rounded-lg p-4 text-center" style={{ backgroundColor: 'var(--stat-blue-bg)', border: '1px solid var(--stat-blue-border)' }}>
                <Gift className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--stat-blue-text)' }} />
                <div className="text-2xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{totalPrizes}</div>
                <div className="text-sm" style={{ color: 'var(--stat-blue-text)' }}>Total Prizes</div>
              </div>

              <div className="rounded-lg p-4 text-center" style={{ backgroundColor: 'var(--stat-purple-bg)', border: '1px solid var(--stat-purple-border)' }}>
                <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--stat-purple-text)' }} />
                <div className="text-2xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{scratchedCards}</div>
                <div className="text-sm" style={{ color: 'var(--stat-purple-text)' }}>Cards Scratched</div>
              </div>
            </div>
          </div>

          {/* Winners List */}
          <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-6 border-2 border-gb-gold">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gb-gold p-2 rounded-lg">
                  <Award className="w-6 h-6 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Prize Winners</h2>
                  <p className="text-gb-gold text-sm">{winners.length} participants won prizes</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 bg-gb-navy border border-gb-gold/30 rounded-lg text-sm focus:outline-none focus:border-gb-gold"
                  style={{ color: 'var(--text-on-primary-color, #ffffff)' }}
                >
                  <option value="prize">Sort by Prize</option>
                  <option value="name">Sort by Name</option>
                  <option value="time">Sort by Time</option>
                </select>

                <button
                  onClick={exportResults}
                  className="flex items-center gap-2 px-4 py-2 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-bold transition-all"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {winners.length === 0 ? (
              <div className="text-center py-12 bg-gb-gold/5 rounded-xl border border-gb-gold/20">
                <Trophy className="w-16 h-16 text-gb-gold/50 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>No Winners Yet</h3>
                <p className="text-gb-gold/80">Winners will appear here once participants scratch their cards</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedWinners.map((winner, index) => (
                  <div key={winner.id} className="rounded-lg p-4 border border-gb-gold/20 transition-all" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gb-gold rounded-lg flex items-center justify-center text-gb-navy font-bold shadow-lg">
                          #{winner.cardNumber}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{winner.participantName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Trophy className="w-4 h-4 text-gb-gold" />
                            <span className="text-gb-gold font-medium">{winner.prize.prizeName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{winner.prize.prizeValue}</div>
                        <div className="flex items-center gap-2 text-sm mt-1" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                          <Clock className="w-4 h-4" />
                          {winner.scratchedAt?.toDate().toLocaleTimeString() || 'Unknown time'}
                        </div>
                      </div>
                    </div>

                    {winner.prize.prizeDescription && (
                      <div className="mt-3 text-sm rounded-lg p-2" style={{ color: 'rgba(255, 255, 255, 0.8)', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                        {winner.prize.prizeDescription}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prize Distribution Checklist */}
          {winners.length > 0 && (
            <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-6 border-2 border-gb-gold">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gb-gold p-2 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Distribution Checklist</h2>
                  <p className="text-gb-gold text-sm">Track prize distribution to winners</p>
                </div>
              </div>

              <div className="bg-gb-gold/10 rounded-lg p-4 border border-gb-gold/30">
                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Prizes to Distribute:</h3>
                <div className="space-y-2">
                  {Object.entries(
                    winners.reduce((acc, winner) => {
                      const key = `${winner.prize.prizeName} (${winner.prize.prizeValue})`
                      acc[key] = (acc[key] || []).concat(winner.participantName)
                      return acc
                    }, {})
                  ).map(([prizeInfo, winnerNames]) => (
                    <div key={prizeInfo} className="flex justify-between items-center py-2 px-3 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{prizeInfo}</span>
                      <span className="text-gb-gold text-sm">
                        {winnerNames.length} winner{winnerNames.length > 1 ? 's' : ''}: {winnerNames.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ScratchCardResults
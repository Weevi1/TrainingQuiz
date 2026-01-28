import { useState } from 'react'
import QRCode from 'react-qr-code'
import { Users, Clock, Play, Square, Trophy, Target, X, ArrowLeft } from 'lucide-react'

// Standalone QuizSession component for Storybook (no router dependencies)
function QuizSessionDemo({
  sessionStatus = 'waiting',
  quizTitle = 'Employment Law Fundamentals',
  participants = [],
  liveResults = [],
  sessionCode = 'ABC123',
  timeLimit = 1800,
  questionCount = 10
}) {
  const [status, setStatus] = useState(sessionStatus)

  const sessionUrl = `${window.location.origin}/quiz/${sessionCode}`

  const startSession = () => setStatus('active')
  const stopSession = () => setStatus('completed')
  const viewResults = () => console.log('Navigate to results')
  const navigateBack = () => console.log('Navigate back')
  const kickParticipant = (id, name) => console.log(`Kick participant: ${name}`)
  const loadParticipants = () => console.log('Refresh participants')

  return (
    <div
      className="w-screen h-screen relative overflow-hidden flex flex-col"
      style={{ background: 'var(--game-gradient, linear-gradient(to bottom right, #581c87, #1e3a8a, #312e81))' }}
    >
      {/* Animated background elements */}
      <div
        className="absolute inset-0 animate-pulse"
        style={{ background: 'var(--celebration-gradient, linear-gradient(to right, rgba(250, 204, 21, 0.1), rgba(248, 113, 113, 0.1), rgba(244, 114, 182, 0.1)))' }}
      ></div>
      <div
        className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-bounce"
        style={{ backgroundColor: 'var(--accent-glow, rgba(250, 204, 21, 0.2))' }}
      ></div>
      <div
        className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-bounce delay-1000"
        style={{ backgroundColor: 'var(--secondary-glow, rgba(192, 132, 252, 0.2))' }}
      ></div>

      <header className="relative z-10 bg-gb-navy shadow-2xl border-b-4 border-gb-gold flex-shrink-0 h-20">
        <div className="w-full px-4 py-2 h-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex items-center gap-4">
              <button
                onClick={navigateBack}
                disabled={status === 'active' || status === 'completed'}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  status === 'active' || status === 'completed'
                    ? 'text-gb-gold/30 cursor-not-allowed'
                    : 'text-gb-gold hover:bg-gb-gold/20'
                }`}
                style={
                  status !== 'active' && status !== 'completed' ? { '--hover-color': 'var(--text-on-primary-color, #ffffff)' } : {}
                }
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <img src="/gbname.png" alt="GB Logo" className="h-8" />
              <div>
                <h1 className="text-xl font-bold text-gb-gold drop-shadow-lg font-serif">
                  {quizTitle}
                </h1>
                <p className="text-gb-gold/80 text-sm font-medium">Live Training Quiz</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-2 rounded-lg text-sm font-semibold tracking-wide shadow-lg transition-all ${
                  status === 'waiting' ? 'bg-gb-gold text-gb-navy' :
                  status === 'active' ? 'animate-pulse' :
                  ''
                }`}
                style={
                  status === 'active' ? {
                    backgroundColor: 'var(--success-color, #16a34a)',
                    color: 'var(--success-text-color, #ffffff)'
                  } :
                  status === 'completed' ? {
                    backgroundColor: 'var(--secondary-color, #4b5563)',
                    color: 'var(--secondary-text-color, #ffffff)'
                  } : {}
                }
              >
                {status === 'waiting' && 'Ready to Start'}
                {status === 'active' && '● LIVE'}
                {status === 'completed' && '✓ Completed'}
              </div>
              {status === 'waiting' && (
                <button
                  onClick={startSession}
                  className="bg-gb-gold text-gb-navy px-4 py-2 rounded-lg font-bold hover:bg-gb-gold-light flex items-center gap-2 shadow-lg transition-all"
                >
                  <Play className="w-5 h-5" />
                  Start Quiz
                </button>
              )}
              {status === 'active' && (
                <button
                  onClick={stopSession}
                  className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all"
                  style={{
                    backgroundColor: 'var(--error-color, #dc2626)',
                    color: 'var(--error-text-color, #ffffff)'
                  }}
                >
                  <Square className="w-5 h-5" />
                  End Quiz
                </button>
              )}
              {status === 'completed' && (
                <button
                  onClick={viewResults}
                  className="bg-gb-gold text-gb-navy px-4 py-2 rounded-lg font-bold hover:bg-gb-gold-light flex items-center gap-2 shadow-lg transition-all"
                >
                  <Trophy className="w-5 h-5" />
                  View Results
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-2 overflow-hidden" style={{ height: 'calc(100vh - 5rem)' }}>
        <div className="grid grid-cols-4 gap-3 h-full">
          <div className="col-span-3 flex flex-col gap-3 h-full">
            {/* Participants Section */}
            <div className={`bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-gb-gold flex flex-col ${
              status === 'active' ? 'h-1/2' : 'h-full'
            } overflow-hidden`}>
              <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="bg-gb-gold p-1.5 rounded-lg">
                    <Users className="w-4 h-4 text-gb-navy" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Training Participants</h2>
                    <p className="text-gb-gold text-xs font-medium">Live Session Management</p>
                  </div>
                </div>
                <button
                  onClick={loadParticipants}
                  className="px-3 py-1.5 bg-gb-gold text-gb-navy rounded-lg hover:bg-gb-gold-light font-bold shadow-lg transition-all text-xs flex items-center gap-2"
                >
                  <span>Refresh</span>
                </button>
              </div>
              <div className="flex items-center justify-between mb-2 bg-gb-gold/10 rounded-lg p-2 flex-shrink-0 border border-gb-gold/30">
                <div className="flex items-center gap-2">
                  <div className="bg-gb-gold/20 p-1 rounded-full">
                    <Users className="w-4 h-4 text-gb-gold" />
                  </div>
                  <div>
                    <span className="text-xl font-bold text-gb-gold">{participants.length}</span>
                    <span className="text-xs font-medium ml-2" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Active Participants</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gb-gold/80 uppercase tracking-wide">Gustav Barkhuysen</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Training Session</div>
                </div>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
                {participants.length === 0 ? (
                  <div className="text-center py-6 bg-gb-gold/5 rounded-xl border border-gb-gold/20 h-full flex flex-col items-center justify-center">
                    <div className="bg-gb-gold/10 p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <Users className="w-8 h-8 text-gb-gold" />
                    </div>
                    <p className="text-base font-bold mb-1" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Awaiting Training Participants</p>
                    <p className="text-gb-gold/80 text-xs">Share QR code to begin session</p>
                  </div>
                ) : (
                  participants.map((participant, index) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg border border-gb-gold/20 transition-all group"
                      style={{ backgroundColor: 'var(--surface-color-5, rgba(255, 255, 255, 0.05))' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-gb-gold rounded-lg flex items-center justify-center text-gb-navy font-bold text-xs shadow-lg">
                          {index + 1}
                        </div>
                        <div>
                          <span className="font-bold text-sm" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{participant.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-gb-gold text-xs font-medium bg-gb-gold/10 px-1.5 py-0.5 rounded">✓ Ready</span>
                            <span className="text-xs" style={{ color: 'var(--text-on-primary-color-60, rgba(255, 255, 255, 0.6))' }}>Training Participant</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => kickParticipant(participant.id, participant.name)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center transition-all group shadow-lg hover:shadow-xl kick-button"
                        style={{ backgroundColor: 'var(--error-color, #dc2626)' }}
                        title={`Remove ${participant.name}`}
                      >
                        <X className="w-3 h-3 group-hover:scale-110 transition-transform" style={{ color: 'var(--text-on-primary-color, #ffffff)' }} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live Results Section */}
            {status === 'active' && (
              <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 border-2 border-gb-gold flex flex-col h-1/2 overflow-hidden">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="bg-gb-gold p-1.5 rounded-lg">
                      <Trophy className="w-4 h-4 text-gb-navy" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Live Performance Tracking</h2>
                      <p className="text-gb-gold text-xs font-medium flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: 'var(--success-color, #4ade80)' }}
                        ></span>
                        Real-time Results
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gb-gold/80 uppercase tracking-wide">GB Training</div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Analytics Dashboard</div>
                  </div>
                </div>

                {liveResults.length > 0 ? (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="grid grid-cols-3 gap-1 mb-2 flex-shrink-0">
                      <div className="text-center rounded-lg p-1.5 border border-gb-gold/20" style={{ backgroundColor: 'var(--surface-color-10, rgba(255, 255, 255, 0.1))' }}>
                        <div className="text-sm font-bold text-gb-gold">
                          {Math.round(liveResults.reduce((sum, p) => sum + p.percentage, 0) / liveResults.length) || 0}%
                        </div>
                        <div className="font-medium text-xs" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Avg Score</div>
                      </div>
                      <div className="text-center rounded-lg p-1.5 border border-gb-gold/20" style={{ backgroundColor: 'var(--surface-color-10, rgba(255, 255, 255, 0.1))' }}>
                        <div className="text-sm font-bold text-gb-gold">
                          {liveResults.length > 0 ? Math.max(...liveResults.map(p => p.total)) : 0}/{questionCount}
                        </div>
                        <div className="font-medium text-xs" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Progress</div>
                      </div>
                      <div className="text-center rounded-lg p-1.5 border border-gb-gold/20" style={{ backgroundColor: 'var(--surface-color-10, rgba(255, 255, 255, 0.1))' }}>
                        <div className="text-sm font-bold text-gb-gold">
                          {liveResults.length > 0 ? Math.round(liveResults.reduce((sum, p) => sum + p.avgTime, 0) / liveResults.length) : 0}s
                        </div>
                        <div className="font-medium text-xs" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Avg Time</div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                      {liveResults.map((participant, index) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-2 rounded-lg transition-all border"
                          style={
                            index === 0 ? {
                              background: 'var(--rank-first-gradient, linear-gradient(to right, rgba(234, 179, 8, 0.4), rgba(249, 115, 22, 0.4)))',
                              borderColor: 'var(--rank-first-border, #facc15)'
                            } :
                            index === 1 ? {
                              background: 'var(--rank-second-gradient, linear-gradient(to right, rgba(156, 163, 175, 0.4), rgba(100, 116, 139, 0.4)))',
                              borderColor: 'var(--rank-second-border, #9ca3af)'
                            } :
                            index === 2 ? {
                              background: 'var(--rank-third-gradient, linear-gradient(to right, rgba(249, 115, 22, 0.4), rgba(239, 68, 68, 0.4)))',
                              borderColor: 'var(--rank-third-border, #fb923c)'
                            } : {
                              background: 'var(--rank-default-gradient, linear-gradient(to right, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3)))',
                              borderColor: 'var(--rank-default-border, rgba(129, 140, 248, 0.5))'
                            }
                          }
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="font-bold text-sm"
                              style={{
                                color: index === 0 ? 'var(--rank-first-text, #fde047)' :
                                       index === 1 ? 'var(--rank-second-text, #d1d5db)' :
                                       index === 2 ? 'var(--rank-third-text, #fdba74)' :
                                       'var(--rank-default-text, #ffffff)'
                              }}
                            >
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </span>
                            <span className="font-bold text-xs" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{participant.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span style={{ color: 'var(--stat-score-color, #86efac)' }} className="font-bold">🎯 {participant.score}</span>
                            <span style={{ color: 'var(--stat-percent-color, #93c5fd)' }} className="font-semibold">📊 {participant.percentage}%</span>
                            <span style={{ color: 'var(--stat-time-color, #d8b4fe)' }} className="font-semibold">⚡ {participant.avgTime}s</span>
                            {participant.correct === participant.total && participant.total > 0 && (
                              <span style={{ color: 'var(--stat-perfect-color, #fde047)' }} className="font-bold text-xs">🌟</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-center py-4 rounded-xl h-full flex flex-col items-center justify-center"
                    style={{ background: 'var(--empty-state-gradient, linear-gradient(to right, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2)))' }}
                  >
                    <div className="text-3xl mb-2">🎪</div>
                    <p className="text-base font-bold mb-1" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>🎯 Arena is heating up!</p>
                    <p style={{ color: 'var(--highlight-text-color, #fef08a)' }} className="text-xs">Live results will appear as contestants answer!</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 h-full">
            <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-3 border-2 border-gb-gold relative overflow-hidden h-80">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-gb-gold p-1.5 rounded-lg">
                  <Target className="w-4 h-4 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Session Access</h2>
                  <p className="text-gb-gold text-xs font-medium">Participant Entry Portal</p>
                </div>
              </div>

              <div className="text-center relative">
                <div className="p-3 rounded-xl border-2 border-gb-gold mb-2 inline-block shadow-2xl" style={{ backgroundColor: 'var(--surface-color, #ffffff)' }}>
                  <QRCode
                    value={sessionUrl}
                    size={100}
                    level="M"
                  />
                </div>

                <div className="bg-gb-gold/10 rounded-lg p-2 border border-gb-gold/30 mb-2">
                  <div className="text-gb-gold text-xs font-bold uppercase tracking-wide mb-1">Session URL</div>
                  <p className="text-xs font-mono break-all" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>{sessionUrl}</p>
                </div>

                <div className="bg-gb-gold/5 rounded-lg p-2 border border-gb-gold/20">
                  <div className="text-xs text-gb-gold/80 uppercase tracking-wide mb-1">Gustav Barkhuysen Attorneys</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Professional Training Portal</div>
                </div>
              </div>
            </div>

            <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-3 border-2 border-gb-gold flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gb-gold p-1.5 rounded-lg">
                  <Clock className="w-4 h-4 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Session Details</h2>
                  <p className="text-gb-gold text-xs font-medium">Quiz Configuration</p>
                </div>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto">
                <div className="bg-gb-gold/5 rounded-lg p-2 border border-gb-gold/20">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-xs" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Duration</span>
                    <span className="text-gb-gold font-bold text-sm">{Math.floor(timeLimit / 60)} min</span>
                  </div>
                </div>

                <div className="bg-gb-gold/5 rounded-lg p-2 border border-gb-gold/20">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-xs" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Status</span>
                    <span
                      className={`font-bold text-xs uppercase px-2 py-1 rounded-full ${
                        status === 'active' ? 'animate-pulse' : ''
                      }`}
                      style={
                        status === 'waiting' ? {
                          backgroundColor: 'var(--warning-color, #fbbf24)',
                          color: 'var(--warning-text-color, #854d0e)'
                        } :
                        status === 'active' ? {
                          backgroundColor: 'var(--success-light-color, #bbf7d0)',
                          color: 'var(--success-dark-color, #166534)'
                        } : {
                          backgroundColor: 'var(--accent-light-color, #e9d5ff)',
                          color: 'var(--accent-dark-color, #6b21a8)'
                        }
                      }
                    >
                      {status === 'waiting' && 'Preparing'}
                      {status === 'active' && 'Active'}
                      {status === 'completed' && 'Complete'}
                    </span>
                  </div>
                </div>

                <div className="bg-gb-gold/10 rounded-lg p-2 border-2 border-gb-gold/30">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs" style={{ color: 'var(--text-on-primary-color, #ffffff)' }}>Questions</span>
                    <span className="text-gb-gold font-bold text-lg">{questionCount}</span>
                  </div>
                  <div className="text-xs text-gb-gold/80 mt-1">Training Assessment Points</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default QuizSessionDemo

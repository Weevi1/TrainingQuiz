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
    <div className="w-screen h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden flex flex-col">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 via-red-400/10 to-pink-400/10 animate-pulse"></div>
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl animate-bounce"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-bounce delay-1000"></div>
      
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
                    : 'text-gb-gold hover:bg-gb-gold/20 hover:text-white'
                }`}
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
              <div className={`px-3 py-2 rounded-lg text-sm font-semibold tracking-wide shadow-lg transition-all ${
                status === 'waiting' ? 'bg-gb-gold text-gb-navy' :
                status === 'active' ? 'bg-green-600 text-white animate-pulse' :
                'bg-gray-600 text-white'
              }`}>
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
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 flex items-center gap-2 shadow-lg transition-all"
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
                    <h2 className="text-lg font-bold text-white">Training Participants</h2>
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
                    <span className="text-white text-xs font-medium ml-2">Active Participants</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gb-gold/80 uppercase tracking-wide">Gustav Barkhuysen</div>
                  <div className="text-xs text-white font-medium">Training Session</div>
                </div>
              </div>
              
              <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
                {participants.length === 0 ? (
                  <div className="text-center py-6 bg-gb-gold/5 rounded-xl border border-gb-gold/20 h-full flex flex-col items-center justify-center">
                    <div className="bg-gb-gold/10 p-3 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <Users className="w-8 h-8 text-gb-gold" />
                    </div>
                    <p className="text-white text-base font-bold mb-1">Awaiting Training Participants</p>
                    <p className="text-gb-gold/80 text-xs">Share QR code to begin session</p>
                  </div>
                ) : (
                  participants.map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg border border-gb-gold/20 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-gb-gold rounded-lg flex items-center justify-center text-gb-navy font-bold text-xs shadow-lg">
                          {index + 1}
                        </div>
                        <div>
                          <span className="text-white font-bold text-sm">{participant.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-gb-gold text-xs font-medium bg-gb-gold/10 px-1.5 py-0.5 rounded">✓ Ready</span>
                            <span className="text-white/60 text-xs">Training Participant</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => kickParticipant(participant.id, participant.name)}
                        className="w-6 h-6 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center transition-all group shadow-lg hover:shadow-xl"
                        title={`Remove ${participant.name}`}
                      >
                        <X className="w-3 h-3 text-white group-hover:scale-110 transition-transform" />
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
                      <h2 className="text-lg font-bold text-white">Live Performance Tracking</h2>
                      <p className="text-gb-gold text-xs font-medium flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Real-time Results
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gb-gold/80 uppercase tracking-wide">GB Training</div>
                    <div className="text-xs text-white font-medium">Analytics Dashboard</div>
                  </div>
                </div>
                
                {liveResults.length > 0 ? (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="grid grid-cols-3 gap-1 mb-2 flex-shrink-0">
                      <div className="text-center bg-white/10 rounded-lg p-1.5 border border-gb-gold/20">
                        <div className="text-sm font-bold text-gb-gold">
                          {Math.round(liveResults.reduce((sum, p) => sum + p.percentage, 0) / liveResults.length) || 0}%
                        </div>
                        <div className="text-white font-medium text-xs">Avg Score</div>
                      </div>
                      <div className="text-center bg-white/10 rounded-lg p-1.5 border border-gb-gold/20">
                        <div className="text-sm font-bold text-gb-gold">
                          {liveResults.length > 0 ? Math.max(...liveResults.map(p => p.total)) : 0}/{questionCount}
                        </div>
                        <div className="text-white font-medium text-xs">Progress</div>
                      </div>
                      <div className="text-center bg-white/10 rounded-lg p-1.5 border border-gb-gold/20">
                        <div className="text-sm font-bold text-gb-gold">
                          {liveResults.length > 0 ? Math.round(liveResults.reduce((sum, p) => sum + p.avgTime, 0) / liveResults.length) : 0}s
                        </div>
                        <div className="text-white font-medium text-xs">Avg Time</div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                      {liveResults.map((participant, index) => (
                        <div key={participant.id} className={`flex items-center justify-between p-2 rounded-lg transition-all border ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-500/40 to-orange-500/40 border-yellow-400' :
                          index === 1 ? 'bg-gradient-to-r from-gray-400/40 to-slate-500/40 border-gray-400' :
                          index === 2 ? 'bg-gradient-to-r from-orange-500/40 to-red-500/40 border-orange-400' :
                          'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border-indigo-400/50'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${
                              index === 0 ? 'text-yellow-300' :
                              index === 1 ? 'text-gray-300' :
                              index === 2 ? 'text-orange-300' :
                              'text-white'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                            </span>
                            <span className="font-bold text-white text-xs">{participant.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-300 font-bold">🎯 {participant.score}</span>
                            <span className="text-blue-300 font-semibold">📊 {participant.percentage}%</span>
                            <span className="text-purple-300 font-semibold">⚡ {participant.avgTime}s</span>
                            {participant.correct === participant.total && participant.total > 0 && (
                              <span className="text-yellow-300 font-bold text-xs">🌟</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl h-full flex flex-col items-center justify-center">
                    <div className="text-3xl mb-2">🎪</div>
                    <p className="text-white text-base font-bold mb-1">🎯 Arena is heating up!</p>
                    <p className="text-yellow-200 text-xs">Live results will appear as contestants answer!</p>
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
                  <h2 className="text-base font-bold text-white">Session Access</h2>
                  <p className="text-gb-gold text-xs font-medium">Participant Entry Portal</p>
                </div>
              </div>
              
              <div className="text-center relative">
                <div className="bg-white p-3 rounded-xl border-2 border-gb-gold mb-2 inline-block shadow-2xl">
                  <QRCode 
                    value={sessionUrl} 
                    size={100}
                    level="M"
                  />
                </div>
                
                <div className="bg-gb-gold/10 rounded-lg p-2 border border-gb-gold/30 mb-2">
                  <div className="text-gb-gold text-xs font-bold uppercase tracking-wide mb-1">Session URL</div>
                  <p className="text-white text-xs font-mono break-all">{sessionUrl}</p>
                </div>
                
                <div className="bg-gb-gold/5 rounded-lg p-2 border border-gb-gold/20">
                  <div className="text-xs text-gb-gold/80 uppercase tracking-wide mb-1">Gustav Barkhuysen Attorneys</div>
                  <div className="text-xs text-white font-medium">Professional Training Portal</div>
                </div>
              </div>
            </div>

            <div className="bg-gb-navy/95 backdrop-blur-sm rounded-xl shadow-2xl p-3 border-2 border-gb-gold flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-gb-gold p-1.5 rounded-lg">
                  <Clock className="w-4 h-4 text-gb-navy" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Session Details</h2>
                  <p className="text-gb-gold text-xs font-medium">Quiz Configuration</p>
                </div>
              </div>
              
              <div className="space-y-2 flex-1 overflow-y-auto">
                <div className="bg-gb-gold/5 rounded-lg p-2 border border-gb-gold/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium text-xs">Duration</span>
                    <span className="text-gb-gold font-bold text-sm">{Math.floor(timeLimit / 60)} min</span>
                  </div>
                </div>
                
                <div className="bg-gb-gold/5 rounded-lg p-2 border border-gb-gold/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium text-xs">Status</span>
                    <span className={`font-bold text-xs uppercase px-2 py-1 rounded-full ${
                      status === 'waiting' ? 'text-yellow-800 bg-yellow-300' :
                      status === 'active' ? 'text-green-800 bg-green-300 animate-pulse' :
                      'text-purple-800 bg-purple-300'
                    }`}>
                      {status === 'waiting' && 'Preparing'}
                      {status === 'active' && 'Active'}
                      {status === 'completed' && 'Complete'}
                    </span>
                  </div>
                </div>
                
                <div className="bg-gb-gold/10 rounded-lg p-2 border-2 border-gb-gold/30">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold text-xs">Questions</span>
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
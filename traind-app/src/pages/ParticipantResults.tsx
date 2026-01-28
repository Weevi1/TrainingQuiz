import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Trophy, Star, Zap, Target, Clock, CheckCircle, XCircle, Award, TrendingUp } from 'lucide-react'

interface ResultsState {
  participantName: string
  gameState: {
    score: number
    streak: number
    answers: Array<{
      questionId: string
      selectedAnswer: number
      isCorrect: boolean
      timeSpent: number
    }>
    totalQuestions: number
  }
  quiz: {
    title: string
    questions: Array<{
      id: string
      questionText: string
      options: string[]
      correctAnswer: number
      explanation?: string
    }>
    settings: {
      passingScore: number
    }
  }
  sessionCode: string
}

export const ParticipantResults: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const resultsState = location.state as ResultsState

  if (!resultsState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">No results available</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary mt-4"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const { participantName, gameState, quiz, sessionCode } = resultsState
  const correctAnswers = gameState.answers.filter(a => a.isCorrect).length
  const percentage = Math.round((correctAnswers / gameState.totalQuestions) * 100)
  const passed = percentage >= quiz.settings.passingScore
  const averageTime = Math.round(
    gameState.answers.reduce((acc, answer) => acc + answer.timeSpent, 0) / gameState.answers.length
  )

  // Calculate best streak
  let bestStreak = 0
  let currentStreak = 0
  gameState.answers.forEach(answer => {
    if (answer.isCorrect) {
      currentStreak++
      bestStreak = Math.max(bestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  })

  // Performance analysis - returns style objects for theming
  const getPerformanceLevel = () => {
    if (percentage >= 90) return {
      level: 'Outstanding',
      style: { color: 'var(--success-color)', backgroundColor: 'var(--success-light-color)' }
    }
    if (percentage >= 80) return {
      level: 'Excellent',
      style: { color: 'var(--primary-color)', backgroundColor: 'var(--primary-light-color)' }
    }
    if (percentage >= 70) return {
      level: 'Good',
      style: { color: 'var(--secondary-color)', backgroundColor: 'var(--secondary-light-color)' }
    }
    if (percentage >= 60) return {
      level: 'Fair',
      style: { color: 'var(--warning-color)', backgroundColor: 'var(--warning-light-color)' }
    }
    return {
      level: 'Needs Improvement',
      style: { color: 'var(--error-color)', backgroundColor: 'var(--error-light-color)' }
    }
  }

  const performance = getPerformanceLevel()

  const getAchievements = () => {
    const achievements: Array<{ name: string; icon: typeof Trophy; style: React.CSSProperties }> = []

    if (percentage === 100) {
      achievements.push({ name: 'Perfect Score', icon: Trophy, style: { color: 'var(--celebration-color)' } })
    }
    if (bestStreak >= 5) {
      achievements.push({ name: 'Streak Master', icon: Zap, style: { color: 'var(--streak-color)' } })
    }
    if (averageTime <= 15) {
      achievements.push({ name: 'Speed Demon', icon: Clock, style: { color: 'var(--primary-color)' } })
    }
    if (correctAnswers >= gameState.totalQuestions * 0.8) {
      achievements.push({ name: 'Knowledge Expert', icon: Star, style: { color: 'var(--secondary-color)' } })
    }
    if (passed) {
      achievements.push({ name: 'Certified', icon: Award, style: { color: 'var(--success-color)' } })
    }

    return achievements
  }

  const achievements = getAchievements()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <h1 className="text-xl font-bold text-primary">Quiz Results</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Results */}
        <div className="card mb-6 text-center">
          <div className="mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: passed ? 'var(--success-light-color)' : 'var(--error-light-color)' }}
            >
              {passed ? (
                <Trophy style={{ color: 'var(--success-color)' }} size={40} />
              ) : (
                <Target style={{ color: 'var(--error-color)' }} size={40} />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2">
              {passed ? 'Congratulations!' : 'Keep Learning!'}
            </h2>
            <p className="text-text-secondary mb-4">
              {participantName}, here are your results for "{quiz.title}"
            </p>

            <div className="text-4xl font-bold text-primary mb-2">
              {percentage}%
            </div>
            <div
              className="inline-block px-4 py-2 rounded-full text-sm font-medium"
              style={performance.style}
            >
              {performance.level}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{correctAnswers}</div>
              <div className="text-sm text-text-secondary">Correct</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{gameState.totalQuestions - correctAnswers}</div>
              <div className="text-sm text-text-secondary">Incorrect</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{bestStreak}</div>
              <div className="text-sm text-text-secondary">Best Streak</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{averageTime}s</div>
              <div className="text-sm text-text-secondary">Avg Time</div>
            </div>
          </div>
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="card mb-6">
            <h3 className="font-semibold mb-4 flex items-center space-x-2">
              <Award size={20} />
              <span>Achievements Unlocked</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {achievements.map((achievement, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--surface-color)' }}
                >
                  <achievement.icon style={achievement.style} size={24} />
                  <span className="font-medium">{achievement.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question Breakdown */}
        <div className="card mb-6">
          <h3 className="font-semibold mb-4">Question Breakdown</h3>
          <div className="space-y-3">
            {gameState.answers.map((answer, index) => {
              const question = quiz.questions.find(q => q.id === answer.questionId)
              if (!question) return null

              return (
                <div
                  key={answer.questionId}
                  className="p-4 rounded-lg border-2"
                  style={{
                    borderColor: answer.isCorrect ? 'var(--success-color)' : 'var(--error-color)',
                    backgroundColor: answer.isCorrect ? 'var(--success-light-color)' : 'var(--error-light-color)'
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {answer.isCorrect ? (
                        <CheckCircle style={{ color: 'var(--success-color)' }} size={20} />
                      ) : (
                        <XCircle style={{ color: 'var(--error-color)' }} size={20} />
                      )}
                      <span className="font-medium">Question {index + 1}</span>
                    </div>
                    <div className="text-sm text-text-secondary">
                      {answer.timeSpent}s
                    </div>
                  </div>

                  <p className="text-sm mb-2">{question.questionText}</p>

                  <div className="text-sm space-y-1">
                    <div style={{ color: answer.isCorrect ? 'var(--success-color)' : 'var(--error-color)' }}>
                      Your answer: {question.options[answer.selectedAnswer] || 'No answer'}
                    </div>
                    {!answer.isCorrect && (
                      <div style={{ color: 'var(--success-color)' }}>
                        Correct answer: {question.options[question.correctAnswer]}
                      </div>
                    )}
                    {question.explanation && (
                      <div className="text-text-secondary italic mt-2">
                        {question.explanation}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Performance Insights */}
        <div className="card mb-6">
          <h3 className="font-semibold mb-4 flex items-center space-x-2">
            <TrendingUp size={20} />
            <span>Performance Insights</span>
          </h3>
          <div className="space-y-3 text-sm">
            {percentage >= 80 && (
              <div className="flex items-center space-x-2" style={{ color: 'var(--success-color)' }}>
                <CheckCircle size={16} />
                <span>Strong understanding of the material</span>
              </div>
            )}

            {bestStreak >= 3 && (
              <div className="flex items-center space-x-2" style={{ color: 'var(--streak-color)' }}>
                <Zap size={16} />
                <span>Excellent consistency with a {bestStreak}-question streak</span>
              </div>
            )}

            {averageTime <= 20 && (
              <div className="flex items-center space-x-2" style={{ color: 'var(--primary-color)' }}>
                <Clock size={16} />
                <span>Quick thinking with {averageTime}s average response time</span>
              </div>
            )}

            {percentage < quiz.settings.passingScore && (
              <div style={{ color: 'var(--error-color)' }}>
                <p>Consider reviewing the material and retaking the quiz to improve your score.</p>
              </div>
            )}

            {percentage >= 90 && (
              <div style={{ color: 'var(--success-color)' }}>
                <p>Outstanding performance! You have mastered this material.</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate(`/join/${sessionCode}`)}
            className="btn-secondary w-full"
          >
            Join Another Session
          </button>

          <button
            onClick={() => {
              const resultsText = `
${quiz.title} - Results for ${participantName}

Score: ${percentage}% (${correctAnswers}/${gameState.totalQuestions})
Performance: ${performance.level}
Best Streak: ${bestStreak}
Average Time: ${averageTime}s

${achievements.length > 0 ? `Achievements: ${achievements.map(a => a.name).join(', ')}` : ''}
              `.trim()

              if (navigator.share) {
                navigator.share({
                  title: 'Quiz Results',
                  text: resultsText
                })
              } else {
                navigator.clipboard.writeText(resultsText)
                alert('Results copied to clipboard!')
              }
            }}
            className="btn-primary w-full"
          >
            Share Results
          </button>
        </div>
      </div>
    </div>
  )
}
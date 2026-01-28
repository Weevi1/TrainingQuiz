# Traind Platform - Game Modules Specification

## Table of Contents
1. [Overview](#overview)
2. [Module Architecture](#module-architecture)
3. [Enhanced Quiz System](#enhanced-quiz-system)
4. [Who Wants to be a Millionaire](#who-wants-to-be-a-millionaire)
5. [Training Bingo](#training-bingo)
6. [Speed Rounds Challenge](#speed-rounds-challenge)
7. [Training Jeopardy](#training-jeopardy)
8. [Escape Room Training](#escape-room-training)
9. [Future Module Concepts](#future-module-concepts)
10. [Technical Implementation](#technical-implementation)
11. [Subscription Integration](#subscription-integration)

## Overview

The Traind platform offers a comprehensive suite of interactive post-training engagement modules designed to reinforce learning through gamification. Each module is built as a standalone component that integrates seamlessly with the platform's multi-tenant architecture and real-time synchronization system.

### Design Principles
- **Educational Focus**: Every game reinforces training concepts
- **Mobile-First**: Optimized for mobile participation
- **Real-Time**: Live synchronization across all devices
- **Scalable**: Support for 50-500+ participants per session
- **Engaging**: Game show atmosphere with sounds and animations
- **Accessible**: Simple participation via QR codes

### Module Subscription Tiers

| Module | Basic ($29/mo) | Professional ($79/mo) | Enterprise ($199/mo) |
|--------|----------------|----------------------|---------------------|
| Enhanced Quiz System | ✅ | ✅ | ✅ |
| Training Bingo | ✅ | ✅ | ✅ |
| Who Wants to be a Millionaire | ❌ | ✅ | ✅ |
| Speed Rounds Challenge | ❌ | ✅ | ✅ |
| Training Jeopardy | ❌ | ❌ | ✅ |
| Escape Room Training | ❌ | ❌ | ✅ |
| Trading Card Battles | ❌ | ❌ | ✅ |
| Custom Modules | ❌ | ❌ | ✅ |

## Module Architecture

### Universal Game Interface

```javascript
// GameModule.interface.js
export interface GameModule {
  // Module metadata
  id: string
  name: string
  description: string
  version: string
  subscriptionTier: 'basic' | 'professional' | 'enterprise'

  // Game configuration
  config: {
    minParticipants: number
    maxParticipants: number
    estimatedDuration: number // minutes
    supportedDevices: string[]
    requiresAudio: boolean
  }

  // Core game methods
  initialize(gameData: any): Promise<GameSession>
  startSession(sessionId: string): Promise<void>
  endSession(sessionId: string): Promise<GameResults>
  handleParticipantJoin(sessionId: string, participantId: string): Promise<void>
  handleParticipantAction(sessionId: string, participantId: string, action: any): Promise<void>

  // UI components
  AdminComponent: React.Component  // Trainer/projector view
  ParticipantComponent: React.Component  // Mobile participant view
  SetupComponent: React.Component  // Game configuration
  ResultsComponent: React.Component  // Results display
}
```

### Shared Game Components

```javascript
// SharedGameComponents.jsx
export const GameSession = ({ gameType, sessionId, userRole }) => {
  const { module, loading, error } = useGameModule(gameType)
  const { session, participants } = useRealTimeSession(sessionId)

  if (loading) return <GameLoadingScreen />
  if (error) return <GameErrorScreen error={error} />

  return (
    <GameProvider session={session} participants={participants}>
      {userRole === 'admin' && <module.AdminComponent />}
      {userRole === 'participant' && <module.ParticipantComponent />}
    </GameProvider>
  )
}

export const ParticipantGrid = ({ participants, maxVisible = 16 }) => {
  const visibleParticipants = participants.slice(0, maxVisible)
  const hiddenCount = Math.max(0, participants.length - maxVisible)

  return (
    <div className="grid grid-cols-4 gap-2 p-4">
      {visibleParticipants.map(participant => (
        <ParticipantCard key={participant.id} participant={participant} />
      ))}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg">
          <span className="text-sm text-gray-600">+{hiddenCount} more</span>
        </div>
      )}
    </div>
  )
}

export const GameTimer = ({ duration, onComplete, isPaused = false }) => {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [isActive, setIsActive] = useState(!isPaused)

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return

    const interval = setInterval(() => {
      setTimeLeft(time => {
        if (time <= 1) {
          onComplete?.()
          return 0
        }
        return time - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, timeLeft, onComplete])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <div className={`text-4xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  )
}
```

## Enhanced Quiz System

Building on the existing robust quiz foundation with advanced features and mechanics.

### Core Features
- **Streak Multipliers**: 2x points for 3+ consecutive correct answers
- **Speed Bonuses**: Extra points for quick responses (within 25% of time limit)
- **Hint System**: 50/50 elimination, audience polls, expert explanations
- **Confidence Scoring**: Participants rate their answer confidence for bonus points
- **Team Modes**: Collaborative scoring for group training sessions
- **Photo Questions**: Image-based questions with zoom and annotation
- **Explanation Phases**: Optional detailed explanations after each question

### Enhanced Scoring Algorithm

```javascript
// QuizScoringSystem.js
export class QuizScoringSystem {
  constructor(config = {}) {
    this.basePoints = config.basePoints || 100
    this.speedBonusThreshold = config.speedBonusThreshold || 0.25
    this.speedBonusMultiplier = config.speedBonusMultiplier || 1.5
    this.streakMultiplier = config.streakMultiplier || 2.0
    this.streakThreshold = config.streakThreshold || 3
    this.confidenceBonus = config.confidenceBonus || 0.2
  }

  calculateScore(answer, question, participant) {
    if (!answer.isCorrect) {
      return {
        points: 0,
        breakdown: [{ type: 'incorrect', points: 0 }],
        newStreak: 0
      }
    }

    let points = this.basePoints
    const breakdown = [{ type: 'base', points: this.basePoints }]

    // Speed bonus
    const timePercentage = answer.timeTaken / question.timeLimit
    if (timePercentage <= this.speedBonusThreshold) {
      const speedBonus = Math.round(this.basePoints * (this.speedBonusMultiplier - 1))
      points += speedBonus
      breakdown.push({ type: 'speed', points: speedBonus })
    }

    // Streak bonus
    const newStreak = participant.currentStreak + 1
    if (newStreak >= this.streakThreshold) {
      const streakBonus = Math.round(this.basePoints * (this.streakMultiplier - 1))
      points += streakBonus
      breakdown.push({ type: 'streak', points: streakBonus, streak: newStreak })
    }

    // Confidence bonus
    if (answer.confidence && answer.confidence >= 4) {
      const confidenceBonus = Math.round(this.basePoints * this.confidenceBonus)
      points += confidenceBonus
      breakdown.push({ type: 'confidence', points: confidenceBonus })
    }

    return {
      points,
      breakdown,
      newStreak
    }
  }
}
```

### Hint System Implementation

```javascript
// QuizHintSystem.js
export class QuizHintSystem {
  constructor(session) {
    this.session = session
    this.availableHints = ['5050', 'audience', 'expert']
  }

  async use5050Hint(questionId) {
    const question = this.session.questions.find(q => q.id === questionId)
    const correctIndex = question.correctAnswer
    const incorrectOptions = question.options
      .map((option, index) => index)
      .filter(index => index !== correctIndex)

    // Randomly select 2 incorrect options to eliminate
    const toEliminate = this.shuffleArray(incorrectOptions).slice(0, 2)

    return {
      type: '5050',
      eliminatedOptions: toEliminate,
      remainingOptions: question.options.map((option, index) =>
        toEliminate.includes(index) ? null : option
      )
    }
  }

  async useAudienceHint(questionId) {
    // Get real-time audience poll
    const audiencePollRef = doc(db, 'sessions', this.session.id, 'audience_polls', questionId)
    const pollData = await getDoc(audiencePollRef)

    if (!pollData.exists()) {
      return { type: 'audience', error: 'No audience poll data available' }
    }

    const votes = pollData.data().votes || {}
    const total = Object.values(votes).reduce((sum, count) => sum + count, 0)

    return {
      type: 'audience',
      results: Object.entries(votes).map(([option, count]) => ({
        option: parseInt(option),
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        count
      }))
    }
  }

  async useExpertHint(questionId) {
    const question = this.session.questions.find(q => q.id === questionId)

    return {
      type: 'expert',
      explanation: question.expertHint || question.explanation,
      confidence: question.expertConfidence || 'high'
    }
  }

  shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}
```

### Quiz Data Schema

```javascript
// Enhanced Quiz Schema
const EnhancedQuizSchema = {
  id: "quiz_uuid",
  title: "Advanced Safety Compliance",
  description: "Comprehensive safety training reinforcement",
  settings: {
    timeLimit: 30, // seconds per question
    allowHints: true,
    confidenceScoring: true,
    teamMode: false,
    showExplanations: true,
    shuffleQuestions: true,
    passingScore: 70
  },
  questions: [
    {
      id: "q1",
      type: "multiple_choice", // multiple_choice | true_false | image_choice
      question: "What is the minimum PPE required in high-risk areas?",
      image: "https://storage.googleapis.com/...", // optional
      options: [
        "Hard hat and safety glasses",
        "Hard hat, safety glasses, and steel-toed boots",
        "Hard hat, safety glasses, steel-toed boots, and hi-vis vest",
        "Full hazmat suit"
      ],
      correctAnswer: 2,
      explanation: "High-risk areas require complete basic PPE for maximum protection.",
      expertHint: "Consider what protects the most vulnerable body parts.",
      expertConfidence: "high",
      difficulty: "medium",
      timeLimit: 30, // can override default
      category: "PPE Requirements"
    }
  ],
  analytics: {
    averageScore: 0,
    completionRate: 0,
    difficultQuestions: [],
    commonMistakes: []
  }
}
```

## Who Wants to be a Millionaire

A dramatic game show format that creates excitement while reinforcing training concepts.

### Game Mechanics
- **15 Questions** with increasing difficulty and point values
- **Money Tree**: $100, $200, $300, $500, $1,000... up to $1,000,000 (virtual points)
- **Three Lifelines**: 50/50, Phone-a-Friend (team poll), Ask the Audience
- **Safety Nets** at $1,000 and $32,000 (questions 5 and 10)
- **Walk Away** option to secure current winnings
- **Final Answer** confirmation with dramatic reveal

### Point Values & Difficulty Progression

```javascript
// MillionaireGameConfig.js
export const MILLIONAIRE_MONEY_TREE = [
  { level: 1, value: 100, difficulty: 'easy', safetyNet: false },
  { level: 2, value: 200, difficulty: 'easy', safetyNet: false },
  { level: 3, value: 300, difficulty: 'easy', safetyNet: false },
  { level: 4, value: 500, difficulty: 'easy', safetyNet: false },
  { level: 5, value: 1000, difficulty: 'easy', safetyNet: true },
  { level: 6, value: 2000, difficulty: 'medium', safetyNet: false },
  { level: 7, value: 4000, difficulty: 'medium', safetyNet: false },
  { level: 8, value: 8000, difficulty: 'medium', safetyNet: false },
  { level: 9, value: 16000, difficulty: 'medium', safetyNet: false },
  { level: 10, value: 32000, difficulty: 'medium', safetyNet: true },
  { level: 11, value: 64000, difficulty: 'hard', safetyNet: false },
  { level: 12, value: 125000, difficulty: 'hard', safetyNet: false },
  { level: 13, value: 250000, difficulty: 'hard', safetyNet: false },
  { level: 14, value: 500000, difficulty: 'hard', safetyNet: false },
  { level: 15, value: 1000000, difficulty: 'expert', safetyNet: false }
]

export class MillionaireGame {
  constructor(sessionId, questions) {
    this.sessionId = sessionId
    this.questions = this.sortQuestionsByDifficulty(questions)
    this.currentLevel = 1
    this.participants = new Map()
    this.lifelines = ['5050', 'audience', 'phone']
  }

  async startGame() {
    await this.updateSessionState({
      status: 'active',
      currentLevel: 1,
      currentQuestion: this.questions[0],
      startTime: serverTimestamp()
    })

    // Play dramatic intro music
    this.playSound('millionaire_intro')
  }

  async presentQuestion(level) {
    const question = this.questions[level - 1]
    const moneyValue = MILLIONAIRE_MONEY_TREE[level - 1].value

    await this.updateSessionState({
      currentLevel: level,
      currentQuestion: question,
      questionStartTime: serverTimestamp(),
      status: 'question_active'
    })

    // Dramatic question reveal
    this.playSound('question_intro')

    return {
      question,
      level,
      value: moneyValue,
      timeLimit: 60 // More time for dramatic effect
    }
  }

  async submitAnswer(participantId, answer, isWalkAway = false) {
    const participant = this.participants.get(participantId)
    const currentQuestion = this.questions[this.currentLevel - 1]

    if (isWalkAway) {
      return await this.handleWalkAway(participantId)
    }

    const isCorrect = answer === currentQuestion.correctAnswer
    const currentValue = MILLIONAIRE_MONEY_TREE[this.currentLevel - 1].value

    if (isCorrect) {
      participant.currentWinnings = currentValue
      participant.questionsAnswered = this.currentLevel

      // Check if they've won the game
      if (this.currentLevel === 15) {
        participant.status = 'millionaire'
        this.playSound('millionaire_win')
      } else {
        this.playSound('correct_answer')
      }
    } else {
      // Wrong answer - fall back to safety net
      const safetyNet = this.findSafetyNet(this.currentLevel)
      participant.currentWinnings = safetyNet
      participant.status = 'eliminated'
      this.playSound('wrong_answer')
    }

    await this.updateParticipant(participantId, participant)
    return { isCorrect, newWinnings: participant.currentWinnings }
  }

  async useLifeline(participantId, lifelineType) {
    const participant = this.participants.get(participantId)

    if (participant.lifelinesUsed.includes(lifelineType)) {
      throw new Error('Lifeline already used')
    }

    participant.lifelinesUsed.push(lifelineType)

    let result
    switch (lifelineType) {
      case '5050':
        result = await this.use5050()
        break
      case 'audience':
        result = await this.useAudiencePoll()
        break
      case 'phone':
        result = await this.usePhoneAFriend()
        break
    }

    await this.updateParticipant(participantId, participant)
    this.playSound(`lifeline_${lifelineType}`)

    return result
  }

  findSafetyNet(level) {
    const safetyNets = MILLIONAIRE_MONEY_TREE
      .filter(item => item.safetyNet && item.level < level)
      .sort((a, b) => b.level - a.level)

    return safetyNets.length > 0 ? safetyNets[0].value : 0
  }
}
```

### Real-time Audience Polling

```javascript
// MillionaireAudiencePoll.js
export class MillionaireAudiencePoll {
  constructor(sessionId, questionId) {
    this.sessionId = sessionId
    this.questionId = questionId
    this.pollRef = doc(db, 'sessions', sessionId, 'audience_polls', questionId)
  }

  async initializePoll() {
    await setDoc(this.pollRef, {
      votes: { A: 0, B: 0, C: 0, D: 0 },
      totalVotes: 0,
      isActive: true,
      startTime: serverTimestamp()
    })
  }

  async submitVote(participantId, vote) {
    // Prevent duplicate voting
    const participantVoteRef = doc(
      db, 'sessions', this.sessionId, 'audience_polls', this.questionId, 'voters', participantId
    )

    const existingVote = await getDoc(participantVoteRef)
    if (existingVote.exists()) {
      throw new Error('Already voted in this poll')
    }

    // Record the vote
    await setDoc(participantVoteRef, { vote, timestamp: serverTimestamp() })

    // Update poll totals
    await updateDoc(this.pollRef, {
      [`votes.${vote}`]: increment(1),
      totalVotes: increment(1)
    })
  }

  async getResults() {
    const pollData = await getDoc(this.pollRef)
    if (!pollData.exists()) return null

    const data = pollData.data()
    const total = data.totalVotes || 0

    return {
      votes: data.votes,
      percentages: Object.entries(data.votes).reduce((acc, [option, count]) => {
        acc[option] = total > 0 ? Math.round((count / total) * 100) : 0
        return acc
      }, {}),
      totalVotes: total
    }
  }

  // Real-time subscription for live updates
  onResultsUpdate(callback) {
    return onSnapshot(this.pollRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        const total = data.totalVotes || 0

        const results = {
          votes: data.votes,
          percentages: Object.entries(data.votes).reduce((acc, [option, count]) => {
            acc[option] = total > 0 ? Math.round((count / total) * 100) : 0
            return acc
          }, {}),
          totalVotes: total
        }

        callback(results)
      }
    })
  }
}
```

### Millionaire UI Components

```javascript
// MillionaireComponents.jsx
export const MillionaireMoneyTree = ({ currentLevel, participantWinnings }) => {
  return (
    <div className="money-tree bg-gradient-to-b from-blue-900 to-purple-900 p-6 rounded-lg">
      <h3 className="text-yellow-400 text-xl font-bold mb-4">Money Tree</h3>
      <div className="space-y-2">
        {MILLIONAIRE_MONEY_TREE.slice().reverse().map((level) => {
          const isCurrent = level.level === currentLevel
          const isCompleted = level.level < currentLevel
          const isWinnings = level.value <= participantWinnings

          return (
            <div
              key={level.level}
              className={`
                flex justify-between items-center px-4 py-2 rounded
                ${isCurrent ? 'bg-yellow-400 text-black animate-pulse' : ''}
                ${isCompleted ? 'bg-green-600 text-white' : ''}
                ${!isCurrent && !isCompleted ? 'bg-gray-700 text-gray-300' : ''}
                ${level.safetyNet ? 'border-2 border-yellow-400' : ''}
              `}
            >
              <span className="font-bold">{level.level}</span>
              <span className="font-mono">
                ${level.value.toLocaleString()}
              </span>
              {level.safetyNet && (
                <span className="text-yellow-400 text-xs">SAFE</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const MillionaireLifelines = ({ availableLifelines, onUseLifeline }) => {
  const lifelineIcons = {
    '5050': '½',
    'audience': '👥',
    'phone': '📞'
  }

  const lifelineNames = {
    '5050': '50:50',
    'audience': 'Ask Audience',
    'phone': 'Phone a Friend'
  }

  return (
    <div className="lifelines flex space-x-4">
      {Object.entries(lifelineNames).map(([type, name]) => {
        const isUsed = !availableLifelines.includes(type)

        return (
          <button
            key={type}
            onClick={() => !isUsed && onUseLifeline(type)}
            disabled={isUsed}
            className={`
              lifeline-button flex flex-col items-center p-4 rounded-lg transition-all
              ${isUsed
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                : 'bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105'
              }
            `}
          >
            <span className="text-2xl mb-2">{lifelineIcons[type]}</span>
            <span className="text-sm">{name}</span>
            {isUsed && <span className="text-xs text-red-400 mt-1">USED</span>}
          </button>
        )
      })}
    </div>
  )
}

export const MillionaireFinalAnswer = ({ question, selectedAnswer, onConfirm, onCancel }) => {
  return (
    <div className="final-answer-modal fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-6 text-orange-600">
          Final Answer?
        </h2>

        <div className="question-review mb-6">
          <p className="text-lg mb-4">{question.question}</p>
          <div className="selected-answer bg-yellow-100 p-4 rounded border-l-4 border-yellow-500">
            <p className="font-semibold">Your Answer:</p>
            <p className="text-lg">{question.options[selectedAnswer]}</p>
          </div>
        </div>

        <div className="actions flex space-x-4">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Let me reconsider
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-colors font-bold"
          >
            Final Answer!
          </button>
        </div>
      </div>
    </div>
  )
}
```

## Training Bingo

An engaging way to reinforce key training concepts through pattern recognition and active listening.

### Game Features
- **Custom Bingo Cards** generated from training keywords/concepts
- **Multiple Win Patterns**: Traditional line, four corners, full house, custom shapes
- **Real-time Marking** as trainer mentions concepts during debrief
- **Progressive Jackpots** for different completion levels
- **Team Bingo** option for collaborative sessions
- **Auto-detection** of winning patterns with celebrations

### Bingo Card Generation

```javascript
// BingoCardGenerator.js
export class BingoCardGenerator {
  constructor(keywordPool, cardSize = 5) {
    this.keywordPool = keywordPool
    this.cardSize = cardSize
    this.totalCells = cardSize * cardSize
    this.freeSpacePosition = Math.floor(this.totalCells / 2) // Center cell
  }

  generateCard(participantId) {
    // Ensure each participant gets a unique but fair distribution
    const shuffledKeywords = this.shuffleWithSeed(this.keywordPool, participantId)
    const selectedKeywords = shuffledKeywords.slice(0, this.totalCells - 1) // -1 for FREE space

    const card = []
    let keywordIndex = 0

    for (let row = 0; row < this.cardSize; row++) {
      const cardRow = []
      for (let col = 0; col < this.cardSize; col++) {
        const position = row * this.cardSize + col

        if (position === this.freeSpacePosition) {
          cardRow.push({ text: 'FREE', type: 'free', marked: true })
        } else {
          const keyword = selectedKeywords[keywordIndex++]
          cardRow.push({
            text: keyword.text,
            type: keyword.type || 'concept',
            marked: false,
            id: keyword.id
          })
        }
      }
      card.push(cardRow)
    }

    return {
      participantId,
      card,
      markedCount: 1, // FREE space
      completedPatterns: [],
      generated: serverTimestamp()
    }
  }

  // Deterministic shuffle based on participant ID for fairness
  shuffleWithSeed(array, seed) {
    const rng = this.seededRandom(this.hashCode(seed))
    const shuffled = [...array]

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    return shuffled
  }

  hashCode(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  seededRandom(seed) {
    let state = seed
    return function() {
      state = (state * 1664525 + 1013904223) % 0x100000000
      return state / 0x100000000
    }
  }
}

// Training-specific keyword pools
export const SAFETY_TRAINING_KEYWORDS = [
  { id: 'ppe', text: 'PPE', type: 'equipment' },
  { id: 'hazard', text: 'Hazard Identification', type: 'concept' },
  { id: 'lockout', text: 'Lockout/Tagout', type: 'procedure' },
  { id: 'msds', text: 'Safety Data Sheet', type: 'documentation' },
  { id: 'incident', text: 'Incident Reporting', type: 'procedure' },
  { id: 'emergency', text: 'Emergency Procedures', type: 'procedure' },
  { id: 'risk', text: 'Risk Assessment', type: 'concept' },
  { id: 'compliance', text: 'Regulatory Compliance', type: 'concept' },
  { id: 'training', text: 'Safety Training', type: 'concept' },
  { id: 'inspection', text: 'Safety Inspection', type: 'procedure' },
  { id: 'communication', text: 'Safety Communication', type: 'concept' },
  { id: 'culture', text: 'Safety Culture', type: 'concept' },
  { id: 'leadership', text: 'Safety Leadership', type: 'concept' },
  { id: 'accountability', text: 'Personal Accountability', type: 'concept' },
  { id: 'prevention', text: 'Accident Prevention', type: 'concept' },
  { id: 'wellness', text: 'Employee Wellness', type: 'concept' },
  { id: 'ergonomics', text: 'Ergonomics', type: 'concept' },
  { id: 'environment', text: 'Environmental Safety', type: 'concept' },
  { id: 'chemical', text: 'Chemical Safety', type: 'concept' },
  { id: 'electrical', text: 'Electrical Safety', type: 'concept' },
  { id: 'fire', text: 'Fire Safety', type: 'concept' },
  { id: 'confined', text: 'Confined Spaces', type: 'concept' },
  { id: 'height', text: 'Working at Height', type: 'concept' },
  { id: 'machinery', text: 'Machinery Safety', type: 'concept' },
  { id: 'transport', text: 'Transport Safety', type: 'concept' }
]
```

### Bingo Pattern Detection

```javascript
// BingoPatternDetector.js
export class BingoPatternDetector {
  constructor(cardSize = 5) {
    this.cardSize = cardSize
    this.patterns = this.generatePatterns()
  }

  generatePatterns() {
    const patterns = {}

    // Horizontal lines
    for (let row = 0; row < this.cardSize; row++) {
      patterns[`row_${row}`] = {
        name: `Row ${row + 1}`,
        points: 100,
        cells: Array.from({ length: this.cardSize }, (_, col) => [row, col])
      }
    }

    // Vertical lines
    for (let col = 0; col < this.cardSize; col++) {
      patterns[`col_${col}`] = {
        name: `Column ${col + 1}`,
        points: 100,
        cells: Array.from({ length: this.cardSize }, (_, row) => [row, col])
      }
    }

    // Diagonals
    patterns.diagonal_main = {
      name: 'Main Diagonal',
      points: 150,
      cells: Array.from({ length: this.cardSize }, (_, i) => [i, i])
    }

    patterns.diagonal_anti = {
      name: 'Anti Diagonal',
      points: 150,
      cells: Array.from({ length: this.cardSize }, (_, i) => [i, this.cardSize - 1 - i])
    }

    // Four corners
    patterns.four_corners = {
      name: 'Four Corners',
      points: 200,
      cells: [
        [0, 0], [0, this.cardSize - 1],
        [this.cardSize - 1, 0], [this.cardSize - 1, this.cardSize - 1]
      ]
    }

    // Full house
    patterns.full_house = {
      name: 'Full House',
      points: 500,
      cells: Array.from({ length: this.cardSize }, (_, row) =>
        Array.from({ length: this.cardSize }, (_, col) => [row, col])
      ).flat()
    }

    // Custom patterns
    patterns.cross = {
      name: 'Cross',
      points: 300,
      cells: [
        ...Array.from({ length: this.cardSize }, (_, i) => [2, i]), // Middle row
        ...Array.from({ length: this.cardSize }, (_, i) => [i, 2])  // Middle column
      ].filter((cell, index, arr) =>
        arr.findIndex(c => c[0] === cell[0] && c[1] === cell[1]) === index
      )
    }

    patterns.x_pattern = {
      name: 'X Pattern',
      points: 400,
      cells: [
        ...Array.from({ length: this.cardSize }, (_, i) => [i, i]), // Main diagonal
        ...Array.from({ length: this.cardSize }, (_, i) => [i, this.cardSize - 1 - i]) // Anti diagonal
      ].filter((cell, index, arr) =>
        arr.findIndex(c => c[0] === cell[0] && c[1] === cell[1]) === index
      )
    }

    return patterns
  }

  checkForNewWins(card, previouslyWon = []) {
    const newWins = []

    for (const [patternId, pattern] of Object.entries(this.patterns)) {
      if (previouslyWon.includes(patternId)) continue

      const isComplete = pattern.cells.every(([row, col]) =>
        card[row] && card[row][col] && card[row][col].marked
      )

      if (isComplete) {
        newWins.push({
          patternId,
          name: pattern.name,
          points: pattern.points,
          cells: pattern.cells,
          timestamp: Date.now()
        })
      }
    }

    return newWins
  }

  getPatternHighlight(patternId) {
    const pattern = this.patterns[patternId]
    if (!pattern) return []

    return pattern.cells.map(([row, col]) => ({ row, col }))
  }
}
```

### Real-time Bingo Marking

```javascript
// BingoSessionManager.js
export class BingoSessionManager {
  constructor(sessionId) {
    this.sessionId = sessionId
    this.patternDetector = new BingoPatternDetector()
    this.winners = new Map()
  }

  async markCell(participantId, row, col) {
    const participantRef = doc(
      db, 'sessions', this.sessionId, 'participants', participantId
    )

    // Update the marked cell
    await updateDoc(participantRef, {
      [`card.${row}.${col}.marked`]: true,
      [`card.${row}.${col}.markedAt`]: serverTimestamp(),
      lastActivity: serverTimestamp()
    })

    // Get updated card and check for wins
    const participantDoc = await getDoc(participantRef)
    const participantData = participantDoc.data()

    const newWins = this.patternDetector.checkForNewWins(
      participantData.card,
      participantData.completedPatterns || []
    )

    if (newWins.length > 0) {
      await this.handleNewWins(participantId, newWins)
    }

    return {
      marked: true,
      newWins: newWins.length > 0 ? newWins : null
    }
  }

  async handleNewWins(participantId, newWins) {
    const participantRef = doc(
      db, 'sessions', this.sessionId, 'participants', participantId
    )

    const totalPoints = newWins.reduce((sum, win) => sum + win.points, 0)

    // Update participant with new wins
    await updateDoc(participantRef, {
      completedPatterns: arrayUnion(...newWins.map(w => w.patternId)),
      totalPoints: increment(totalPoints),
      wins: arrayUnion(...newWins),
      lastWin: serverTimestamp()
    })

    // Announce the win to all participants
    await this.announceWin(participantId, newWins)

    // Play celebration sound
    this.playCelebrationSound(newWins)
  }

  async announceWin(participantId, newWins) {
    const announcementRef = doc(
      db, 'sessions', this.sessionId, 'announcements', `win_${Date.now()}`
    )

    await setDoc(announcementRef, {
      type: 'bingo_win',
      participantId,
      participantName: await this.getParticipantName(participantId),
      wins: newWins,
      timestamp: serverTimestamp()
    })
  }

  playCelebrationSound(wins) {
    // Different sounds for different achievements
    if (wins.some(w => w.patternId === 'full_house')) {
      this.playSound('bingo_jackpot')
    } else if (wins.length > 1) {
      this.playSound('bingo_multi_win')
    } else {
      this.playSound('bingo_win')
    }
  }

  // Auto-marking feature for trainer-called items
  async autoMarkKeyword(keyword) {
    const sessionRef = doc(db, 'sessions', this.sessionId)
    const sessionDoc = await getDoc(sessionRef)

    if (!sessionDoc.exists()) return

    // Find all participants with this keyword
    const participantsSnapshot = await getDocs(
      collection(db, 'sessions', this.sessionId, 'participants')
    )

    const batch = writeBatch(db)
    const markedParticipants = []

    participantsSnapshot.docs.forEach(doc => {
      const participantData = doc.data()
      const card = participantData.card

      // Find the keyword in the participant's card
      for (let row = 0; row < card.length; row++) {
        for (let col = 0; col < card[row].length; col++) {
          const cell = card[row][col]

          if (cell.text.toLowerCase().includes(keyword.toLowerCase()) && !cell.marked) {
            batch.update(doc.ref, {
              [`card.${row}.${col}.marked`]: true,
              [`card.${row}.${col}.markedAt`]: serverTimestamp(),
              [`card.${row}.${col}.autoMarked`]: true,
              lastActivity: serverTimestamp()
            })

            markedParticipants.push({
              participantId: doc.id,
              row,
              col,
              keyword: cell.text
            })
          }
        }
      }
    })

    if (markedParticipants.length > 0) {
      await batch.commit()

      // Check for new wins after auto-marking
      for (const marked of markedParticipants) {
        setTimeout(() => this.checkForWinsAfterAutoMark(marked.participantId), 100)
      }
    }

    return markedParticipants
  }
}
```

## Speed Rounds Challenge

Fast-paced mini-questions designed to reinforce key concepts through rapid recall.

### Game Mechanics
- **30-60 Second Rounds** with 10-15 rapid-fire questions
- **Decreasing Points** with time (encourages quick thinking)
- **Simultaneous Competition** - all participants compete at once
- **Category-Based** rounds (Safety, Compliance, Procedures, etc.)
- **Streak Bonuses** for consecutive correct answers
- **Lightning Rounds** with bonus multipliers

### Speed Round Implementation

```javascript
// SpeedRoundGame.js
export class SpeedRoundGame {
  constructor(sessionId, questions, config = {}) {
    this.sessionId = sessionId
    this.questions = questions
    this.config = {
      roundDuration: config.roundDuration || 30,
      maxPoints: config.maxPoints || 100,
      minPoints: config.minPoints || 10,
      streakBonus: config.streakBonus || 50,
      questionsPerRound: config.questionsPerRound || 10,
      ...config
    }
  }

  async startSpeedRound(roundNumber) {
    const roundQuestions = this.selectQuestionsForRound(roundNumber)

    await this.updateSessionState({
      status: 'speed_round_active',
      currentRound: roundNumber,
      questions: roundQuestions,
      startTime: serverTimestamp(),
      endTime: new Date(Date.now() + this.config.roundDuration * 1000)
    })

    // Start countdown timer
    this.startRoundTimer()

    return roundQuestions
  }

  selectQuestionsForRound(roundNumber) {
    // Select questions based on difficulty progression
    const difficulty = this.getDifficultyForRound(roundNumber)
    const availableQuestions = this.questions.filter(q => q.difficulty === difficulty)

    return this.shuffleArray(availableQuestions)
      .slice(0, this.config.questionsPerRound)
      .map((question, index) => ({
        ...question,
        roundPosition: index + 1,
        maxPoints: this.calculateMaxPointsForPosition(index + 1)
      }))
  }

  calculateMaxPointsForPosition(position) {
    // Points decrease as round progresses to encourage speed
    const pointsDecay = (position - 1) / this.config.questionsPerRound
    return Math.max(
      this.config.minPoints,
      Math.round(this.config.maxPoints * (1 - pointsDecay * 0.7))
    )
  }

  async submitSpeedAnswer(participantId, questionIndex, answer, timestamp) {
    const participant = await this.getParticipant(participantId)
    const question = this.currentQuestions[questionIndex]
    const roundStartTime = this.roundStartTime

    // Calculate time-based scoring
    const timeElapsed = (timestamp - roundStartTime) / 1000
    const timeForThisQuestion = timeElapsed - (questionIndex * (this.config.roundDuration / this.config.questionsPerRound))

    const isCorrect = answer === question.correctAnswer
    let points = 0

    if (isCorrect) {
      // Base points decay with time
      const timeDecay = Math.min(timeForThisQuestion / (this.config.roundDuration / this.config.questionsPerRound), 1)
      points = Math.round(question.maxPoints * (1 - timeDecay * 0.8))

      // Streak bonus
      const currentStreak = participant.currentStreak + 1
      if (currentStreak >= 3) {
        points += this.config.streakBonus
      }

      participant.currentStreak = currentStreak
      participant.totalCorrect += 1
    } else {
      participant.currentStreak = 0
    }

    participant.totalPoints += points
    participant.answers.push({
      questionIndex,
      answer,
      isCorrect,
      points,
      timeTaken: timeForThisQuestion,
      timestamp
    })

    await this.updateParticipant(participantId, participant)

    return {
      isCorrect,
      points,
      streak: participant.currentStreak,
      totalPoints: participant.totalPoints
    }
  }

  startRoundTimer() {
    this.timerInterval = setInterval(async () => {
      const now = Date.now()
      const endTime = this.roundEndTime

      if (now >= endTime) {
        await this.endSpeedRound()
        clearInterval(this.timerInterval)
      } else {
        // Update remaining time for all participants
        await this.updateSessionState({
          timeRemaining: Math.max(0, Math.ceil((endTime - now) / 1000))
        })
      }
    }, 1000)
  }

  async endSpeedRound() {
    // Calculate final rankings
    const participants = await this.getAllParticipants()
    const rankings = participants
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((participant, index) => ({
        ...participant,
        rank: index + 1,
        percentile: Math.round((participants.length - index) / participants.length * 100)
      }))

    await this.updateSessionState({
      status: 'speed_round_completed',
      rankings,
      endTime: serverTimestamp()
    })

    // Award achievement badges
    await this.awardSpeedRoundAchievements(rankings)
  }

  async awardSpeedRoundAchievements(rankings) {
    const achievements = []

    // Speed Demon - Top 10% with high streak
    const speedDemons = rankings
      .filter(p => p.percentile >= 90 && p.maxStreak >= 5)
      .map(p => ({ participantId: p.id, achievement: 'Speed Demon' }))

    // Quick Draw - Fastest average response time
    const fastestResponder = rankings
      .reduce((fastest, current) =>
        current.averageTime < fastest.averageTime ? current : fastest
      )
    if (fastestResponder) {
      achievements.push({ participantId: fastestResponder.id, achievement: 'Quick Draw' })
    }

    // Streak Master - Longest streak
    const streakMaster = rankings
      .reduce((longest, current) =>
        current.maxStreak > longest.maxStreak ? current : longest
      )
    if (streakMaster && streakMaster.maxStreak >= 7) {
      achievements.push({ participantId: streakMaster.id, achievement: 'Streak Master' })
    }

    // Save achievements
    const batch = writeBatch(db)
    achievements.forEach(({ participantId, achievement }) => {
      const achievementRef = doc(
        db, 'sessions', this.sessionId, 'participants', participantId, 'achievements', achievement
      )
      batch.set(achievementRef, {
        achievement,
        awardedAt: serverTimestamp(),
        roundNumber: this.currentRound
      })
    })

    await batch.commit()
    return achievements
  }
}
```

## Training Jeopardy

A quiz format where participants must phrase their responses as questions, encouraging deeper thinking about training concepts.

### Game Mechanics
- **Six Categories** of training-related topics
- **Point Values**: 100, 200, 300, 400, 500 per category
- **Daily Double**: Random high-value questions with wagering
- **Final Jeopardy**: All-in wagering on final category
- **Answer-in-Question Format**: "What is...?" or "Who is...?"
- **Team Play Option**: Collaborative category selection

### Jeopardy Implementation

```javascript
// JeopardyGame.js
export class JeopardyGame {
  constructor(sessionId, gameBoard) {
    this.sessionId = sessionId
    this.gameBoard = gameBoard
    this.currentPlayer = null
    this.dailyDoubles = this.placeDailyDoubles()
    this.questionsRemaining = 30 // 6 categories × 5 questions
  }

  placeDailyDoubles() {
    // Place 1-2 Daily Doubles randomly in the board
    const positions = []
    const categories = Object.keys(this.gameBoard)

    // Ensure Daily Doubles are in higher-value questions (300, 400, 500)
    const highValuePositions = []
    categories.forEach(category => {
      [300, 400, 500].forEach(value => {
        highValuePositions.push({ category, value })
      })
    })

    // Randomly select 2 positions for Daily Doubles
    const shuffled = this.shuffleArray(highValuePositions)
    return shuffled.slice(0, 2)
  }

  async selectQuestion(participantId, category, value) {
    const question = this.gameBoard[category][value]
    if (!question || question.answered) {
      throw new Error('Question not available')
    }

    // Check if this is a Daily Double
    const isDailyDouble = this.dailyDoubles.some(dd =>
      dd.category === category && dd.value === value
    )

    if (isDailyDouble) {
      return await this.handleDailyDouble(participantId, question)
    }

    // Regular question
    await this.updateSessionState({
      status: 'question_active',
      currentQuestion: {
        ...question,
        category,
        value,
        selectedBy: participantId,
        isDailyDouble: false
      },
      questionStartTime: serverTimestamp()
    })

    return { question, isDailyDouble: false }
  }

  async handleDailyDouble(participantId, question) {
    const participant = await this.getParticipant(participantId)
    const maxWager = Math.max(1000, participant.score)

    await this.updateSessionState({
      status: 'daily_double',
      currentQuestion: { ...question, isDailyDouble: true },
      wageringPlayer: participantId,
      maxWager,
      wagerDeadline: new Date(Date.now() + 30000) // 30 seconds to wager
    })

    return { question, isDailyDouble: true, maxWager }
  }

  async submitWager(participantId, wagerAmount) {
    const participant = await this.getParticipant(participantId)
    const maxWager = Math.max(1000, participant.score)

    if (wagerAmount > maxWager || wagerAmount < 5) {
      throw new Error('Invalid wager amount')
    }

    await this.updateSessionState({
      status: 'question_active',
      currentWager: wagerAmount,
      questionStartTime: serverTimestamp()
    })

    return { wager: wagerAmount }
  }

  async submitAnswer(participantId, answer) {
    const currentQuestion = this.currentQuestion
    const participant = await this.getParticipant(participantId)

    // Validate answer format (must be in question form)
    const isValidFormat = this.validateQuestionFormat(answer)
    const isCorrect = isValidFormat && this.checkAnswer(answer, currentQuestion.correctAnswer)

    let pointChange = 0
    if (currentQuestion.isDailyDouble) {
      pointChange = isCorrect ? this.currentWager : -this.currentWager
    } else {
      pointChange = isCorrect ? currentQuestion.value : -currentQuestion.value
    }

    // Update participant score
    participant.score += pointChange
    participant.questionsAnswered += 1

    if (isCorrect) {
      participant.correctAnswers += 1
      // Correct answerer selects next question
      this.currentPlayer = participantId
    }

    await this.updateParticipant(participantId, participant)

    // Mark question as answered
    this.gameBoard[currentQuestion.category][currentQuestion.value].answered = true
    this.questionsRemaining -= 1

    // Check if board is complete
    if (this.questionsRemaining === 0) {
      await this.startFinalJeopardy()
    }

    return {
      isCorrect,
      pointChange,
      newScore: participant.score,
      canSelectNext: isCorrect
    }
  }

  validateQuestionFormat(answer) {
    const questionStarters = [
      /^what is/i,
      /^what are/i,
      /^who is/i,
      /^who are/i,
      /^where is/i,
      /^where are/i,
      /^when is/i,
      /^when are/i,
      /^how is/i,
      /^how are/i,
      /^why is/i,
      /^why are/i
    ]

    return questionStarters.some(pattern => pattern.test(answer.trim()))
  }

  async startFinalJeopardy() {
    const participants = await this.getAllParticipants()
    const eligibleParticipants = participants.filter(p => p.score > 0)

    await this.updateSessionState({
      status: 'final_jeopardy',
      finalJeopardyQuestion: this.finalJeopardyQuestion,
      eligibleParticipants: eligibleParticipants.map(p => p.id),
      wagerDeadline: new Date(Date.now() + 60000), // 60 seconds to wager
      answerDeadline: new Date(Date.now() + 120000) // 2 minutes total
    })
  }

  async submitFinalJeopardyWager(participantId, wager) {
    const participant = await this.getParticipant(participantId)
    const maxWager = participant.score

    if (wager > maxWager || wager < 0) {
      throw new Error('Invalid final jeopardy wager')
    }

    await updateDoc(
      doc(db, 'sessions', this.sessionId, 'participants', participantId),
      {
        finalJeopardyWager: wager,
        finalJeopardyStatus: 'wagered'
      }
    )
  }

  async submitFinalJeopardyAnswer(participantId, answer) {
    const participant = await this.getParticipant(participantId)
    const isCorrect = this.validateQuestionFormat(answer) &&
                     this.checkAnswer(answer, this.finalJeopardyQuestion.correctAnswer)

    const pointChange = isCorrect ? participant.finalJeopardyWager : -participant.finalJeopardyWager
    const finalScore = participant.score + pointChange

    await updateDoc(
      doc(db, 'sessions', this.sessionId, 'participants', participantId),
      {
        finalJeopardyAnswer: answer,
        finalJeopardyCorrect: isCorrect,
        finalJeopardyPointChange: pointChange,
        finalScore,
        finalJeopardyStatus: 'completed'
      }
    )

    return { isCorrect, pointChange, finalScore }
  }
}

// Jeopardy Board Configuration
export const TRAINING_JEOPARDY_BOARD = {
  "Safety Procedures": {
    100: {
      answer: "This protective equipment must be worn in all high-risk areas",
      question: "What is PPE (Personal Protective Equipment)?",
      category: "Safety Procedures"
    },
    200: {
      answer: "This process ensures equipment is safely shut down before maintenance",
      question: "What is lockout/tagout?",
      category: "Safety Procedures"
    },
    // ... more questions
  },
  "Compliance Standards": {
    100: {
      answer: "This federal agency sets workplace safety standards in the US",
      question: "What is OSHA?",
      category: "Compliance Standards"
    },
    // ... more questions
  },
  "Emergency Response": {
    // ... questions
  },
  "Risk Management": {
    // ... questions
  },
  "Training Requirements": {
    // ... questions
  },
  "Best Practices": {
    // ... questions
  }
}
```

## Technical Implementation

### Module Loading System

```javascript
// GameModuleManager.js
export class GameModuleManager {
  constructor() {
    this.loadedModules = new Map()
    this.subscriptionCache = new Map()
  }

  async loadModule(gameType, organizationId) {
    // Check subscription access
    const subscription = await this.getOrganizationSubscription(organizationId)
    if (!subscription.modules.includes(gameType)) {
      throw new Error(`Module '${gameType}' not available in current subscription`)
    }

    // Return cached module if available
    if (this.loadedModules.has(gameType)) {
      return this.loadedModules.get(gameType)
    }

    // Dynamic import based on game type
    let moduleLoader
    switch (gameType) {
      case 'quiz':
        moduleLoader = () => import('./modules/QuizModule')
        break
      case 'millionaire':
        moduleLoader = () => import('./modules/MillionaireModule')
        break
      case 'bingo':
        moduleLoader = () => import('./modules/BingoModule')
        break
      case 'speedround':
        moduleLoader = () => import('./modules/SpeedRoundModule')
        break
      case 'jeopardy':
        moduleLoader = () => import('./modules/JeopardyModule')
        break
      case 'escaperoom':
        moduleLoader = () => import('./modules/EscapeRoomModule')
        break
      default:
        throw new Error(`Unknown game type: ${gameType}`)
    }

    try {
      const module = await moduleLoader()
      this.loadedModules.set(gameType, module.default)
      return module.default
    } catch (error) {
      console.error(`Failed to load module ${gameType}:`, error)
      throw new Error(`Failed to load game module: ${gameType}`)
    }
  }

  async getOrganizationSubscription(organizationId) {
    // Check cache first
    if (this.subscriptionCache.has(organizationId)) {
      const cached = this.subscriptionCache.get(organizationId)
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return cached.subscription
      }
    }

    // Fetch from Firestore
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId))
    if (!orgDoc.exists()) {
      throw new Error('Organization not found')
    }

    const subscription = orgDoc.data().subscription

    // Cache the result
    this.subscriptionCache.set(organizationId, {
      subscription,
      timestamp: Date.now()
    })

    return subscription
  }

  // Preload modules for better performance
  async preloadModules(organizationId) {
    const subscription = await this.getOrganizationSubscription(organizationId)

    const preloadPromises = subscription.modules.map(async (gameType) => {
      try {
        await this.loadModule(gameType, organizationId)
      } catch (error) {
        console.warn(`Failed to preload module ${gameType}:`, error)
      }
    })

    await Promise.allSettled(preloadPromises)
  }
}
```

### Universal Game Session Manager

```javascript
// UniversalGameSession.js
export class UniversalGameSession {
  constructor(sessionId, gameType, organizationId) {
    this.sessionId = sessionId
    this.gameType = gameType
    this.organizationId = organizationId
    this.moduleManager = new GameModuleManager()
    this.participants = new Map()
    this.gameInstance = null
  }

  async initialize() {
    // Load the appropriate game module
    const GameModule = await this.moduleManager.loadModule(this.gameType, this.organizationId)
    this.gameInstance = new GameModule(this.sessionId, this.organizationId)

    // Set up real-time listeners
    this.setupRealtimeListeners()

    return this.gameInstance
  }

  setupRealtimeListeners() {
    // Session state changes
    this.sessionUnsubscribe = onSnapshot(
      doc(db, 'sessions', this.sessionId),
      (doc) => this.handleSessionStateChange(doc.data())
    )

    // Participant changes
    this.participantsUnsubscribe = onSnapshot(
      collection(db, 'sessions', this.sessionId, 'participants'),
      (snapshot) => this.handleParticipantsChange(snapshot)
    )

    // Game-specific state changes
    this.gameStateUnsubscribe = onSnapshot(
      doc(db, 'sessions', this.sessionId, 'game_state', 'current'),
      (doc) => this.handleGameStateChange(doc.data())
    )
  }

  async handleParticipantJoin(participantData) {
    // Validate participation limits
    const subscription = await this.moduleManager.getOrganizationSubscription(this.organizationId)
    const currentParticipantCount = this.participants.size

    if (currentParticipantCount >= subscription.limits.maxParticipants) {
      throw new Error('Participant limit reached for current subscription')
    }

    // Add participant through game module
    await this.gameInstance.handleParticipantJoin(participantData)

    // Update local state
    this.participants.set(participantData.id, participantData)

    return { success: true, participantCount: this.participants.size + 1 }
  }

  async handleParticipantAction(participantId, action) {
    // Validate participant exists
    if (!this.participants.has(participantId)) {
      throw new Error('Participant not found')
    }

    // Rate limiting
    await this.checkRateLimit(participantId, action.type)

    // Delegate to game module
    const result = await this.gameInstance.handleParticipantAction(participantId, action)

    // Update analytics
    await this.recordAnalytics(participantId, action, result)

    return result
  }

  async checkRateLimit(participantId, actionType) {
    const rateLimits = {
      answer: { limit: 1, window: 1000 }, // 1 answer per second
      hint: { limit: 3, window: 60000 },   // 3 hints per minute
      mark: { limit: 10, window: 5000 }    // 10 marks per 5 seconds (for bingo)
    }

    const limit = rateLimits[actionType]
    if (!limit) return

    const now = Date.now()
    const key = `${participantId}:${actionType}`
    const attempts = this.rateLimitCache.get(key) || []

    // Remove old attempts
    const recentAttempts = attempts.filter(time => now - time < limit.window)

    if (recentAttempts.length >= limit.limit) {
      throw new Error(`Rate limit exceeded for ${actionType}`)
    }

    // Add current attempt
    recentAttempts.push(now)
    this.rateLimitCache.set(key, recentAttempts)
  }

  async recordAnalytics(participantId, action, result) {
    const analyticsData = {
      sessionId: this.sessionId,
      participantId,
      gameType: this.gameType,
      organizationId: this.organizationId,
      action: action.type,
      result: result.success || false,
      metadata: {
        ...action.metadata,
        ...result.metadata
      },
      timestamp: serverTimestamp()
    }

    // Batch analytics writes to avoid overwhelming Firestore
    this.analyticsQueue.push(analyticsData)

    if (this.analyticsQueue.length >= 10) {
      await this.flushAnalytics()
    }
  }

  async flushAnalytics() {
    if (this.analyticsQueue.length === 0) return

    const batch = writeBatch(db)

    this.analyticsQueue.forEach((data, index) => {
      const analyticsRef = doc(
        db, 'organizations', this.organizationId, 'analytics', `${Date.now()}_${index}`
      )
      batch.set(analyticsRef, data)
    })

    await batch.commit()
    this.analyticsQueue = []
  }

  cleanup() {
    // Unsubscribe from all listeners
    this.sessionUnsubscribe?.()
    this.participantsUnsubscribe?.()
    this.gameStateUnsubscribe?.()

    // Flush remaining analytics
    this.flushAnalytics()

    // Cleanup game instance
    this.gameInstance?.cleanup?.()
  }
}
```

## Subscription Integration

### Module Access Control

```javascript
// ModuleAccessControl.js
export class ModuleAccessControl {
  constructor(organizationId) {
    this.organizationId = organizationId
    this.subscriptionData = null
  }

  async checkModuleAccess(moduleId) {
    const subscription = await this.getSubscriptionData()

    if (!subscription || subscription.status !== 'active') {
      throw new Error('No active subscription')
    }

    if (!subscription.modules.includes(moduleId)) {
      throw new Error(`Module '${moduleId}' not included in current plan`)
    }

    // Check usage limits
    await this.checkUsageLimits(moduleId)

    return true
  }

  async checkUsageLimits(moduleId) {
    const subscription = await this.getSubscriptionData()
    const currentUsage = await this.getCurrentUsage()

    // Check participant limits
    if (currentUsage.activeParticipants >= subscription.limits.maxParticipants) {
      throw new Error('Participant limit reached')
    }

    // Check session limits (if applicable)
    if (subscription.limits.maxSessions !== -1 &&
        currentUsage.sessionsThisMonth >= subscription.limits.maxSessions) {
      throw new Error('Monthly session limit reached')
    }

    return true
  }

  async getCurrentUsage() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Count active sessions
    const activeSessionsSnapshot = await getDocs(
      query(
        collection(db, 'organizations', this.organizationId, 'sessions'),
        where('status', '==', 'active')
      )
    )

    // Count sessions this month
    const monthlySessionsSnapshot = await getDocs(
      query(
        collection(db, 'organizations', this.organizationId, 'sessions'),
        where('createdAt', '>=', startOfMonth)
      )
    )

    // Count active participants across all sessions
    let activeParticipants = 0
    for (const sessionDoc of activeSessionsSnapshot.docs) {
      const participantsSnapshot = await getDocs(
        collection(db, 'organizations', this.organizationId, 'sessions', sessionDoc.id, 'participants')
      )
      activeParticipants += participantsSnapshot.size
    }

    return {
      activeParticipants,
      activeSessions: activeSessionsSnapshot.size,
      sessionsThisMonth: monthlySessionsSnapshot.size
    }
  }

  async getSubscriptionData() {
    if (this.subscriptionData) return this.subscriptionData

    const orgDoc = await getDoc(doc(db, 'organizations', this.organizationId))
    if (!orgDoc.exists()) throw new Error('Organization not found')

    this.subscriptionData = orgDoc.data().subscription
    return this.subscriptionData
  }
}

// Subscription plan definitions
export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic',
    price: 29,
    modules: ['quiz', 'bingo'],
    limits: {
      maxParticipants: 50,
      maxSessions: -1, // unlimited
      maxTrainers: 3,
      analytics: 'basic',
      support: 'standard'
    },
    features: [
      'Enhanced Quiz System',
      'Training Bingo',
      'Basic Analytics',
      'Email Support'
    ]
  },

  professional: {
    name: 'Professional',
    price: 79,
    modules: ['quiz', 'bingo', 'millionaire', 'speedround'],
    limits: {
      maxParticipants: 200,
      maxSessions: -1,
      maxTrainers: 10,
      analytics: 'advanced',
      support: 'priority'
    },
    features: [
      'All Basic features',
      'Who Wants to be a Millionaire',
      'Speed Rounds Challenge',
      'Advanced Analytics',
      'Priority Support'
    ]
  },

  enterprise: {
    name: 'Enterprise',
    price: 199,
    modules: ['quiz', 'bingo', 'millionaire', 'speedround', 'jeopardy', 'escaperoom'],
    limits: {
      maxParticipants: -1, // unlimited
      maxSessions: -1,
      maxTrainers: -1,
      analytics: 'premium',
      support: 'dedicated'
    },
    features: [
      'All Professional features',
      'Training Jeopardy',
      'Escape Room Training',
      'Custom Module Development',
      'White-label Customization',
      'Dedicated Account Manager',
      'API Access'
    ]
  }
}
```

This comprehensive game modules specification provides the foundation for building engaging, educational post-training activities that scale with the business model and integrate seamlessly with the multi-tenant platform architecture.
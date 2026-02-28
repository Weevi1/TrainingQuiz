// Debug data generator for testing the presenter results screen
// Usage: Add ?debug=true to any SessionControl URL
// e.g. /session/test123?debug=true

import type { GameSession, Quiz, Participant, Question } from './firestore'

const FIRST_NAMES = [
  'Sarah', 'James', 'Aisha', 'Marcus', 'Elena',
  'David', 'Priya', 'Michael', 'Zinhle', 'Thomas',
  'Fatima', 'Ryan', 'Lerato', 'Nicole', 'Thabo'
]

const LAST_NAMES = [
  'Mitchell', 'Rodriguez', 'Patel', 'Johnson', 'Volkov',
  'Chen', 'Naidoo', 'O\'Brien', 'Dlamini', 'Müller',
  'Al-Rashid', 'Cooper', 'Mokoena', 'van der Berg', 'Molefe'
]

const AVATARS = ['😀', '😎', '🤓', '🧑‍💼', '👩‍💻', '🦊', '🐱', '🌟', '💪', '🎯', '🚀', '🧠', '🎓', '🏆', '⚡']

const QUESTIONS: Question[] = [
  { id: 'dq1', questionText: 'What is the primary purpose of a fire drill?', questionType: 'multiple_choice', options: ['To scare employees', 'To practice evacuation procedures', 'To test fire alarms', 'To clean the building'], correctAnswer: 1, difficulty: 'easy', category: 'safety' },
  { id: 'dq2', questionText: 'How often should workplace safety training be refreshed?', questionType: 'multiple_choice', options: ['Every 5 years', 'Never', 'Annually', 'Only after incidents'], correctAnswer: 2, difficulty: 'easy', category: 'compliance' },
  { id: 'dq3', questionText: 'What does PPE stand for?', questionType: 'multiple_choice', options: ['Personal Protective Equipment', 'Private Property Enclosure', 'Professional Performance Evaluation', 'Public Policy Enforcement'], correctAnswer: 0, difficulty: 'easy', category: 'safety' },
  { id: 'dq4', questionText: 'Which communication method is best for sensitive feedback?', questionType: 'multiple_choice', options: ['Group email', 'Social media post', 'Private face-to-face meeting', 'Company newsletter'], correctAnswer: 2, difficulty: 'medium', category: 'communication' },
  { id: 'dq5', questionText: 'What is the recommended maximum duration for a meeting?', questionType: 'multiple_choice', options: ['3 hours', '60 minutes', '30 minutes', 'No limit'], correctAnswer: 1, difficulty: 'medium', category: 'productivity' },
  { id: 'dq6', questionText: 'In conflict resolution, what should you address first?', questionType: 'multiple_choice', options: ['Who is at fault', 'The underlying interests', 'Company policy', 'Historical precedent'], correctAnswer: 1, difficulty: 'medium', category: 'management' },
  { id: 'dq7', questionText: 'What percentage of communication is non-verbal?', questionType: 'multiple_choice', options: ['10%', '30%', '55%', '90%'], correctAnswer: 2, difficulty: 'hard', category: 'communication' },
  { id: 'dq8', questionText: 'Which leadership style empowers team decision-making?', questionType: 'multiple_choice', options: ['Autocratic', 'Democratic', 'Laissez-faire', 'Transactional'], correctAnswer: 1, difficulty: 'hard', category: 'leadership' },
  { id: 'dq9', questionText: 'What is the Pareto Principle commonly known as?', questionType: 'multiple_choice', options: ['50/50 rule', '60/40 rule', '80/20 rule', '90/10 rule'], correctAnswer: 2, difficulty: 'hard', category: 'productivity' },
  { id: 'dq10', questionText: 'Which factor contributes most to employee retention?', questionType: 'multiple_choice', options: ['Higher salary', 'Free snacks', 'Meaningful work and growth', 'Casual dress code'], correctAnswer: 2, difficulty: 'hard', category: 'management' },
]

// Predefined participant profiles with target accuracy and speed characteristics
interface ParticipantProfile {
  correctRate: number    // 0-1, probability of getting each question right
  avgSpeed: number       // average seconds per answer
  speedVariance: number  // random variance +/- seconds
  completed: boolean
}

const PROFILES: ParticipantProfile[] = [
  { correctRate: 1.0,  avgSpeed: 3.2, speedVariance: 1.0, completed: true },   // Sarah - perfect, fast
  { correctRate: 0.9,  avgSpeed: 4.1, speedVariance: 1.5, completed: true },   // James - strong
  { correctRate: 0.8,  avgSpeed: 3.8, speedVariance: 1.2, completed: true },   // Aisha - solid
  { correctRate: 0.8,  avgSpeed: 5.5, speedVariance: 2.0, completed: true },   // Marcus - solid but slow
  { correctRate: 0.7,  avgSpeed: 4.0, speedVariance: 1.5, completed: true },   // Elena - good
  { correctRate: 0.7,  avgSpeed: 6.2, speedVariance: 2.5, completed: true },   // David - good but methodical
  { correctRate: 0.6,  avgSpeed: 5.0, speedVariance: 2.0, completed: true },   // Priya - average
  { correctRate: 0.6,  avgSpeed: 4.5, speedVariance: 1.5, completed: true },   // Michael - average
  { correctRate: 0.5,  avgSpeed: 6.0, speedVariance: 2.0, completed: true },   // Zinhle - struggling
  { correctRate: 0.5,  avgSpeed: 7.0, speedVariance: 2.5, completed: true },   // Thomas - slow
  { correctRate: 0.4,  avgSpeed: 5.5, speedVariance: 2.0, completed: true },   // Fatima - needs help
  { correctRate: 0.4,  avgSpeed: 8.0, speedVariance: 2.0, completed: true },   // Ryan - rushing wrong
  { correctRate: 0.3,  avgSpeed: 6.5, speedVariance: 2.5, completed: true },   // Lerato - weak
  { correctRate: 0.7,  avgSpeed: 4.5, speedVariance: 1.5, completed: false },  // Nicole - disconnected mid-quiz
  { correctRate: 0.2,  avgSpeed: 9.0, speedVariance: 1.0, completed: true },   // Thabo - lowest
]

// Seeded random for reproducible results
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateAnswers(
  profile: ParticipantProfile,
  questions: Question[],
  rng: () => number
): Participant['gameState']['answers'] {
  const questionCount = profile.completed ? questions.length : Math.floor(questions.length * 0.6)

  return questions.slice(0, questionCount).map((q) => {
    const isCorrect = rng() < profile.correctRate
    const timeSpent = Math.max(
      1,
      Math.round((profile.avgSpeed + (rng() - 0.5) * 2 * profile.speedVariance) * 10) / 10
    )

    return {
      questionId: q.id,
      selectedAnswer: isCorrect ? q.correctAnswer : ((q.correctAnswer + 1) % q.options.length),
      isCorrect,
      timeSpent,
    }
  })
}

export function generateDebugParticipants(count: number = 15): {
  session: GameSession
  quiz: Quiz
  participants: Participant[]
} {
  const rng = seededRandom(42)
  const actualCount = Math.min(count, PROFILES.length)

  const quiz: Quiz = {
    id: 'debug-quiz-001',
    title: 'Workplace Fundamentals Assessment',
    description: 'A comprehensive test of workplace knowledge',
    timeLimit: 15,
    questions: QUESTIONS,
    organizationId: 'debug-org',
    trainerId: 'debug-trainer',
    settings: {
      allowHints: false,
      confidenceScoring: false,
      teamMode: false,
      showExplanations: true,
      shuffleQuestions: false,
      passingScore: 60,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const session: GameSession = {
    id: 'debug-session-001',
    organizationId: 'debug-org',
    gameType: 'quiz',
    title: 'Workplace Safety & Communication Training',
    code: 'DEBUG',
    status: 'completed',
    trainerId: 'debug-trainer',
    participantLimit: 50,
    currentParticipants: actualCount,
    gameData: { quizId: quiz.id },
    settings: {
      allowLateJoin: true,
      showLeaderboard: true,
      enableSounds: true,
      recordSession: true,
    },
    startTime: new Date(Date.now() - 600000),
    endTime: new Date(),
    createdAt: new Date(Date.now() - 3600000),
  }

  const participants: Participant[] = []

  for (let i = 0; i < actualCount; i++) {
    const profile = PROFILES[i]
    const answers = generateAnswers(profile, QUESTIONS, rng)
    const correctCount = answers.filter(a => a.isCorrect).length
    const score = correctCount * 100

    // Calculate streak
    let bestStreak = 0
    let curStreak = 0
    answers.forEach(a => {
      if (a.isCorrect) { curStreak++; bestStreak = Math.max(bestStreak, curStreak) }
      else { curStreak = 0 }
    })

    participants.push({
      id: `debug-p-${i}`,
      name: `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`,
      sessionId: session.id,
      joinedAt: new Date(Date.now() - 900000 + i * 10000),
      isReady: true,
      avatar: AVATARS[i],
      completed: profile.completed,
      completedAt: profile.completed ? new Date() : undefined,
      finalScore: score,
      gameState: {
        currentQuestionIndex: answers.length,
        score,
        streak: curStreak,
        completed: profile.completed,
        answers,
        bestStreak,
      },
    })
  }

  return { session, quiz, participants }
}

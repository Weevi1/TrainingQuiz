import React from 'react'
import { MillionaireGame } from './MillionaireGame'
import { BingoGame } from './BingoGame'
import { SpeedRoundGame } from './SpeedRoundGame'
import { SpotTheDifferenceGame } from './SpotTheDifferenceGame'
import { type GameSession, type Quiz, type Participant } from '../../lib/firestore'
import { type ModuleType } from '../../lib/permissions'

interface GameDispatcherProps {
  gameType: ModuleType
  gameData: {
    quiz?: Quiz
    participants?: Participant[]
    timeLimit?: number
  }
  participantName: string
  onGameComplete: (score: number, additionalData?: any) => void
  onKicked?: () => void
  sessionSettings?: GameSession['settings']
  sessionId?: string
  participantId?: string
}

// Sample data generators for each game type
const generateMillionaireQuestions = (quizData?: Quiz) => {
  // Convert quiz questions to millionaire format or use default
  const sampleQuestions = [
    {
      id: 'q1',
      questionText: 'What is the primary goal of effective training?',
      options: ['Entertainment', 'Knowledge transfer', 'Time consumption', 'Cost reduction'],
      correctAnswer: 1,
      difficulty: 1 as const,
      valueAmount: 100
    },
    {
      id: 'q2',
      questionText: 'Which communication method is most effective for complex topics?',
      options: ['Email only', 'Face-to-face discussion', 'Text messages', 'Smoke signals'],
      correctAnswer: 1,
      difficulty: 2 as const,
      valueAmount: 200
    },
    {
      id: 'q3',
      questionText: 'What percentage of communication is non-verbal?',
      options: ['25%', '50%', '75%', '90%'],
      correctAnswer: 2,
      difficulty: 3 as const,
      valueAmount: 500
    },
    {
      id: 'q4',
      questionText: 'Which learning style involves hands-on experience?',
      options: ['Visual', 'Auditory', 'Kinesthetic', 'Reading'],
      correctAnswer: 2,
      difficulty: 4 as const,
      valueAmount: 1000
    },
    {
      id: 'q5',
      questionText: 'What is the most important factor in team success?',
      options: ['Individual talent', 'Clear communication', 'Competition', 'Hierarchy'],
      correctAnswer: 1,
      difficulty: 5 as const,
      valueAmount: 2000
    }
  ]

  if (quizData?.questions) {
    // Convert quiz questions to millionaire format
    return quizData.questions.slice(0, 15).map((q, index) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      difficulty: Math.min(5, Math.floor(index / 3) + 1) as 1 | 2 | 3 | 4 | 5,
      valueAmount: [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000][index] || 100
    }))
  }

  return sampleQuestions
}

const generateBingoItems = (quizData?: Quiz) => {
  // Convert quiz topics to bingo items or use default training items
  const sampleItems = [
    { id: '1', text: 'Active Listening', category: 'communication', points: 10 },
    { id: '2', text: 'Team Collaboration', category: 'teamwork', points: 10 },
    { id: '3', text: 'Goal Setting', category: 'planning', points: 10 },
    { id: '4', text: 'Feedback', category: 'communication', points: 10 },
    { id: '5', text: 'Problem Solving', category: 'skills', points: 10 },
    { id: '6', text: 'Time Management', category: 'productivity', points: 10 },
    { id: '7', text: 'Leadership', category: 'management', points: 10 },
    { id: '8', text: 'Conflict Resolution', category: 'communication', points: 10 },
    { id: '9', text: 'Innovation', category: 'creativity', points: 10 },
    { id: '10', text: 'Quality Assurance', category: 'standards', points: 10 },
    { id: '11', text: 'Customer Service', category: 'service', points: 10 },
    { id: '12', text: 'Safety Protocol', category: 'safety', points: 10 },
    { id: '13', text: 'Documentation', category: 'process', points: 10 },
    { id: '14', text: 'Continuous Learning', category: 'development', points: 10 },
    { id: '15', text: 'Performance Review', category: 'evaluation', points: 10 },
    { id: '16', text: 'Resource Management', category: 'efficiency', points: 10 },
    { id: '17', text: 'Strategic Planning', category: 'planning', points: 10 },
    { id: '18', text: 'Risk Assessment', category: 'analysis', points: 10 },
    { id: '19', text: 'Knowledge Sharing', category: 'collaboration', points: 10 },
    { id: '20', text: 'Best Practices', category: 'standards', points: 10 },
    { id: '21', text: 'Process Improvement', category: 'optimization', points: 10 },
    { id: '22', text: 'Data Analysis', category: 'analysis', points: 10 },
    { id: '23', text: 'Client Relations', category: 'service', points: 10 },
    { id: '24', text: 'Compliance', category: 'regulation', points: 10 },
    { id: '25', text: 'Training Others', category: 'development', points: 10 }
  ]

  if (quizData?.questions) {
    // Extract key concepts from quiz questions
    return quizData.questions.slice(0, 25).map((q) => ({
      id: q.id,
      text: q.questionText.slice(0, 50) + (q.questionText.length > 50 ? '...' : ''),
      category: q.category || 'training',
      points: 10
    }))
  }

  return sampleItems
}

const generateSpeedQuestions = (quizData?: Quiz) => {
  // Convert quiz questions to speed round format or use default
  const sampleQuestions = [
    {
      id: 'sq1',
      questionText: 'What does "SMART" stand for in goal setting?',
      options: ['Simple, Measurable, Achievable, Realistic, Timely', 'Specific, Measurable, Achievable, Relevant, Time-bound', 'Strategic, Meaningful, Accurate, Rapid, Tested', 'Standard, Managed, Approved, Reviewed, Tracked'],
      correctAnswer: 1,
      difficulty: 'medium' as const,
      points: 100
    },
    {
      id: 'sq2',
      questionText: 'True or False: Multitasking improves productivity.',
      options: ['True', 'False'],
      correctAnswer: 1,
      difficulty: 'easy' as const,
      points: 50
    },
    {
      id: 'sq3',
      questionText: 'What is the ideal team size for most projects?',
      options: ['3-5 people', '7-9 people', '10-12 people', '15+ people'],
      correctAnswer: 0,
      difficulty: 'hard' as const,
      points: 150
    },
    {
      id: 'sq4',
      questionText: 'Which is NOT a key component of emotional intelligence?',
      options: ['Self-awareness', 'Empathy', 'Technical skills', 'Social skills'],
      correctAnswer: 2,
      difficulty: 'medium' as const,
      points: 100
    },
    {
      id: 'sq5',
      questionText: 'What percentage of the brain do humans typically use?',
      options: ['10%', '50%', 'Nearly 100%', '25%'],
      correctAnswer: 2,
      difficulty: 'hard' as const,
      points: 150
    }
  ]

  if (quizData?.questions) {
    // Convert quiz questions to speed round format
    return quizData.questions.map(q => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty || 'medium' as const,
      points: (q.difficulty === 'easy' ? 50 : q.difficulty === 'hard' ? 150 : 100)
    }))
  }

  return sampleQuestions
}

const generateDocumentPairs = (_quizData?: Quiz) => {
  // Generate contract/document pairs for spot the difference game
  const samplePairs = [
    {
      id: 'contract1',
      title: 'Employment Agreement Review',
      description: 'Find the problematic clauses in this modified employment contract',
      documentType: 'contract' as const,
      timeLimit: 600, // 10 minutes
      originalDocument: `EMPLOYMENT AGREEMENT

This Employment Agreement is entered into on January 1, 2024, between TechCorp Inc. ("Company") and John Smith ("Employee").

1. POSITION AND DUTIES
Employee shall serve as Senior Software Engineer and shall perform duties consistent with this position.

2. COMPENSATION
Employee shall receive a salary of $95,000 per year, payable bi-weekly.

3. BENEFITS
Employee is entitled to standard health insurance, dental coverage, and 15 days of paid vacation annually.

4. CONFIDENTIALITY
Employee agrees to maintain confidentiality of all proprietary information during and after employment.

5. TERMINATION
Either party may terminate this agreement with 30 days written notice.

6. NON-COMPETE
Employee agrees not to work for direct competitors for 12 months after termination within a 50-mile radius.`,
      modifiedDocument: `EMPLOYMENT AGREEMENT

This Employment Agreement is entered into on January 1, 2024, between TechCorp Inc. ("Company") and John Smith ("Employee").

1. POSITION AND DUTIES
Employee shall serve as Senior Software Engineer and shall perform duties consistent with this position and any additional duties assigned.

2. COMPENSATION
Employee shall receive a salary of $85,000 per year, payable bi-weekly.

3. BENEFITS
Employee is entitled to standard health insurance and 10 days of paid vacation annually.

4. CONFIDENTIALITY
Employee agrees to maintain confidentiality of all proprietary information during and after employment indefinitely.

5. TERMINATION
Company may terminate this agreement with 24 hours written notice. Employee must provide 60 days notice.

6. NON-COMPETE
Employee agrees not to work for any competitors for 24 months after termination within a 100-mile radius.`,
      differences: [
        {
          id: 'diff1',
          type: 'text_change' as const,
          description: 'Additional duties clause added',
          severity: 'medium' as const,
          explanation: 'Adding "any additional duties assigned" significantly expands job scope beyond original agreement',
          location: { section: 'Position and Duties', highlight: 'additional' }
        },
        {
          id: 'diff2',
          type: 'number_change' as const,
          description: 'Salary reduced',
          severity: 'critical' as const,
          explanation: 'Salary reduced from $95,000 to $85,000 - major compensation change',
          location: { section: 'Compensation', highlight: '$85,000' }
        },
        {
          id: 'diff3',
          type: 'missing_clause' as const,
          description: 'Dental coverage removed',
          severity: 'medium' as const,
          explanation: 'Dental coverage benefit has been removed from the agreement',
          location: { section: 'Benefits', highlight: 'dental' }
        },
        {
          id: 'diff4',
          type: 'number_change' as const,
          description: 'Vacation days reduced',
          severity: 'high' as const,
          explanation: 'Paid vacation reduced from 15 to 10 days annually',
          location: { section: 'Benefits', highlight: '10' }
        },
        {
          id: 'diff5',
          type: 'text_change' as const,
          description: 'Indefinite confidentiality',
          severity: 'high' as const,
          explanation: 'Confidentiality period changed to "indefinitely" which may be unenforceable',
          location: { section: 'Confidentiality', highlight: 'indefinitely' }
        },
        {
          id: 'diff6',
          type: 'text_change' as const,
          description: 'Asymmetrical termination notice',
          severity: 'critical' as const,
          explanation: 'Company can terminate with 24 hours notice but employee needs 60 days - highly unfair',
          location: { section: 'Termination', highlight: '24' }
        },
        {
          id: 'diff7',
          type: 'number_change' as const,
          description: 'Extended non-compete period',
          severity: 'critical' as const,
          explanation: 'Non-compete extended from 12 to 24 months - may be unenforceable',
          location: { section: 'Non-Compete', highlight: '24' }
        },
        {
          id: 'diff8',
          type: 'number_change' as const,
          description: 'Expanded geographic restriction',
          severity: 'high' as const,
          explanation: 'Non-compete radius doubled from 50 to 100 miles',
          location: { section: 'Non-Compete', highlight: '100-mile' }
        }
      ]
    }
  ]

  return samplePairs
}

export const GameDispatcher: React.FC<GameDispatcherProps> = ({
  gameType,
  gameData,
  participantName,
  onGameComplete,
  onKicked,
  sessionSettings: _sessionSettings,
  sessionId,
  participantId
}) => {
  const handleGameComplete = (score: number, additionalData?: any) => {
    onGameComplete(score, additionalData)
  }

  // Convert Firestore participants to engagement format
  const engagementParticipants = gameData.participants?.map(p => ({
    id: p.id,
    name: p.name,
    score: p.gameState?.score || 0,
    streak: p.gameState?.streak || 0,
    answered: (p.gameState?.answers?.length || 0) > 0,
    isCurrentUser: p.name === participantName
  })) || []

  switch (gameType) {
    case 'millionaire':
      return (
        <MillionaireGame
          questions={generateMillionaireQuestions(gameData.quiz)}
          onGameComplete={handleGameComplete}
          participantName={participantName}
          participants={engagementParticipants}
          timeLimit={45} // 45 seconds per question
          sessionId={sessionId}
          participantId={participantId}
        />
      )

    case 'bingo':
      return (
        <BingoGame
          items={generateBingoItems(gameData.quiz)}
          cardSize={5}
          onGameComplete={(score, bingoGameState) =>
            handleGameComplete(score, { gameState: bingoGameState, gameType: 'bingo' })
          }
          onKicked={onKicked}
          participantName={participantName}
          participants={engagementParticipants}
          timeLimit={gameData.timeLimit || 900} // 15 minutes default
          winCondition="line"
          sessionId={sessionId}
          participantId={participantId}
        />
      )

    case 'speedround':
      return (
        <SpeedRoundGame
          questions={generateSpeedQuestions(gameData.quiz)}
          onGameComplete={(score, stats) => handleGameComplete(score, { stats })}
          participantName={participantName}
          participants={engagementParticipants}
          timeLimit={gameData.timeLimit || 300} // 5 minutes default
          questionTimeLimit={8} // 8 seconds per question
          enableSkip={true}
          sessionId={sessionId}
          participantId={participantId}
        />
      )

    case 'spotdifference':
      return (
        <SpotTheDifferenceGame
          documentPairs={generateDocumentPairs(gameData.quiz)}
          onGameComplete={(score, stats) => handleGameComplete(score, { stats })}
          participantName={participantName}
          participants={engagementParticipants}
          timeLimit={gameData.timeLimit || 600} // 10 minutes default
          sessionId={sessionId}
          participantId={participantId}
        />
      )


    default:
      // Fallback - should not happen with proper routing
      return (
        <div
          className="min-h-screen flex items-center justify-center"
          style={{
            backgroundColor: 'var(--background-color, #1f2937)',
            color: 'var(--text-color, #ffffff)'
          }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Unknown Game Type</h1>
            <p>Game type "{gameType}" is not implemented yet.</p>
            <button
              onClick={() => handleGameComplete(0)}
              className="mt-4 px-6 py-2 rounded transition-colors"
              style={{
                backgroundColor: 'var(--secondary-color, #4b5563)',
                color: 'var(--secondary-text-color, #ffffff)'
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )
  }
}
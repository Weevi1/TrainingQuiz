import QuizSessionDemo from '../components/QuizSessionDemo'

// Mock data for the stories
const mockParticipants = [
  { id: 1, name: 'John Smith', joined_at: new Date().toISOString() },
  { id: 2, name: 'Sarah Johnson', joined_at: new Date().toISOString() },
  { id: 3, name: 'Mike Wilson', joined_at: new Date().toISOString() },
  { id: 4, name: 'Lisa Brown', joined_at: new Date().toISOString() },
]

const mockLiveResults = [
  { id: 1, name: 'John Smith', score: 85, percentage: 85, correct: 17, total: 20, avgTime: 45 },
  { id: 2, name: 'Sarah Johnson', score: 92, percentage: 92, correct: 18, total: 20, avgTime: 38 },
  { id: 3, name: 'Mike Wilson', score: 78, percentage: 78, correct: 15, total: 20, avgTime: 52 },
]

export default {
  title: 'Pages/QuizSession',
  component: QuizSessionDemo,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'desktop'
    }
  },
  argTypes: {
    sessionStatus: {
      control: { type: 'select' },
      options: ['waiting', 'active', 'completed'],
      description: 'Current status of the quiz session'
    },
    quizTitle: {
      control: 'text',
      description: 'Title of the quiz'
    },
    sessionCode: {
      control: 'text', 
      description: 'Session code for participants to join'
    },
    timeLimit: {
      control: { type: 'range', min: 300, max: 7200, step: 300 },
      description: 'Quiz time limit in seconds'
    },
    questionCount: {
      control: { type: 'range', min: 1, max: 50, step: 1 },
      description: 'Number of questions in the quiz'
    }
  }
}

// Story for waiting state (before quiz starts)
export const WaitingState = {
  name: 'Waiting for Quiz to Start',
  args: {
    sessionStatus: 'waiting',
    participants: mockParticipants,
    liveResults: [],
    quizTitle: 'Employment Law Fundamentals',
    sessionCode: 'ABC123',
    timeLimit: 1800,
    questionCount: 10
  }
}

// Story for active state (quiz running)
export const ActiveState = {
  name: 'Active Quiz Session',
  args: {
    sessionStatus: 'active',
    participants: mockParticipants,
    liveResults: mockLiveResults,
    quizTitle: 'Employment Law Fundamentals',
    sessionCode: 'ABC123',
    timeLimit: 1800,
    questionCount: 10
  }
}

// Story for completed state
export const CompletedState = {
  name: 'Completed Quiz Session', 
  args: {
    sessionStatus: 'completed',
    participants: mockParticipants,
    liveResults: mockLiveResults,
    quizTitle: 'Employment Law Fundamentals',
    sessionCode: 'ABC123',
    timeLimit: 1800,
    questionCount: 10
  }
}

// Story with no participants
export const EmptySession = {
  name: 'Empty Session (No Participants)',
  args: {
    sessionStatus: 'waiting',
    participants: [],
    liveResults: [],
    quizTitle: 'Employment Law Fundamentals',
    sessionCode: 'ABC123',
    timeLimit: 1800,
    questionCount: 10
  }
}
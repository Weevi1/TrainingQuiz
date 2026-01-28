import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore'

// Initialize Firebase (using your existing config)
const firebaseConfig = {
  apiKey: "AIzaSyDdQ1D-3Lm5-2iKmQGo-6K7H3uBhgCj_5Y",
  authDomain: "gb-training.firebaseapp.com",
  projectId: "gb-training",
  storageBucket: "gb-training.appspot.com",
  messagingSenderId: "241934375282",
  appId: "1:241934375282:web:bd97d5c3f7e8f4a6c5a1a7"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Environment prefix for collections
const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'

async function createDummySessions() {
  try {
    // Organization ID (use existing or create one)
    const orgId = 'dev-org-1' // Adjust to your actual org ID

    console.log('Creating dummy training sessions...')

    // 1. DUMMY QUIZ SESSION - "Workplace Safety Training"
    const quizData = {
      id: 'safety-quiz-001',
      title: 'Workplace Safety Fundamentals',
      description: 'Essential safety protocols and emergency procedures for all employees',
      questions: [
        {
          id: 'q1',
          text: 'What is the first step when you discover a fire in the workplace?',
          type: 'multiple-choice',
          options: [
            'Try to extinguish it yourself',
            'Sound the alarm and evacuate',
            'Call your supervisor first',
            'Take a photo for documentation'
          ],
          correctAnswer: 1,
          timeLimit: 30,
          points: 100
        },
        {
          id: 'q2',
          text: 'How often should safety equipment be inspected?',
          type: 'multiple-choice',
          options: [
            'Once a year',
            'Monthly',
            'Weekly',
            'According to manufacturer guidelines'
          ],
          correctAnswer: 3,
          timeLimit: 25,
          points: 100
        },
        {
          id: 'q3',
          text: 'What does PPE stand for in workplace safety?',
          type: 'multiple-choice',
          options: [
            'Personal Protection Equipment',
            'Personnel Protective Equipment',
            'Personal Protective Equipment',
            'Public Protection Equipment'
          ],
          correctAnswer: 2,
          timeLimit: 20,
          points: 100
        },
        {
          id: 'q4',
          text: 'Which of these is NOT a proper lifting technique?',
          type: 'multiple-choice',
          options: [
            'Bend your knees, not your back',
            'Keep the load close to your body',
            'Twist your spine while lifting',
            'Get help for heavy items'
          ],
          correctAnswer: 2,
          timeLimit: 30,
          points: 100
        },
        {
          id: 'q5',
          text: 'What should you do if you witness an accident at work?',
          type: 'multiple-choice',
          options: [
            'Ignore it if no one is seriously hurt',
            'Report it immediately to your supervisor',
            'Wait until the end of your shift to report',
            'Only report if asked directly'
          ],
          correctAnswer: 1,
          timeLimit: 25,
          points: 100
        }
      ],
      settings: {
        timeLimit: 30,
        showCorrectAnswers: true,
        allowReview: true,
        shuffleQuestions: false,
        shuffleAnswers: true
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'trainer@company.com',
      organizationId: orgId
    }

    await setDoc(doc(db, `${ENV_PREFIX}_organizations`, orgId, 'quizzes', 'safety-quiz-001'), quizData)

    const quizSession = {
      id: 'session-safety-001',
      type: 'quiz',
      title: 'Safety Training Session - Morning Shift',
      description: 'Mandatory safety training for all morning shift employees',
      quizId: 'safety-quiz-001',
      status: 'created',
      settings: {
        maxParticipants: 50,
        allowLateJoin: true,
        showLeaderboard: true
      },
      createdAt: new Date(),
      scheduledFor: new Date(Date.now() + 86400000), // Tomorrow
      organizationId: orgId,
      createdBy: 'trainer@company.com'
    }

    await setDoc(doc(db, `${ENV_PREFIX}_organizations`, orgId, 'sessions', 'session-safety-001'), quizSession)

    // 2. DUMMY MILLIONAIRE SESSION - "Leadership Excellence"
    const millionaireSession = {
      id: 'session-millionaire-001',
      type: 'millionaire',
      title: 'Leadership Excellence Challenge',
      description: 'Test your leadership knowledge and climb to the top!',
      questions: [
        // $100 - Easy
        {
          level: 1,
          value: 100,
          question: 'What does effective communication primarily require?',
          options: [
            'Speaking loudly',
            'Active listening',
            'Using complex vocabulary',
            'Talking frequently'
          ],
          correctAnswer: 1,
          safetyNet: false
        },
        // $200 - Easy
        {
          level: 2,
          value: 200,
          question: 'Which leadership style involves shared decision-making?',
          options: [
            'Autocratic',
            'Democratic',
            'Laissez-faire',
            'Bureaucratic'
          ],
          correctAnswer: 1,
          safetyNet: false
        },
        // $500 - Easy to Medium
        {
          level: 3,
          value: 500,
          question: 'What is emotional intelligence in leadership?',
          options: [
            'IQ above 120',
            'Technical expertise',
            'Understanding and managing emotions',
            'Years of experience'
          ],
          correctAnswer: 2,
          safetyNet: false
        },
        // $1,000 - Medium (First Safety Net)
        {
          level: 4,
          value: 1000,
          question: 'According to research, what percentage of communication is non-verbal?',
          options: [
            '35%',
            '55%',
            '75%',
            '85%'
          ],
          correctAnswer: 1,
          safetyNet: true
        },
        // $2,000 - Medium
        {
          level: 5,
          value: 2000,
          question: 'What is the primary goal of transformational leadership?',
          options: [
            'Maintaining status quo',
            'Inspiring positive change',
            'Micromanaging tasks',
            'Avoiding conflicts'
          ],
          correctAnswer: 1,
          safetyNet: false
        },
        // Continue with more levels...
        {
          level: 6,
          value: 4000,
          question: 'Which theory suggests leaders are born, not made?',
          options: [
            'Situational Leadership',
            'Great Man Theory',
            'Behavioral Theory',
            'Contingency Theory'
          ],
          correctAnswer: 1,
          safetyNet: false
        },
        {
          level: 7,
          value: 8000,
          question: 'What does SMART in goal-setting stand for?',
          options: [
            'Simple, Measurable, Achievable, Realistic, Timely',
            'Specific, Measurable, Achievable, Relevant, Time-bound',
            'Strategic, Meaningful, Ambitious, Realistic, Trackable',
            'Systematic, Methodical, Analytical, Rational, Thorough'
          ],
          correctAnswer: 1,
          safetyNet: false
        },
        // $32,000 - Hard (Second Safety Net)
        {
          level: 8,
          value: 32000,
          question: 'Who developed the concept of "Level 5 Leadership"?',
          options: [
            'Peter Drucker',
            'Jim Collins',
            'John Maxwell',
            'Stephen Covey'
          ],
          correctAnswer: 1,
          safetyNet: true
        }
      ],
      lifelines: {
        fiftyFifty: true,
        phoneAFriend: true,
        askTheAudience: true
      },
      status: 'created',
      settings: {
        maxParticipants: 30,
        allowSpectators: true,
        timeLimit: 60
      },
      createdAt: new Date(),
      organizationId: orgId,
      createdBy: 'trainer@company.com'
    }

    await setDoc(doc(db, `${ENV_PREFIX}_organizations`, orgId, 'sessions', 'session-millionaire-001'), millionaireSession)

    // 3. DUMMY BINGO SESSION - "Customer Service Excellence"
    const bingoSession = {
      id: 'session-bingo-001',
      type: 'bingo',
      title: 'Customer Service Excellence Bingo',
      description: 'Learn key customer service concepts while playing bingo!',
      terms: [
        'Active Listening', 'Empathy', 'Problem Solving', 'First Impression',
        'Follow-up', 'Complaint Resolution', 'Product Knowledge', 'Patience',
        'Communication Skills', 'Body Language', 'Tone of Voice', 'Rapport Building',
        'Upselling', 'Cross-selling', 'Service Recovery', 'Customer Retention',
        'Feedback Collection', 'Quality Assurance', 'Team Collaboration', 'Time Management',
        'Stress Management', 'Cultural Sensitivity', 'Conflict Resolution', 'Professionalism',
        'Courtesy', 'Reliability', 'Responsiveness', 'Competence',
        'Credibility', 'Security', 'Understanding Customer Needs', 'Exceeding Expectations',
        'Service Standards', 'Continuous Improvement', 'Customer Satisfaction', 'Loyalty Programs'
      ],
      callSequence: [
        { term: 'Active Listening', explanation: 'The foundation of great customer service - truly hearing what customers say' },
        { term: 'Empathy', explanation: 'Understanding and sharing the feelings of your customers' },
        { term: 'First Impression', explanation: 'You only get one chance to make a positive first impression' },
        { term: 'Problem Solving', explanation: 'The ability to quickly identify and resolve customer issues' },
        { term: 'Follow-up', explanation: 'Ensuring customer satisfaction continues after the initial interaction' }
      ],
      winPatterns: ['line', 'corners', 'fullHouse'],
      status: 'created',
      settings: {
        maxParticipants: 100,
        autoGenerate: true,
        callInterval: 30
      },
      createdAt: new Date(),
      organizationId: orgId,
      createdBy: 'trainer@company.com'
    }

    await setDoc(doc(db, `${ENV_PREFIX}_organizations`, orgId, 'sessions', 'session-bingo-001'), bingoSession)

    // 4. DUMMY SPEED ROUND SESSION - "Tech Knowledge Sprint"
    const speedRoundSession = {
      id: 'session-speed-001',
      type: 'speedround',
      title: 'Tech Knowledge Sprint',
      description: 'Rapid-fire questions testing your technology knowledge!',
      questions: [
        { text: 'What does CPU stand for?', answer: 'Central Processing Unit', points: 10, timeLimit: 10 },
        { text: 'Which company created the iPhone?', answer: 'Apple', points: 10, timeLimit: 8 },
        { text: 'What does WWW stand for?', answer: 'World Wide Web', points: 10, timeLimit: 12 },
        { text: 'Name the popular video conferencing app that became famous during COVID-19', answer: 'Zoom', points: 10, timeLimit: 10 },
        { text: 'What does PDF stand for?', answer: 'Portable Document Format', points: 10, timeLimit: 15 },
        { text: 'Which search engine is most popular worldwide?', answer: 'Google', points: 10, timeLimit: 8 },
        { text: 'What does USB stand for?', answer: 'Universal Serial Bus', points: 10, timeLimit: 12 },
        { text: 'Name the most popular social media platform', answer: 'Facebook', points: 10, timeLimit: 8 },
        { text: 'What does AI stand for?', answer: 'Artificial Intelligence', points: 10, timeLimit: 10 },
        { text: 'Which company owns YouTube?', answer: 'Google', points: 10, timeLimit: 10 },
        { text: 'What does SaaS stand for?', answer: 'Software as a Service', points: 15, timeLimit: 15 },
        { text: 'Name the cryptocurrency created by Satoshi Nakamoto', answer: 'Bitcoin', points: 15, timeLimit: 12 },
        { text: 'What does API stand for?', answer: 'Application Programming Interface', points: 15, timeLimit: 18 },
        { text: 'Which programming language is known for web development?', answer: 'JavaScript', points: 15, timeLimit: 12 },
        { text: 'What does IoT stand for?', answer: 'Internet of Things', points: 15, timeLimit: 15 }
      ],
      rounds: 3,
      roundDuration: 120, // 2 minutes per round
      status: 'created',
      settings: {
        maxParticipants: 50,
        showAnswers: true,
        allowSkip: true
      },
      createdAt: new Date(),
      organizationId: orgId,
      createdBy: 'trainer@company.com'
    }

    await setDoc(doc(db, `${ENV_PREFIX}_organizations`, orgId, 'sessions', 'session-speed-001'), speedRoundSession)

    // 5. DUMMY DOCUMENT DETECTIVE SESSION - "Policy Compliance Check"
    const documentSession = {
      id: 'session-document-001',
      type: 'spotdifference',
      title: 'Policy Compliance Check',
      description: 'Spot the differences between the old and new company policies',
      documents: [
        {
          title: 'Remote Work Policy Updates',
          originalDocument: 'policy-v1.pdf',
          revisedDocument: 'policy-v2.pdf',
          differences: [
            {
              section: 'Work Hours',
              change: 'Flexibility increased from 2 hours to 4 hours daily',
              importance: 'high',
              explanation: 'Employees now have more flexibility in their daily schedules'
            },
            {
              section: 'Equipment Allowance',
              change: 'Monthly allowance increased from $50 to $75',
              importance: 'medium',
              explanation: 'Higher budget for home office equipment and utilities'
            },
            {
              section: 'Meeting Requirements',
              change: 'Mandatory daily check-ins reduced to 3 times per week',
              importance: 'high',
              explanation: 'Less micromanagement, more trust-based approach'
            },
            {
              section: 'Reporting Structure',
              change: 'Weekly reports now optional for senior staff',
              importance: 'medium',
              explanation: 'Streamlined reporting for experienced team members'
            },
            {
              section: 'Security Requirements',
              change: 'VPN usage now mandatory for all remote work',
              importance: 'critical',
              explanation: 'Enhanced security measures for data protection'
            }
          ],
          timeLimit: 300, // 5 minutes
          minimumFinds: 3
        }
      ],
      status: 'created',
      settings: {
        maxParticipants: 25,
        showHints: true,
        collaborative: false
      },
      createdAt: new Date(),
      organizationId: orgId,
      createdBy: 'trainer@company.com'
    }

    await setDoc(doc(db, `${ENV_PREFIX}_organizations`, orgId, 'sessions', 'session-document-001'), documentSession)

    console.log('✅ All dummy sessions created successfully!')
    console.log('Sessions created:')
    console.log('- Workplace Safety Quiz')
    console.log('- Leadership Excellence Millionaire Challenge')
    console.log('- Customer Service Bingo')
    console.log('- Tech Knowledge Speed Round')
    console.log('- Policy Compliance Document Detective')

  } catch (error) {
    console.error('Error creating dummy sessions:', error)
  }
}

// Run the script
createDummySessions()
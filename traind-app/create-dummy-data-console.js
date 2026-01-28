// Copy and paste this into your browser console while logged in as Platform Admin
// This will create realistic dummy sessions for testing

async function createDummyTrainingSessions() {
  // Get current user and organization
  const user = window.firebase?.auth()?.currentUser
  if (!user) {
    console.error('Please log in first!')
    return
  }

  const db = window.firebase.firestore()

  // You'll need to update this with your actual organization ID
  const orgId = 'your-dev-org-id' // Replace with actual org ID

  console.log('Creating dummy training sessions...')

  try {
    // 1. Create a sample Quiz first
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
      createdBy: user.email,
      organizationId: orgId
    }

    await db.collection('dev_organizations').doc(orgId).collection('quizzes').doc('safety-quiz-001').set(quizData)
    console.log('✅ Created safety quiz')

    // 2. Create Quiz Session
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
      createdBy: user.email
    }

    await db.collection('dev_organizations').doc(orgId).collection('sessions').doc('session-safety-001').set(quizSession)
    console.log('✅ Created quiz session')

    // 3. Create Millionaire Session
    const millionaireSession = {
      id: 'session-millionaire-001',
      type: 'millionaire',
      title: 'Leadership Excellence Challenge',
      description: 'Test your leadership knowledge and climb to the top!',
      questions: [
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
      createdBy: user.email
    }

    await db.collection('dev_organizations').doc(orgId).collection('sessions').doc('session-millionaire-001').set(millionaireSession)
    console.log('✅ Created millionaire session')

    // 4. Create Bingo Session
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
        'Courtesy', 'Reliability', 'Responsiveness', 'Competence'
      ],
      callSequence: [
        { term: 'Active Listening', explanation: 'The foundation of great customer service - truly hearing what customers say' },
        { term: 'Empathy', explanation: 'Understanding and sharing the feelings of your customers' },
        { term: 'First Impression', explanation: 'You only get one chance to make a positive first impression' }
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
      createdBy: user.email
    }

    await db.collection('dev_organizations').doc(orgId).collection('sessions').doc('session-bingo-001').set(bingoSession)
    console.log('✅ Created bingo session')

    // 5. Create Speed Round Session
    const speedRoundSession = {
      id: 'session-speed-001',
      type: 'speedround',
      title: 'Tech Knowledge Sprint',
      description: 'Rapid-fire questions testing your technology knowledge!',
      questions: [
        { text: 'What does CPU stand for?', answer: 'Central Processing Unit', points: 10, timeLimit: 10 },
        { text: 'Which company created the iPhone?', answer: 'Apple', points: 10, timeLimit: 8 },
        { text: 'What does WWW stand for?', answer: 'World Wide Web', points: 10, timeLimit: 12 },
        { text: 'Name the popular video conferencing app', answer: 'Zoom', points: 10, timeLimit: 10 },
        { text: 'What does PDF stand for?', answer: 'Portable Document Format', points: 10, timeLimit: 15 }
      ],
      rounds: 3,
      roundDuration: 120,
      status: 'created',
      settings: {
        maxParticipants: 50,
        showAnswers: true,
        allowSkip: true
      },
      createdAt: new Date(),
      organizationId: orgId,
      createdBy: user.email
    }

    await db.collection('dev_organizations').doc(orgId).collection('sessions').doc('session-speed-001').set(speedRoundSession)
    console.log('✅ Created speed round session')

    // 6. Create Document Detective Session
    const documentSession = {
      id: 'session-document-001',
      type: 'spotdifference',
      title: 'Policy Compliance Check',
      description: 'Spot the differences between the old and new company policies',
      documents: [
        {
          title: 'Remote Work Policy Updates',
          differences: [
            {
              section: 'Work Hours',
              change: 'Flexibility increased from 2 hours to 4 hours daily',
              importance: 'high'
            },
            {
              section: 'Equipment Allowance',
              change: 'Monthly allowance increased from $50 to $75',
              importance: 'medium'
            }
          ],
          timeLimit: 300,
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
      createdBy: user.email
    }

    await db.collection('dev_organizations').doc(orgId).collection('sessions').doc('session-document-001').set(documentSession)
    console.log('✅ Created document detective session')

    console.log('🎉 All dummy sessions created successfully!')
    console.log('You can now find these sessions in your trainer dashboard:')
    console.log('- Workplace Safety Quiz Session')
    console.log('- Leadership Excellence Millionaire Challenge')
    console.log('- Customer Service Excellence Bingo')
    console.log('- Tech Knowledge Speed Round')
    console.log('- Policy Compliance Document Detective')

  } catch (error) {
    console.error('Error creating dummy sessions:', error)
  }
}

// Call the function
createDummyTrainingSessions()
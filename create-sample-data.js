// Script to create sample data in Firestore for testing
// Run: node create-sample-data.js

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, addDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyALuxOAEMHFnna6kVoIA5rdeot0s5GKtHQ",
  authDomain: "gb-training.firebaseapp.com",
  projectId: "gb-training",
  storageBucket: "gb-training.firebasestorage.app",
  messagingSenderId: "639522260000",
  appId: "1:639522260000:web:7c8440b113e2c6b6006845"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const createSampleData = async () => {
  try {
    console.log('🔥 Creating sample data in Firestore...')

    // Create a sample trainer
    const trainerId = 'test-trainer-123'
    await setDoc(doc(db, 'trainers', trainerId), {
      id: trainerId,
      email: 'admin@gblaw.co.za',
      name: 'Test Administrator',
      createdAt: new Date()
    })
    console.log('✅ Sample trainer created')

    // Create a sample quiz
    const quizData = {
      title: 'Firebase Test Quiz',
      description: 'Testing the new Firebase real-time system',
      trainerId: trainerId,
      timeLimit: 600,
      questions: [
        {
          questionText: 'What is Firebase?',
          questionType: 'multiple_choice',
          options: ['A database', 'A real-time platform', 'Google\'s backend service', 'All of the above'],
          correctAnswer: 'All of the above',
          points: 10,
          orderIndex: 0
        },
        {
          questionText: 'Firebase is better than Supabase for real-time apps',
          questionType: 'true_false',
          options: ['True', 'False'],
          correctAnswer: 'True',
          points: 5,
          orderIndex: 1
        },
        {
          questionText: 'Which company owns Firebase?',
          questionType: 'multiple_choice',
          options: ['Microsoft', 'Google', 'Amazon', 'Meta'],
          correctAnswer: 'Google',
          points: 10,
          orderIndex: 2
        }
      ],
      createdAt: new Date()
    }

    const quizRef = await addDoc(collection(db, 'quizzes'), quizData)
    console.log('✅ Sample quiz created:', quizRef.id)

    // Create a sample session
    const sessionData = {
      quizId: quizRef.id,
      quiz: quizData, // Embed quiz data for easier access
      trainerId: trainerId,
      sessionCode: 'TEST123',
      status: 'waiting',
      createdAt: new Date(),
      participantCount: 0
    }

    const sessionRef = await addDoc(collection(db, 'sessions'), sessionData)
    console.log('✅ Sample session created:', sessionRef.id)
    console.log('📱 Session code: TEST123')

    // Add some sample participants
    const participants = [
      { name: 'Alice Johnson', joinedAt: new Date() },
      { name: 'Bob Smith', joinedAt: new Date() },
      { name: 'Carol Davis', joinedAt: new Date() }
    ]

    for (const participant of participants) {
      await addDoc(collection(db, 'sessions', sessionRef.id, 'participants'), {
        ...participant,
        completed: false,
        score: 0,
        totalAnswers: 0,
        avgTime: 0
      })
    }
    console.log('✅ Sample participants added')

    console.log('\n🎉 Sample data creation complete!')
    console.log('🚀 You can now test the Firebase migration:')
    console.log(`   1. Login with: admin@gblaw.co.za / test123456`)
    console.log(`   2. Go to session: ${sessionRef.id}`)
    console.log(`   3. Share session code: TEST123`)
    console.log('   4. Test real-time updates!')

  } catch (error) {
    console.error('💥 Error creating sample data:', error)
  }
}

createSampleData()
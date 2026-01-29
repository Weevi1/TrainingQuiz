// Script to create a demo quiz in the ESI organization
// Run with: node scripts/create-demo-quiz.mjs

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'

// Firebase config (from .env)
const firebaseConfig = {
  apiKey: "AIzaSyC7tP9DP9IZXV80rfUwvYRV0WYOVo6kWKc",
  authDomain: "traind-platform.firebaseapp.com",
  projectId: "traind-platform",
  storageBucket: "traind-platform.firebasestorage.app",
  messagingSenderId: "818419319889",
  appId: "1:818419319889:web:02b25a1a2b6ca86f68ae29"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// The fun demo quiz
const demoQuiz = {
  title: "Fun Facts Trivia 🎉",
  description: "A quick and fun trivia quiz to test your general knowledge!",
  timeLimit: 30, // seconds per question
  organizationId: "", // Will be set after finding ESI org
  trainerId: "demo-trainer",
  questions: [
    {
      id: "q1",
      questionText: "What is the only mammal capable of true flight?",
      questionType: "multiple_choice",
      options: ["Flying squirrel", "Bat", "Sugar glider", "Flying lemur"],
      correctAnswer: 1,
      explanation: "Bats are the only mammals that can truly fly. Flying squirrels and others only glide!",
      difficulty: "easy"
    },
    {
      id: "q2",
      questionText: "Which planet has the most moons in our solar system?",
      questionType: "multiple_choice",
      options: ["Jupiter", "Saturn", "Uranus", "Neptune"],
      correctAnswer: 1,
      explanation: "Saturn has over 140 confirmed moons, overtaking Jupiter in 2023!",
      difficulty: "medium"
    },
    {
      id: "q3",
      questionText: "What color is a polar bear's skin under its white fur?",
      questionType: "multiple_choice",
      options: ["White", "Pink", "Black", "Brown"],
      correctAnswer: 2,
      explanation: "Polar bears have black skin to absorb heat. Their fur is actually transparent, not white!",
      difficulty: "medium"
    },
    {
      id: "q4",
      questionText: "How many hearts does an octopus have?",
      questionType: "multiple_choice",
      options: ["1", "2", "3", "8"],
      correctAnswer: 2,
      explanation: "Octopuses have 3 hearts - one main heart and two gill hearts!",
      difficulty: "medium"
    },
    {
      id: "q5",
      questionText: "What was the first toy to be advertised on television?",
      questionType: "multiple_choice",
      options: ["Barbie", "Mr. Potato Head", "Slinky", "Etch A Sketch"],
      correctAnswer: 1,
      explanation: "Mr. Potato Head was the first toy advertised on TV in 1952!",
      difficulty: "hard"
    }
  ],
  settings: {
    allowHints: false,
    confidenceScoring: false,
    teamMode: false,
    showExplanations: true,
    shuffleQuestions: false,
    passingScore: 60
  }
}

async function findEsiOrganization() {
  console.log("🔍 Looking for ESI organization...")

  // Try dev-organizations collection first
  const devOrgsRef = collection(db, 'dev-organizations')
  const devSnapshot = await getDocs(devOrgsRef)

  console.log(`Found ${devSnapshot.size} organizations in dev-organizations`)

  for (const doc of devSnapshot.docs) {
    const data = doc.data()
    console.log(`  - ${doc.id}: ${data.name || 'unnamed'}`)

    // Look for ESI (case-insensitive)
    if (doc.id.toLowerCase().includes('esi') ||
        (data.name && data.name.toLowerCase().includes('esi'))) {
      console.log(`✅ Found ESI organization: ${doc.id}`)
      return doc.id
    }
  }

  // Also try production organizations collection
  const prodOrgsRef = collection(db, 'organizations')
  const prodSnapshot = await getDocs(prodOrgsRef)

  console.log(`Found ${prodSnapshot.size} organizations in organizations`)

  for (const doc of prodSnapshot.docs) {
    const data = doc.data()
    console.log(`  - ${doc.id}: ${data.name || 'unnamed'}`)

    if (doc.id.toLowerCase().includes('esi') ||
        (data.name && data.name.toLowerCase().includes('esi'))) {
      console.log(`✅ Found ESI organization: ${doc.id}`)
      return doc.id
    }
  }

  return null
}

async function createQuiz(orgId) {
  console.log(`\n📝 Creating quiz in organization: ${orgId}`)

  const quizData = {
    ...demoQuiz,
    organizationId: orgId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  // Try dev-organizations first
  try {
    const quizzesRef = collection(db, 'dev-organizations', orgId, 'quizzes')
    const docRef = await addDoc(quizzesRef, quizData)
    console.log(`✅ Quiz created with ID: ${docRef.id}`)
    console.log(`\n🎉 Quiz "${demoQuiz.title}" is ready!`)
    console.log(`   - 5 fun trivia questions`)
    console.log(`   - 30 seconds per question`)
    console.log(`   - 60% passing score`)
    return docRef.id
  } catch (error) {
    console.log("Trying production collection...")
    const quizzesRef = collection(db, 'organizations', orgId, 'quizzes')
    const docRef = await addDoc(quizzesRef, quizData)
    console.log(`✅ Quiz created with ID: ${docRef.id}`)
    return docRef.id
  }
}

async function main() {
  console.log("🚀 Demo Quiz Creator\n")

  const orgId = await findEsiOrganization()

  if (!orgId) {
    console.log("\n❌ Could not find ESI organization.")
    console.log("Available organizations have been listed above.")
    console.log("\nPlease provide the correct organization ID.")
    process.exit(1)
  }

  await createQuiz(orgId)

  console.log("\n✨ Done! You can now start a session with this quiz.")
  process.exit(0)
}

main().catch(error => {
  console.error("Error:", error)
  process.exit(1)
})

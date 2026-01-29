// Script to create a demo quiz using Firebase Admin SDK
// Run with: node scripts/create-demo-quiz-admin.mjs

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load service account
const serviceAccountPath = join(__dirname, '../../service-account.json')
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore(app)

// The fun demo quiz
const demoQuiz = {
  title: "Fun Facts Trivia 🎉",
  description: "A quick and fun trivia quiz to test your general knowledge!",
  timeLimit: 30,
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
  console.log("🔍 Looking for ESI organization...\n")

  // Check dev-organizations collection
  const devOrgsSnapshot = await db.collection('dev-organizations').get()
  console.log(`Found ${devOrgsSnapshot.size} organizations in dev-organizations:`)

  let esiOrgId = null

  devOrgsSnapshot.forEach(doc => {
    const data = doc.data()
    const name = data.name || 'unnamed'
    console.log(`  - ${doc.id}: ${name}`)

    if (doc.id.toLowerCase().includes('esi') ||
        name.toLowerCase().includes('esi')) {
      esiOrgId = doc.id
    }
  })

  if (esiOrgId) {
    console.log(`\n✅ Found ESI organization: ${esiOrgId}`)
    return { id: esiOrgId, collection: 'dev-organizations' }
  }

  // Check production organizations collection
  const prodOrgsSnapshot = await db.collection('organizations').get()
  console.log(`\nFound ${prodOrgsSnapshot.size} organizations in organizations:`)

  prodOrgsSnapshot.forEach(doc => {
    const data = doc.data()
    const name = data.name || 'unnamed'
    console.log(`  - ${doc.id}: ${name}`)

    if (doc.id.toLowerCase().includes('esi') ||
        name.toLowerCase().includes('esi')) {
      esiOrgId = doc.id
    }
  })

  if (esiOrgId) {
    console.log(`\n✅ Found ESI organization: ${esiOrgId}`)
    return { id: esiOrgId, collection: 'organizations' }
  }

  return null
}

async function createQuiz(orgInfo) {
  console.log(`\n📝 Creating quiz in ${orgInfo.collection}/${orgInfo.id}/quizzes`)

  const quizData = {
    ...demoQuiz,
    organizationId: orgInfo.id,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }

  const quizzesRef = db.collection(orgInfo.collection).doc(orgInfo.id).collection('quizzes')
  const docRef = await quizzesRef.add(quizData)

  console.log(`✅ Quiz created with ID: ${docRef.id}`)
  console.log(`\n🎉 Quiz "${demoQuiz.title}" is ready!`)
  console.log(`   - 5 fun trivia questions`)
  console.log(`   - 30 seconds per question`)
  console.log(`   - 60% passing score`)

  return docRef.id
}

async function main() {
  console.log("🚀 Demo Quiz Creator (Admin SDK)\n")
  console.log("=" .repeat(50))

  try {
    const orgInfo = await findEsiOrganization()

    if (!orgInfo) {
      console.log("\n❌ Could not find ESI organization.")
      console.log("Please check the organization name or ID.\n")

      // Offer to create in a specific org
      console.log("Available organizations are listed above.")
      console.log("You can modify this script to use a specific org ID.")
      process.exit(1)
    }

    await createQuiz(orgInfo)

    console.log("\n" + "=" .repeat(50))
    console.log("✨ Done! You can now start a session with this quiz.")
    console.log("Go to Dashboard -> Quizzes -> Start Session")

  } catch (error) {
    console.error("\n❌ Error:", error.message)
    process.exit(1)
  }

  process.exit(0)
}

main()

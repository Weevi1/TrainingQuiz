// Data migration script: Supabase → Firestore
// Run: node migrate-data.js

const { createClient } = require('@supabase/supabase-js')
const { initializeApp } = require('firebase/app')
const { getFirestore, collection, doc, setDoc, addDoc, writeBatch } = require('firebase/firestore')

// Supabase config
const supabaseUrl = 'https://syqucguttmyyrpocggff.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cXVjZ3V0dG15eXJwb2NnZ2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MDY4NTQsImV4cCI6MjA3Mjk4Mjg1NH0.K46DN28bMTN3535xTsaU3rlGgPU04rx-1jWA5vOB9nE'
const supabase = createClient(supabaseUrl, supabaseKey)

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyALuxOAEMHFnna6kVoIA5rdeot0s5GKtHQ",
  authDomain: "gb-training.firebaseapp.com",
  projectId: "gb-training",
  storageBucket: "gb-training.firebasestorage.app",
  messagingSenderId: "639522260000",
  appId: "1:639522260000:web:7c8440b113e2c6b6006845"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const migrateData = async () => {
  try {
    console.log('🔄 Starting data migration from Supabase to Firestore...\n')

    // 1. Export and migrate trainers
    console.log('👥 Migrating trainers...')
    const { data: trainers, error: trainersError } = await supabase
      .from('trainers')
      .select('*')

    if (trainersError) {
      console.error('❌ Error fetching trainers:', trainersError)
    } else {
      console.log(`📊 Found ${trainers?.length || 0} trainers`)

      for (const trainer of trainers || []) {
        await setDoc(doc(db, 'trainers', trainer.id), {
          id: trainer.id,
          email: trainer.email,
          name: trainer.name,
          createdAt: trainer.created_at ? new Date(trainer.created_at) : new Date()
        })
        console.log(`  ✅ Migrated trainer: ${trainer.name} (${trainer.email})`)
      }
    }

    // 2. Export and migrate quizzes with questions
    console.log('\n📚 Migrating quizzes...')
    const { data: quizzes, error: quizzesError } = await supabase
      .from('quizzes')
      .select(`
        *,
        questions (*)
      `)

    if (quizzesError) {
      console.error('❌ Error fetching quizzes:', quizzesError)
    } else {
      console.log(`📊 Found ${quizzes?.length || 0} quizzes`)

      for (const quiz of quizzes || []) {
        const quizData = {
          title: quiz.title,
          description: quiz.description,
          trainerId: quiz.trainer_id,
          timeLimit: quiz.time_limit || 600,
          questions: (quiz.questions || []).map(q => ({
            questionText: q.question_text,
            questionType: q.question_type,
            options: q.options,
            correctAnswer: q.correct_answer,
            points: q.points || 10,
            orderIndex: q.order_index
          })),
          createdAt: quiz.created_at ? new Date(quiz.created_at) : new Date()
        }

        const quizRef = await addDoc(collection(db, 'quizzes'), quizData)
        console.log(`  ✅ Migrated quiz: "${quiz.title}" (${quiz.questions?.length || 0} questions)`)

        // Store original quiz ID mapping for sessions
        quiz.firebaseId = quizRef.id
      }
    }

    // 3. Export and migrate quiz sessions
    console.log('\n🎯 Migrating quiz sessions...')
    const { data: sessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select(`
        *,
        quizzes (
          *,
          questions (*)
        )
      `)

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError)
    } else {
      console.log(`📊 Found ${sessions?.length || 0} quiz sessions`)

      for (const session of sessions || []) {
        // Find the corresponding quiz we just migrated
        const originalQuiz = quizzes?.find(q => q.id === session.quiz_id)

        const sessionData = {
          quizId: originalQuiz?.firebaseId || 'unknown',
          quiz: originalQuiz ? {
            title: originalQuiz.title,
            description: originalQuiz.description,
            timeLimit: originalQuiz.time_limit || 600,
            questions: (originalQuiz.questions || []).map(q => ({
              questionText: q.question_text,
              questionType: q.question_type,
              options: q.options,
              correctAnswer: q.correct_answer,
              points: q.points || 10,
              orderIndex: q.order_index
            }))
          } : null,
          trainerId: session.trainer_id,
          sessionCode: session.session_code,
          status: session.status,
          startedAt: session.started_at ? new Date(session.started_at) : null,
          endedAt: session.ended_at ? new Date(session.ended_at) : null,
          createdAt: session.created_at ? new Date(session.created_at) : new Date(),
          participantCount: 0 // Will be updated when we migrate participants
        }

        const sessionRef = await addDoc(collection(db, 'sessions'), sessionData)
        console.log(`  ✅ Migrated session: ${session.session_code} (${session.status})`)

        // Store Firebase session ID for participants migration
        session.firebaseId = sessionRef.id

        // 4. Migrate participants for this session
        const { data: participants, error: participantsError } = await supabase
          .from('participants')
          .select('*')
          .eq('session_id', session.id)

        if (participantsError) {
          console.error(`❌ Error fetching participants for session ${session.session_code}:`, participantsError)
        } else {
          console.log(`    📊 Found ${participants?.length || 0} participants`)

          for (const participant of participants || []) {
            await addDoc(collection(db, 'sessions', sessionRef.id, 'participants'), {
              name: participant.name,
              joinedAt: participant.joined_at ? new Date(participant.joined_at) : new Date(),
              completed: false, // Will be updated based on answers
              score: 0,
              totalAnswers: 0,
              avgTime: 0
            })
            console.log(`      👤 Migrated participant: ${participant.name}`)

            // Store for answers migration
            participant.firebaseSessionId = sessionRef.id
          }

          // Update participant count
          await setDoc(doc(db, 'sessions', sessionRef.id), {
            ...sessionData,
            participantCount: participants?.length || 0
          })

          // 5. Migrate answers for these participants
          if (participants && participants.length > 0) {
            const { data: answers, error: answersError } = await supabase
              .from('participant_answers')
              .select(`
                *,
                participants!inner (id, name),
                questions!inner (id, question_text)
              `)
              .in('participant_id', participants.map(p => p.id))

            if (answersError) {
              console.error(`❌ Error fetching answers for session ${session.session_code}:`, answersError)
            } else {
              console.log(`    📝 Found ${answers?.length || 0} answers`)

              for (const answer of answers || []) {
                const participant = participants.find(p => p.id === answer.participant_id)

                if (participant) {
                  await addDoc(collection(db, 'sessions', sessionRef.id, 'answers'), {
                    participantId: participant.id,
                    participantName: answer.participants.name,
                    questionId: answer.question_id,
                    questionText: answer.questions.question_text,
                    answer: answer.answer,
                    isCorrect: answer.is_correct,
                    timeTaken: answer.time_taken,
                    answeredAt: answer.answered_at ? new Date(answer.answered_at) : new Date()
                  })
                }
              }
              console.log(`      ✅ Migrated ${answers?.length || 0} answers`)
            }
          }
        }
      }
    }

    console.log('\n🎉 Data migration completed successfully!')
    console.log('🚀 Your Supabase data is now available in Firestore')
    console.log('\n📊 Migration Summary:')
    console.log(`   👥 Trainers: ${trainers?.length || 0}`)
    console.log(`   📚 Quizzes: ${quizzes?.length || 0}`)
    console.log(`   🎯 Sessions: ${sessions?.length || 0}`)

  } catch (error) {
    console.error('💥 Migration failed:', error)
  }
}

migrateData()
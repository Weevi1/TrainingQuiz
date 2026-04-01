const admin = require('firebase-admin')
if (!admin.apps.length) {
  const sa = require('../service-account.json')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
const db = admin.firestore();
(async () => {
  const agId = 'RaHBsEEXUx5OQLqMKo1p'
  // Check quizzes for CPD settings
  const quizzes = await db.collection('dev-quizzes').where('organizationId', '==', agId).get()
  console.log(`Found ${quizzes.size} quizzes for A&G:\n`)
  quizzes.forEach(doc => {
    const d = doc.data()
    console.log(`Quiz: "${d.title}" (${doc.id})`)
    console.log(`  settings:`, JSON.stringify(d.settings, null, 4))
    console.log()
  })

  // Check recent sessions
  const sessions = await db.collection('dev-sessions').where('organizationId', '==', agId).get()
  console.log(`\nFound ${sessions.size} sessions for A&G:\n`)
  sessions.forEach(doc => {
    const d = doc.data()
    console.log(`Session: "${d.title}" (${doc.id}) status=${d.status}`)
    console.log(`  speaker: ${d.speaker}, venue: ${d.venue}, cpdCategory: ${d.cpdCategory}`)
    console.log(`  cpd:`, JSON.stringify(d.cpd))
    console.log()
  })

  process.exit(0)
})()

// Check session and organization data
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const serviceAccountPath = join(__dirname, '../../service-account.json')
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

const app = initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore(app)

async function checkData() {
  console.log("🔍 Checking sessions and organizations...\n")

  // Get all sessions
  const sessionsSnapshot = await db.collection('dev-sessions').get()
  console.log(`Found ${sessionsSnapshot.size} sessions in dev-sessions:\n`)

  for (const doc of sessionsSnapshot.docs) {
    const data = doc.data()
    console.log(`Session: ${doc.id}`)
    console.log(`  Code: ${data.code}`)
    console.log(`  Title: ${data.title}`)
    console.log(`  Status: ${data.status}`)
    console.log(`  OrganizationId: ${data.organizationId}`)

    // Check if this org exists
    const orgDoc = await db.collection('dev-organizations').doc(data.organizationId).get()
    if (orgDoc.exists) {
      const orgData = orgDoc.data()
      console.log(`  ✅ Org found: ${orgData.name}`)
      console.log(`  📋 Org branding:`, JSON.stringify(orgData.branding, null, 4))
    } else {
      console.log(`  ❌ Org NOT found in dev-organizations!`)

      // Check production collection
      const prodOrgDoc = await db.collection('organizations').doc(data.organizationId).get()
      if (prodOrgDoc.exists) {
        console.log(`  ⚠️ Org found in 'organizations' (production) instead!`)
      }
    }
    console.log('')
  }
}

checkData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

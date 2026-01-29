// Check ESI organization branding in Firestore
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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

async function checkEsiBranding() {
  console.log("🔍 Checking ESI organization branding...\n")

  // Check dev-organizations collection
  const devOrgsSnapshot = await db.collection('dev-organizations').get()

  for (const doc of devOrgsSnapshot.docs) {
    const data = doc.data()
    const name = data.name || 'unnamed'

    if (doc.id.toLowerCase().includes('esi') || name.toLowerCase().includes('esi')) {
      console.log(`✅ Found ESI organization: ${doc.id}`)
      console.log(`   Name: ${name}`)
      console.log(`\n📋 Branding configuration:`)
      console.log(JSON.stringify(data.branding, null, 2))
      return
    }
  }

  // Check production organizations collection
  const prodOrgsSnapshot = await db.collection('organizations').get()

  for (const doc of prodOrgsSnapshot.docs) {
    const data = doc.data()
    const name = data.name || 'unnamed'

    if (doc.id.toLowerCase().includes('esi') || name.toLowerCase().includes('esi')) {
      console.log(`✅ Found ESI organization: ${doc.id}`)
      console.log(`   Name: ${name}`)
      console.log(`\n📋 Branding configuration:`)
      console.log(JSON.stringify(data.branding, null, 2))
      return
    }
  }

  console.log("❌ ESI organization not found")
}

checkEsiBranding()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

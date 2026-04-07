const admin = require('firebase-admin')
if (!admin.apps.length) {
  const sa = require('../service-account.json')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}

const LIMITS = {
  basic: 300,
  professional: 500,
  enterprise: 2000
}

async function main() {
  const db = admin.firestore()
  // Check both dev and production collections
  const collections = ['dev-organizations', 'organizations']
  for (const collName of collections) {
    const snapshot = await db.collection(collName).get()
    if (snapshot.empty) {
      console.log(`  (${collName}: empty, skipping)`)
      continue
    }
    console.log(`\nUpdating ${collName} (${snapshot.size} orgs):`)
    await updateOrgs(snapshot)
  }
}

async function updateOrgs(snapshot) {

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const plan = data.subscription?.plan
    const currentLimit = data.subscription?.limits?.maxParticipants
    const newLimit = LIMITS[plan]

    if (!newLimit) {
      console.log(`  SKIP ${data.name} (${doc.id}): unknown plan "${plan}"`)
      continue
    }

    if (currentLimit === newLimit) {
      console.log(`  OK   ${data.name} (${doc.id}): already ${newLimit}`)
      continue
    }

    await doc.ref.update({ 'subscription.limits.maxParticipants': newLimit })
    console.log(`  UPD  ${data.name} (${doc.id}): ${currentLimit} → ${newLimit} (${plan})`)
  }

}

async function main2() {
  await main()
  console.log('\nDone.')
  process.exit(0)
}

main2().catch(e => { console.error(e); process.exit(1) })

const admin = require('firebase-admin')
if (!admin.apps.length) {
  const sa = require('../service-account.json')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
const db = admin.firestore()

async function run() {
  const snap = await db.collection('dev-organizations').get()
  for (const doc of snap.docs) {
    const b = doc.data()?.branding
    const name = doc.data()?.name
    if (b) {
      console.log(`\n${name} (${doc.id}):`)
      console.log('  keys:', Object.keys(b).join(', '))
      console.log('  websiteUrl:', b.websiteUrl || '(missing)')
      console.log('  certificateTemplate:', b.certificateTemplate || '(missing)')
      console.log('  companyDescriptor:', b.companyDescriptor || '(missing)')
      console.log('  signerName:', b.signerName || '(missing)')
      console.log('  logo:', b.logo ? b.logo.substring(0, 60) + '...' : '(missing)')
      console.log('  logoRounded:', b.logoRounded)
    }
  }
  process.exit(0)
}
run()

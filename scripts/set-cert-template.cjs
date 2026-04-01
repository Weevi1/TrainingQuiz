/**
 * Set the certificate template on a tenant org.
 * Uses Firestore dot notation to avoid overwriting other branding fields.
 *
 * Usage: node scripts/set-cert-template.cjs
 */
const admin = require('firebase-admin')

if (!admin.apps.length) {
  const serviceAccount = require('../service-account.json')
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

const db = admin.firestore()
const col = 'dev-organizations'

async function run() {
  try {
    // 1. Revert ESI — remove wrongly added cert fields
    const esiId = 'LTTtVf6YUn3B4ZE85Tg6'
    await db.collection(col).doc(esiId).update({
      'branding.certificateTemplate': admin.firestore.FieldValue.delete(),
      'branding.companyDescriptor': admin.firestore.FieldValue.delete(),
      'branding.certificatesEnabled': admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    console.log('✅ Reverted ESI Attorneys — removed cert fields')

    // 2. Set cpd-professional on Abrahams and Gross
    const agId = 'RaHBsEEXUx5OQLqMKo1p'
    const agDoc = await db.collection(col).doc(agId).get()
    const ag = agDoc.data()
    console.log('\nAbrahams and Gross current branding:', JSON.stringify(ag?.branding, null, 2))

    await db.collection(col).doc(agId).update({
      'branding.certificateTemplate': 'cpd-professional',
      'branding.companyDescriptor': 'Attorneys Notaries Conveyancers',
      'branding.certificatesEnabled': true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    console.log('\n✅ Abrahams and Gross — certificate template set to cpd-professional')
    console.log('   companyDescriptor: "Attorneys Notaries Conveyancers"')
    console.log('   certificatesEnabled: true')
  } catch (error) {
    console.error('Error:', error.message)
  }

  process.exit(0)
}

run()

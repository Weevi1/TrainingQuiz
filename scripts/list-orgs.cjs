const admin = require('firebase-admin')
if (!admin.apps.length) {
  const sa = require('../service-account.json')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
admin.firestore().collection('organizations').get().then(s => {
  s.docs.forEach(d => {
    const b = d.data()?.branding
    console.log(d.data()?.name, '(' + d.id + '):', 'logo=' + (b?.logo ? 'yes' : 'no'), 'logoRounded=' + b?.logoRounded)
  })
  process.exit(0)
})

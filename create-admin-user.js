// Create Platform Admin user in Firestore
// Run: node create-admin-user.js

const admin = require('firebase-admin');

const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const userId = '6DUMIhon04VG3QUA2Oe6mG8cGA03';
const email = 'riaan.potas@gmail.com';
const displayName = 'Riaan Potas';

async function createAdminUser() {
  try {
    await db.collection('dev-users').doc(userId).set({
      id: userId,
      email: email,
      displayName: displayName,
      platformRole: 'PLATFORM_ADMIN',
      organizations: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Platform Admin user created successfully!');
    console.log('User ID:', userId);
    console.log('Email:', email);
    console.log('Role: PLATFORM_ADMIN');
    console.log('\nYou can now sign in at https://trained.fifo.systems');

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

createAdminUser();

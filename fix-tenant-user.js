// Create Firestore document for tenant user
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const userId = 'R7x5rrtygte119n4mPyXAamHFI92';

async function fixTenantUser() {
  try {
    // Get user info from Firebase Auth
    const authUser = await admin.auth().getUser(userId);
    console.log('Found user in Auth:', authUser.email);

    // Create user document in users collection
    await db.collection('users').doc(userId).set({
      id: userId,
      email: authUser.email,
      displayName: authUser.displayName || authUser.email.split('@')[0],
      organizations: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ User document created in Firestore!');
    console.log('Email:', authUser.email);
    console.log('\nUser can now log in at https://trained.fifo.systems');

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

fixTenantUser();

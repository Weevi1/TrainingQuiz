// Check if user exists in Firestore
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const userId = '6DUMIhon04VG3QUA2Oe6mG8cGA03';

async function checkUser() {
  console.log('Checking for user in Firestore...\n');

  // Check dev-users (where we created it)
  const devUser = await db.collection('dev-users').doc(userId).get();
  console.log('dev-users collection:', devUser.exists ? '✅ FOUND' : '❌ NOT FOUND');
  if (devUser.exists) {
    console.log('  Data:', JSON.stringify(devUser.data(), null, 2));
  }

  // Check users (in case app expects this)
  const user = await db.collection('users').doc(userId).get();
  console.log('\nusers collection:', user.exists ? '✅ FOUND' : '❌ NOT FOUND');
  if (user.exists) {
    console.log('  Data:', JSON.stringify(user.data(), null, 2));
  }

  // Check Firebase Auth
  try {
    const authUser = await admin.auth().getUser(userId);
    console.log('\nFirebase Auth:', '✅ FOUND');
    console.log('  Email:', authUser.email);
    console.log('  UID:', authUser.uid);
    console.log('  Disabled:', authUser.disabled);
  } catch (e) {
    console.log('\nFirebase Auth:', '❌ NOT FOUND');
  }

  process.exit(0);
}

checkUser();

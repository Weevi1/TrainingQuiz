// Move user to correct collection (users, not dev-users)
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const userId = '6DUMIhon04VG3QUA2Oe6mG8cGA03';

async function fixUserLocation() {
  // Get user from dev-users
  const devUserRef = db.collection('dev-users').doc(userId);
  const devUser = await devUserRef.get();

  if (!devUser.exists) {
    console.log('User not found in dev-users');
    process.exit(1);
  }

  const userData = devUser.data();
  console.log('Found user in dev-users:', userData.email);

  // Create in users collection (where the app looks for Platform Admins)
  const userRef = db.collection('users').doc(userId);
  await userRef.set(userData);
  console.log('✅ Created user in "users" collection');

  // Optionally delete from dev-users
  // await devUserRef.delete();
  // console.log('Deleted from dev-users');

  console.log('\n✅ User is now in the correct location!');
  console.log('Try logging in at https://trained.fifo.systems');

  process.exit(0);
}

fixUserLocation();

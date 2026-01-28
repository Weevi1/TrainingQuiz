// Find ESI org and add user as owner
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const userId = 'R7x5rrtygte119n4mPyXAamHFI92';

async function addUserToOrg() {
  try {
    // Find ESI organization
    const orgsSnapshot = await db.collection('dev-organizations').get();

    console.log('Found organizations:');
    let esiOrg = null;
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.name}`);
      if (data.name && data.name.toLowerCase().includes('esi')) {
        esiOrg = { id: doc.id, ...data };
      }
    });

    if (!esiOrg) {
      console.log('\n❌ No ESI organization found');
      process.exit(1);
    }

    console.log(`\nFound ESI org: ${esiOrg.name} (${esiOrg.id})`);

    // Update user document to add organization membership
    await db.collection('users').doc(userId).update({
      organizations: {
        [esiOrg.id]: {
          role: 'ORG_OWNER',
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          permissions: [
            'manage_organization',
            'manage_billing',
            'manage_users',
            'manage_content',
            'create_sessions',
            'view_analytics',
            'manage_branding'
          ]
        }
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ User added as ORG_OWNER of', esiOrg.name);
    console.log('\nRefresh the page to see the organization dashboard!');

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

addUserToOrg();

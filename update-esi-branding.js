// Update ESI organization to use the esi-fairytale theme preset
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('./service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const esiOrgId = 'LTTtVf6YUn3B4ZE85Tg6';

// Use the esi-fairytale theme preset for elegant dark/gold branding
const esiBranding = {
  themePreset: 'esi-fairytale',
  // Legacy required fields
  primaryColor: '#c9a86c',
  secondaryColor: '#2b2b2b',
  theme: 'custom'
};

async function updateESIBranding() {
  try {
    await db.collection('dev-organizations').doc(esiOrgId).update({
      branding: esiBranding,
      name: 'ESI Attorneys',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ ESI Attorneys theme updated to esi-fairytale!');
    console.log('\nTheme: ESI Attorneys Fairytale');
    console.log('  Description: Elegant dark gold theme with magical sophistication');
    console.log('\nBrand Colors (from preset):');
    console.log('  Primary Gold: #c9a86c');
    console.log('  Bright Gold Accent: #d4af37');
    console.log('  Background: #1a1a1a (dark charcoal)');
    console.log('  Surface: #2b2b2b');
    console.log('  Text: White (#ffffff)');
    console.log('\nTypography:');
    console.log('  Headings: Cinzel (elegant serif)');
    console.log('  Body: Cormorant Garamond');
    console.log('\nEffects:');
    console.log('  Celebration style: Stars');
    console.log('  Animation speed: Slow (dignified)');
    console.log('  Border radius: Small (professional)');
    console.log('\nRefresh the ESI dashboard to see the new theme!');

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

updateESIBranding();

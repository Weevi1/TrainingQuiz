// Reset password using Firebase Admin SDK
const admin = require('firebase-admin');

const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const userId = '6DUMIhon04VG3QUA2Oe6mG8cGA03';
const newPassword = 'QWErty86!!!';

async function resetPassword() {
  try {
    await admin.auth().updateUser(userId, {
      password: newPassword
    });

    console.log('✅ Password reset successfully!');
    console.log('Email: riaan.potas@gmail.com');
    console.log('Password: QWErty86!!!');
    console.log('\nTry logging in now at https://trained.fifo.systems');

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

resetPassword();

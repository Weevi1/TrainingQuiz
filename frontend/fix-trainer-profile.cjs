// Fix trainer profile for Firebase Auth user
const { initializeApp } = require('firebase/app')
const { getFirestore, doc, setDoc } = require('firebase/firestore')

const firebaseConfig = {
  apiKey: "AIzaSyALuxOAEMHFnna6kVoIA5rdeot0s5GKtHQ",
  authDomain: "gb-training.firebaseapp.com",
  projectId: "gb-training",
  storageBucket: "gb-training.firebasestorage.app",
  messagingSenderId: "639522260000",
  appId: "1:639522260000:web:7c8440b113e2c6b6006845"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const fixTrainerProfile = async () => {
  try {
    // Create trainer profile for the Firebase Auth user
    const firebaseUserId = 'vpPIThxGyFhQSPw7pllSE1XPaEo1'

    await setDoc(doc(db, 'trainers', firebaseUserId), {
      id: firebaseUserId,
      email: 'admin@gblaw.co.za',
      name: 'Test Administrator',
      createdAt: new Date()
    })

    console.log('✅ Trainer profile created for Firebase Auth user')
  } catch (error) {
    console.error('❌ Error creating trainer profile:', error)
  }
}

fixTrainerProfile()
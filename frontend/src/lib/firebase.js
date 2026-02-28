import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Debug environment variables
console.log('🔥 Firebase Project ID:', firebaseConfig.projectId)
console.log('🔥 Firebase Auth Domain:', firebaseConfig.authDomain)
console.log('🔥 Firebase API Key:', firebaseConfig.apiKey ? 'Key loaded ✅' : 'Key missing ❌')

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firestore
export const db = getFirestore(app)

// Initialize Auth
export const auth = getAuth(app)

// Connect to emulators in development
if (import.meta.env.DEV) {
  console.log('🛠️ Development mode: Firebase emulators available if needed')
  // Uncomment to use emulators:
  // connectFirestoreEmulator(db, 'localhost', 8080)
  // connectAuthEmulator(auth, 'http://localhost:9099')
}

export default app
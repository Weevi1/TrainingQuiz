// Firebase configuration for multi-tenant SaaS platform
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Environment configuration
const APP_ENV = import.meta.env.VITE_APP_ENV || 'development'
const FIRESTORE_PREFIX = import.meta.env.VITE_FIRESTORE_PREFIX || 'dev'

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)

// Connect to emulators in development (disabled for now - using live Firebase)
// if (APP_ENV === 'development' && import.meta.env.DEV) {
//   try {
//     // Only connect to emulators if not already connected
//     if (!auth.emulatorConfig) {
//       connectAuthEmulator(auth, 'http://localhost:9099')
//     }

//     // Connect Firestore emulator (if available)
//     if (!(db as any)._settings?.host?.includes('localhost')) {
//       connectFirestoreEmulator(db, 'localhost', 8080)
//     }

//     // Connect Functions emulator
//     if (!functions.emulatorOrigin) {
//       connectFunctionsEmulator(functions, 'localhost', 5001)
//     }
//   } catch (error) {
//     console.warn('Emulators not available, using live Firebase:', error)
//   }
// }

console.log('Using live Firebase for development')

// Export environment helpers
export const firebaseEnv = {
  APP_ENV,
  FIRESTORE_PREFIX,
  isDevelopment: APP_ENV === 'development',
  isStaging: APP_ENV === 'staging',
  isProduction: APP_ENV === 'production'
}

export default app
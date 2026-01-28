// Script to promote user to Platform Admin
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCLBITX8xR6qYPes_GDzwekRzPemK3H_F8",
  authDomain: "traind-platform.firebaseapp.com",
  projectId: "traind-platform",
  storageBucket: "traind-platform.firebasestorage.app",
  messagingSenderId: "99822816290",
  appId: "1:99822816290:web:957bcc6bb65438bb6a8e7b"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function promoteToAdmin(email) {
  try {
    console.log(`Looking for user with email: ${email}`)

    // We need to find the user by email
    // Since we don't have the UID, let's check Firebase Console first
    console.log('Please go to Firebase Console > Authentication > Users')
    console.log('Find your user and copy the UID')
    console.log('Then we can promote the account')

  } catch (error) {
    console.error('Error:', error)
  }
}

// Usage
promoteToAdmin('riaan.potas@gmail.com')
import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [trainer, setTrainer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔥 Firebase Auth state changed:', firebaseUser?.email)
      setUser(firebaseUser)

      if (firebaseUser) {
        await loadTrainerProfile(firebaseUser.uid)
      } else {
        setTrainer(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  const loadTrainerProfile = async (userId) => {
    try {
      const trainerRef = doc(db, 'trainers', userId)
      const trainerSnap = await getDoc(trainerRef)

      if (trainerSnap.exists()) {
        const trainerData = { id: trainerSnap.id, ...trainerSnap.data() }
        console.log('✅ Trainer profile loaded:', trainerData)
        setTrainer(trainerData)
      } else {
        console.log('❌ No trainer profile found for user:', userId)
      }
    } catch (error) {
      console.error('💥 Error loading trainer profile:', error)
    }
  }

  const signUp = async (email, password, name) => {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const firebaseUser = userCredential.user

      // Update the user's display name
      await updateProfile(firebaseUser, { displayName: name })

      // Create trainer profile in Firestore
      const trainerData = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name,
        createdAt: new Date()
      }

      await setDoc(doc(db, 'trainers', firebaseUser.uid), trainerData)
      console.log('✅ Trainer profile created:', trainerData)

      setTrainer(trainerData)
      return { data: { user: firebaseUser }, error: null }
    } catch (error) {
      console.error('💥 Error signing up:', error)
      return { data: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      console.log('✅ User signed in:', userCredential.user.email)
      return { data: { user: userCredential.user }, error: null }
    } catch (error) {
      console.error('💥 Error signing in:', error)
      return { data: null, error }
    }
  }

  const signOutUser = async () => {
    try {
      await signOut(auth)
      console.log('✅ User signed out')
      setTrainer(null)
      return { error: null }
    } catch (error) {
      console.error('💥 Error signing out:', error)
      return { error }
    }
  }

  const value = {
    user,
    trainer,
    loading,
    signUp,
    signIn,
    signOut: signOutUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
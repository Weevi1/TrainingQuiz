import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [trainer, setTrainer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadTrainerProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadTrainerProfile(session.user.id)
      } else {
        setTrainer(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadTrainerProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('trainers')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setTrainer(data)
      }
    } catch (error) {
      console.error('Error loading trainer profile:', error)
    }
  }

  const signUp = async (email, password, name) => {
    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      // Create trainer profile - use the auth user's ID
      if (authData.user) {
        const { data: trainerData, error: trainerError } = await supabase
          .from('trainers')
          .insert({
            id: authData.user.id,
            email: authData.user.email,
            name
          })
          .select()
          .single()

        if (trainerError) {
          console.error('Error creating trainer profile:', trainerError)
          // If trainer creation fails, we still have the auth user
          setTrainer({ id: authData.user.id, email: authData.user.email, name })
        } else {
          setTrainer(trainerData)
        }
      }

      return { data: authData, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setTrainer(null)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const value = {
    user,
    trainer,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
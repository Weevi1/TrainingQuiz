import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase'

// ===== SESSIONS =====

export const createSession = async (sessionData) => {
  try {
    const docRef = await addDoc(collection(db, 'sessions'), {
      ...sessionData,
      status: 'waiting',
      createdAt: serverTimestamp(),
      participantCount: 0
    })
    return { id: docRef.id, ...sessionData }
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

export const getSession = async (sessionId) => {
  try {
    const docRef = doc(db, 'sessions', sessionId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    } else {
      throw new Error('Session not found')
    }
  } catch (error) {
    console.error('Error getting session:', error)
    throw error
  }
}

export const updateSession = async (sessionId, updates) => {
  try {
    const docRef = doc(db, 'sessions', sessionId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating session:', error)
    throw error
  }
}

export const getSessionByCode = async (sessionCode) => {
  try {
    const q = query(
      collection(db, 'sessions'),
      where('sessionCode', '==', sessionCode),
      where('status', 'in', ['waiting', 'active'])
    )
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() }
    } else {
      throw new Error('Session not found')
    }
  } catch (error) {
    console.error('Error getting session by code:', error)
    throw error
  }
}

// ===== PARTICIPANTS =====

export const addParticipant = async (sessionId, participantData) => {
  try {
    const docRef = await addDoc(collection(db, 'sessions', sessionId, 'participants'), {
      ...participantData,
      joinedAt: serverTimestamp(),
      completed: false,
      score: 0,
      totalAnswers: 0,
      avgTime: 0
    })

    // Update participant count in session
    const sessionRef = doc(db, 'sessions', sessionId)
    const sessionSnap = await getDoc(sessionRef)
    if (sessionSnap.exists()) {
      await updateDoc(sessionRef, {
        participantCount: (sessionSnap.data().participantCount || 0) + 1
      })
    }

    return { id: docRef.id, ...participantData }
  } catch (error) {
    console.error('Error adding participant:', error)
    throw error
  }
}

export const removeParticipant = async (sessionId, participantId) => {
  try {
    await deleteDoc(doc(db, 'sessions', sessionId, 'participants', participantId))

    // Update participant count in session
    const sessionRef = doc(db, 'sessions', sessionId)
    const sessionSnap = await getDoc(sessionRef)
    if (sessionSnap.exists()) {
      await updateDoc(sessionRef, {
        participantCount: Math.max(0, (sessionSnap.data().participantCount || 1) - 1)
      })
    }
  } catch (error) {
    console.error('Error removing participant:', error)
    throw error
  }
}

export const getParticipants = async (sessionId) => {
  try {
    const q = query(
      collection(db, 'sessions', sessionId, 'participants'),
      orderBy('joinedAt', 'asc')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error getting participants:', error)
    throw error
  }
}

// ===== ANSWERS =====

export const submitAnswer = async (sessionId, answerData) => {
  try {
    const docRef = await addDoc(collection(db, 'sessions', sessionId, 'answers'), {
      ...answerData,
      answeredAt: serverTimestamp()
    })

    // Update participant completion status
    await updateParticipantProgress(sessionId, answerData.participantId)

    return { id: docRef.id, ...answerData }
  } catch (error) {
    console.error('Error submitting answer:', error)
    throw error
  }
}

export const getAnswers = async (sessionId, participantId = null) => {
  try {
    let q = query(
      collection(db, 'sessions', sessionId, 'answers'),
      orderBy('answeredAt', 'asc')
    )

    if (participantId) {
      q = query(q, where('participantId', '==', participantId))
    }

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error getting answers:', error)
    throw error
  }
}

// ===== REAL-TIME SUBSCRIPTIONS =====

export const subscribeToParticipants = (sessionId, callback) => {
  const q = query(
    collection(db, 'sessions', sessionId, 'participants'),
    orderBy('joinedAt', 'asc')
  )

  return onSnapshot(q, (snapshot) => {
    console.log('🔥 REAL-TIME: Participants snapshot received!', {
      size: snapshot.size,
      fromCache: snapshot.metadata.fromCache,
      hasPendingWrites: snapshot.metadata.hasPendingWrites
    })

    const participants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    callback(participants)
  }, (error) => {
    console.error('Error in participants subscription:', error)
  })
}

export const subscribeToSession = (sessionId, callback) => {
  const docRef = doc(db, 'sessions', sessionId)

  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() })
    }
  }, (error) => {
    console.error('Error in session subscription:', error)
  })
}

export const subscribeToAnswers = (sessionId, callback) => {
  const q = query(
    collection(db, 'sessions', sessionId, 'answers'),
    orderBy('answeredAt', 'asc')
  )

  return onSnapshot(q, (snapshot) => {
    const answers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    callback(answers)
  }, (error) => {
    console.error('Error in answers subscription:', error)
  })
}

// ===== HELPER FUNCTIONS =====

const updateParticipantProgress = async (sessionId, participantId) => {
  try {
    // Get all answers for this participant
    const answers = await getAnswers(sessionId, participantId)

    // Get total questions for this session
    const session = await getSession(sessionId)
    const totalQuestions = session.quiz?.questions?.length || 0

    // Calculate progress
    const correctAnswers = answers.filter(a => a.isCorrect).length
    const totalAnswers = answers.length
    const completed = totalAnswers >= totalQuestions
    const score = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0
    const avgTime = totalAnswers > 0 ? Math.round(answers.reduce((sum, a) => sum + (a.timeTaken || 0), 0) / totalAnswers) : 0

    // Update participant document
    const participantRef = doc(db, 'sessions', sessionId, 'participants', participantId)
    await updateDoc(participantRef, {
      completed,
      score,
      totalAnswers,
      avgTime,
      lastActivity: serverTimestamp()
    })

  } catch (error) {
    console.error('Error updating participant progress:', error)
  }
}

// ===== QUIZ MANAGEMENT =====

export const createQuiz = async (quizData) => {
  try {
    const docRef = await addDoc(collection(db, 'quizzes'), {
      ...quizData,
      createdAt: serverTimestamp()
    })
    return { id: docRef.id, ...quizData }
  } catch (error) {
    console.error('Error creating quiz:', error)
    throw error
  }
}

export const getQuiz = async (quizId) => {
  try {
    const docRef = doc(db, 'quizzes', quizId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    } else {
      throw new Error('Quiz not found')
    }
  } catch (error) {
    console.error('Error getting quiz:', error)
    throw error
  }
}

export const generateSessionCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// ===== TRAINERS =====

export const getTrainer = async (trainerId) => {
  try {
    const docRef = doc(db, 'trainers', trainerId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    } else {
      throw new Error('Trainer not found')
    }
  } catch (error) {
    console.error('Error getting trainer:', error)
    throw error
  }
}

export const createTrainer = async (trainerData) => {
  try {
    const docRef = doc(db, 'trainers', trainerData.id)
    await setDoc(docRef, {
      ...trainerData,
      createdAt: serverTimestamp()
    })
    return { id: trainerData.id, ...trainerData }
  } catch (error) {
    console.error('Error creating trainer:', error)
    throw error
  }
}

export const getTrainerSessions = async (trainerId) => {
  try {
    const q = query(
      collection(db, 'sessions'),
      where('trainerId', '==', trainerId),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error getting trainer sessions:', error)
    throw error
  }
}
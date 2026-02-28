// Multi-tenant Firestore helpers
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
  type DocumentSnapshot,
  type CollectionReference,
  type DocumentReference,
  type Query,
  Timestamp
} from 'firebase/firestore'
import { db, firebaseEnv } from './firebase'

// Types for our multi-tenant structure
export type User = {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  organizations: Record<string, UserOrgRole>
  platformRole?: 'PLATFORM_ADMIN'
  createdAt: Date
  updatedAt: Date
}

export type UserOrgRole = {
  role: 'ORG_OWNER' | 'ORG_ADMIN' | 'TRAINER' | 'PARTICIPANT'
  joinedAt: Date
  permissions: string[]
}

export type Invitation = {
  id: string
  email: string
  role: 'ORG_ADMIN' | 'TRAINER'
  status: 'pending' | 'accepted' | 'revoked'
  token: string
  invitedBy: string
  invitedByName: string
  organizationId: string
  organizationName: string
  createdAt: Date
  expiresAt: Date
  acceptedAt?: Date
  acceptedByUserId?: string
}

// Import theme types
import type {
  ThemePresetId,
  ThemeColors,
  ThemeTypography,
  ThemeBackground,
  GameThemeOverrides,
  ThemeEffects
} from './themePresets'

// Media item for reactions and stickers
export type MediaItem = {
  id: string
  url: string
  thumbnailUrl?: string
  label: string
  isBuiltIn?: boolean
}

export type OrganizationBranding = {
  // Legacy fields (maintained for backwards compatibility)
  logo?: string
  primaryColor: string
  secondaryColor: string
  theme: 'corporate' | 'modern' | 'playful' | 'custom'
  customCSS?: string

  // Theme preset selection
  themePreset?: ThemePresetId

  // Complete color system
  colors?: ThemeColors

  // Typography settings
  typography?: ThemeTypography

  // Background configuration
  background?: ThemeBackground

  // Game-specific theme overrides
  gameTheme?: GameThemeOverrides

  // Visual effects configuration
  effects?: ThemeEffects

  // Logo display options
  logoRounded?: boolean  // Apply rounded corners to logo

  // Certificate signature
  signatureUrl?: string
  signerName?: string    // e.g. "John Smith"
  signerTitle?: string   // e.g. "Training Manager"

  // Custom media (reactions shown during quiz, sticker avatars)
  reactions?: {
    correct?: MediaItem[]
    incorrect?: MediaItem[]
    celebration?: MediaItem[]
  }
  stickers?: MediaItem[]

  // Interstitial animation library
  interstitialAnimations?: string[]   // IDs of enabled built-in Lottie animations for this org
  customAnimations?: MediaItem[]      // Org-uploaded custom animations (MP4 with optional audio)
}

export type Organization = {
  id: string
  name: string
  domain: string
  subscription: {
    plan: 'basic' | 'professional' | 'enterprise'
    status: 'active' | 'trial' | 'expired' | 'suspended'
    modules: string[]
    limits: {
      maxParticipants: number
      maxSessions: number
      maxTrainers: number
    }
    // Manual billing fields (no Stripe in South Africa)
    expiresAt?: Date        // When annual subscription ends
    invoiceRef?: string     // Your invoice number for records
    notes?: string          // Admin notes about the subscription
  }
  branding: OrganizationBranding
  settings: {
    defaultTimeZone: string
    emailNotifications: boolean
    ssoEnabled: boolean
    customDomain?: string
    enableAttendanceCertificates?: boolean
  }
  createdAt: Date
  updatedAt: Date
}

export type GameSession = {
  id: string
  organizationId: string
  gameType: 'quiz' | 'millionaire' | 'bingo' | 'speedround' | 'spotdifference'
  title: string
  code: string
  status: 'waiting' | 'countdown' | 'active' | 'completed'
  trainerId: string
  participantLimit: number
  currentParticipants: number
  gameData: Record<string, any>
  settings: {
    allowLateJoin: boolean
    showLeaderboard: boolean
    enableSounds: boolean
    recordSession: boolean
  }
  // Timer sync fields (presenter is authoritative)
  timerStartedAt?: number        // Date.now() anchor when timer started (ms)
  sessionTimeLimit?: number      // Total session time in seconds
  timerPaused?: boolean          // Whether timer is currently paused
  pausedTimeRemaining?: number   // Seconds remaining when paused
  currentTimeRemaining?: number  // Legacy: current remaining seconds
  currentQuestionIndex?: number
  lastTimerUpdate?: Date
  startTime?: Date
  endTime?: Date
  createdAt: Date
}

export type Question = {
  id: string
  questionText: string
  questionType: 'multiple_choice' | 'true_false'
  options: string[]
  correctAnswer: number
  explanation?: string
  timeLimit?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  category?: string
}

// Interstitial animations between quiz questions
export type InterstitialConfig = {
  id: string                      // e.g. "int_abc123"
  beforeQuestionIndex: number     // Show BEFORE this question (0 = before first question)
  animationId: string             // ID of built-in Lottie or custom MediaItem
  animationType: 'builtin' | 'custom'  // Resolution path
  text?: string                   // Optional text overlay on top of animation
  sound?: string                  // SoundType (for Lottie or silent MP4; MP4 with audio uses native)
  durationMs?: number             // Override default duration
  // Legacy fields (v1 compat — InterstitialOverlay falls back to CSS keyframe rendering)
  style?: string
  emoji?: string
  effect?: string
}

export type Quiz = {
  id?: string
  title: string
  description: string
  timeLimit: number
  questions: Question[]
  interstitials?: InterstitialConfig[]  // Animation breaks between questions
  organizationId: string
  trainerId: string
  settings: {
    allowHints: boolean
    confidenceScoring: boolean
    teamMode: boolean
    showExplanations: boolean
    shuffleQuestions: boolean
    passingScore: number
    // CPD (Continuing Professional Development)
    cpdEnabled?: boolean       // Whether this quiz awards CPD points
    cpdPoints?: number         // How many CPD points (e.g. 1, 2, 5)
    cpdRequiresPass?: boolean  // true = must meet passingScore; false = attendance only
  }
  published?: boolean   // undefined/true = published, false = draft
  createdAt?: Date
  updatedAt?: Date
}

/** Backwards-compatible check: treat missing `published` as true (existing quizzes) */
export const isPublished = (quiz: Quiz): boolean => quiz.published !== false

export type Participant = {
  id: string
  name: string
  sessionId: string
  joinedAt: Date
  isReady: boolean
  avatar?: string
  completed?: boolean
  completedAt?: Date
  finalScore?: number
  totalTime?: number
  gameState?: {
    currentQuestionIndex: number
    score: number
    streak: number
    completed?: boolean
    answers: Array<{
      questionId: string
      selectedAnswer: number
      isCorrect: boolean
      timeSpent: number
      confidence?: number
    }>
    // Bingo-specific fields
    gameType?: 'quiz' | 'bingo'
    cellsMarked?: number
    totalCells?: number
    linesCompleted?: number
    fullCardAchieved?: boolean
    bestStreak?: number
    timeSpent?: number
    gameWon?: boolean
    markedCellKeys?: string[]
    timeToFirstBingo?: number | null
    winCondition?: string
  }
}

// Collection name helpers with environment prefix
export const getCollectionName = (baseName: string): string => {
  if (firebaseEnv.isProduction) {
    return baseName
  }
  return `${firebaseEnv.FIRESTORE_PREFIX}-${baseName}`
}

// Multi-tenant collection helpers
export const getOrganizationCollection = (): CollectionReference<DocumentData> => {
  return collection(db, getCollectionName('organizations'))
}

export const getOrganizationDoc = (orgId: string): DocumentReference<DocumentData> => {
  return doc(db, getCollectionName('organizations'), orgId)
}

export const getOrgSubcollection = (orgId: string, subcollection: string): CollectionReference<DocumentData> => {
  return collection(db, getCollectionName('organizations'), orgId, subcollection)
}

export const getOrgSubdoc = (orgId: string, subcollection: string, docId: string): DocumentReference<DocumentData> => {
  return doc(db, getCollectionName('organizations'), orgId, subcollection, docId)
}

// Global collections (only for Platform Admins)
export const getPlatformUserCollection = (): CollectionReference<DocumentData> => {
  return collection(db, 'users')
}

export const getPlatformUserDoc = (userId: string): DocumentReference<DocumentData> => {
  return doc(db, 'users', userId)
}

// Organization-scoped user collections
export const getOrgUserCollection = (orgId: string): CollectionReference<DocumentData> => {
  return collection(db, getCollectionName('organizations'), orgId, 'users')
}

export const getOrgUserDoc = (orgId: string, userId: string): DocumentReference<DocumentData> => {
  return doc(db, getCollectionName('organizations'), orgId, 'users', userId)
}

// Legacy - will be replaced by context-aware functions
export const getUserCollection = (): CollectionReference<DocumentData> => {
  return collection(db, 'users')
}

export const getUserDoc = (userId: string): DocumentReference<DocumentData> => {
  return doc(db, 'users', userId)
}

export const getPlatformAdminCollection = (): CollectionReference<DocumentData> => {
  return collection(db, 'platform_admin')
}

// Session collections (environment-scoped)
export const getSessionCollection = (): CollectionReference<DocumentData> => {
  return collection(db, getCollectionName('sessions'))
}

export const getSessionDoc = (sessionId: string): DocumentReference<DocumentData> => {
  return doc(db, getCollectionName('sessions'), sessionId)
}

export const getSessionSubcollection = (sessionId: string, subcollection: string): CollectionReference<DocumentData> => {
  return collection(db, getCollectionName('sessions'), sessionId, subcollection)
}

// Enhanced CRUD operations with error handling
export class FirestoreService {
  // Organization operations
  static async createOrganization(orgData: Partial<Organization>): Promise<string> {
    const orgRef = await addDoc(getOrganizationCollection(), {
      ...orgData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return orgRef.id
  }

  static async getOrganization(orgId: string): Promise<Organization | null> {
    const orgDoc = await getDoc(getOrganizationDoc(orgId))
    if (!orgDoc.exists()) return null

    return {
      id: orgDoc.id,
      ...orgDoc.data(),
      createdAt: orgDoc.data().createdAt?.toDate(),
      updatedAt: orgDoc.data().updatedAt?.toDate()
    } as Organization
  }

  static async updateOrganization(orgId: string, updates: Partial<Organization>): Promise<void> {
    await updateDoc(getOrganizationDoc(orgId), {
      ...updates,
      updatedAt: serverTimestamp()
    })
  }

  static async getOrganizations(): Promise<Organization[]> {
    const orgsSnapshot = await getDocs(getOrganizationCollection())
    return orgsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as Organization[]
  }

  // User operations - context-aware (Platform Admin vs Organization users)
  static async createUser(userId: string, userData: Partial<User>, orgId?: string): Promise<void> {
    const userDocRef = orgId
      ? getOrgUserDoc(orgId, userId)  // Organization user
      : getPlatformUserDoc(userId)    // Platform Admin

    await setDoc(userDocRef, {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  }

  static async getUser(userId: string, orgId?: string): Promise<User | null> {
    // Try Platform Admin collection first
    const platformUserDoc = await getDoc(getPlatformUserDoc(userId))
    if (platformUserDoc.exists()) {
      return {
        id: platformUserDoc.id,
        ...platformUserDoc.data(),
        createdAt: platformUserDoc.data().createdAt?.toDate(),
        updatedAt: platformUserDoc.data().updatedAt?.toDate()
      } as User
    }

    // If orgId provided, try organization-specific user collection
    if (orgId) {
      const orgUserDoc = await getDoc(getOrgUserDoc(orgId, userId))
      if (orgUserDoc.exists()) {
        return {
          id: orgUserDoc.id,
          ...orgUserDoc.data(),
          createdAt: orgUserDoc.data().createdAt?.toDate(),
          updatedAt: orgUserDoc.data().updatedAt?.toDate()
        } as User
      }
    }

    return null
  }

  // Search for user across all organizations (for login when we don't know orgId)
  // Note: This is expensive and should only be used when necessary
  static async findUserInAnyOrganization(userId: string): Promise<{ user: User; orgId: string } | null> {
    try {
      // Only Platform Admins can list all organizations
      // For regular users, this will fail gracefully and return null
      const orgsSnapshot = await getDocs(getOrganizationCollection())

      for (const orgDoc of orgsSnapshot.docs) {
        try {
          const orgId = orgDoc.id
          const orgUserDoc = await getDoc(getOrgUserDoc(orgId, userId))

          if (orgUserDoc.exists()) {
            return {
              user: {
                id: orgUserDoc.id,
                ...orgUserDoc.data(),
                createdAt: orgUserDoc.data().createdAt?.toDate(),
                updatedAt: orgUserDoc.data().updatedAt?.toDate()
              } as User,
              orgId
            }
          }
        } catch (orgError) {
          // Skip organizations we don't have access to
          continue
        }
      }

      return null
    } catch (error) {
      // If we can't list organizations (permission denied), that's expected for non-platform admins
      console.log('Cannot search organizations - user may not have permission (this is normal for org users)')
      return null
    }
  }

  static async updateUser(userId: string, updates: Partial<User>, orgId?: string): Promise<void> {
    const userDocRef = orgId
      ? getOrgUserDoc(orgId, userId)  // Organization user
      : getPlatformUserDoc(userId)    // Platform Admin

    await updateDoc(userDocRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  }

  // Session operations
  static async createSession(sessionData: Partial<GameSession>): Promise<string> {
    const sessionRef = await addDoc(getSessionCollection(), {
      ...sessionData,
      createdAt: serverTimestamp()
    })
    return sessionRef.id
  }

  static async getSession(sessionId: string): Promise<GameSession | null> {
    const sessionDoc = await getDoc(getSessionDoc(sessionId))
    if (!sessionDoc.exists()) return null

    return {
      id: sessionDoc.id,
      ...sessionDoc.data(),
      createdAt: sessionDoc.data().createdAt?.toDate(),
      startTime: sessionDoc.data().startTime?.toDate(),
      endTime: sessionDoc.data().endTime?.toDate()
    } as GameSession
  }

  static async updateSession(sessionId: string, updates: Partial<GameSession>): Promise<void> {
    await updateDoc(getSessionDoc(sessionId), updates)
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await deleteDoc(getSessionDoc(sessionId))
  }

  // Organization-scoped queries
  static async getOrganizationSessions(orgId: string): Promise<GameSession[]> {
    const sessionsQuery = query(
      getSessionCollection(),
      where('organizationId', '==', orgId),
      orderBy('createdAt', 'desc')
    )

    const snapshot = await getDocs(sessionsQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      startTime: doc.data().startTime?.toDate(),
      endTime: doc.data().endTime?.toDate()
    })) as GameSession[]
  }

  static subscribeToOrganizationSessions(
    orgId: string,
    callback: (sessions: GameSession[]) => void
  ): () => void {
    const sessionsQuery = query(
      getSessionCollection(),
      where('organizationId', '==', orgId),
      orderBy('createdAt', 'desc')
    )

    return onSnapshot(sessionsQuery, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        startTime: doc.data().startTime?.toDate(),
        endTime: doc.data().endTime?.toDate()
      })) as GameSession[]
      callback(sessions)
    })
  }

  // Real-time subscriptions
  static subscribeToOrganization(
    orgId: string,
    callback: (org: Organization | null) => void
  ): () => void {
    return onSnapshot(getOrganizationDoc(orgId), (doc) => {
      if (doc.exists()) {
        callback({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        } as Organization)
      } else {
        callback(null)
      }
    })
  }

  static subscribeToSession(
    sessionId: string,
    callback: (session: GameSession | null) => void
  ): () => void {
    return onSnapshot(getSessionDoc(sessionId), (doc) => {
      if (doc.exists()) {
        callback({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          startTime: doc.data().startTime?.toDate(),
          endTime: doc.data().endTime?.toDate()
        } as GameSession)
      } else {
        callback(null)
      }
    })
  }

  // Quiz operations (organization-scoped)
  static async createQuiz(orgId: string, quizData: Partial<Quiz>): Promise<string> {
    const quizRef = await addDoc(getOrgSubcollection(orgId, 'quizzes'), {
      ...quizData,
      organizationId: orgId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return quizRef.id
  }

  static async getQuiz(orgId: string, quizId: string): Promise<Quiz | null> {
    const quizDoc = await getDoc(getOrgSubdoc(orgId, 'quizzes', quizId))
    if (!quizDoc.exists()) return null

    return {
      id: quizDoc.id,
      ...quizDoc.data(),
      createdAt: quizDoc.data().createdAt?.toDate(),
      updatedAt: quizDoc.data().updatedAt?.toDate()
    } as Quiz
  }

  static async updateQuiz(orgId: string, quizId: string, updates: Partial<Quiz>): Promise<void> {
    await updateDoc(getOrgSubdoc(orgId, 'quizzes', quizId), {
      ...updates,
      updatedAt: serverTimestamp()
    })
  }

  static async deleteQuiz(orgId: string, quizId: string): Promise<void> {
    await deleteDoc(getOrgSubdoc(orgId, 'quizzes', quizId))
  }

  static async getOrganizationQuizzes(orgId: string): Promise<Quiz[]> {
    const quizzesQuery = query(
      getOrgSubcollection(orgId, 'quizzes'),
      orderBy('updatedAt', 'desc')
    )

    const snapshot = await getDocs(quizzesQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as Quiz[]
  }

  static async getTrainerQuizzes(orgId: string, trainerId: string): Promise<Quiz[]> {
    const quizzesQuery = query(
      getOrgSubcollection(orgId, 'quizzes'),
      where('trainerId', '==', trainerId),
      orderBy('updatedAt', 'desc')
    )

    const snapshot = await getDocs(quizzesQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as Quiz[]
  }

  // Participant operations
  static async addParticipantToSession(sessionId: string, participantName: string, avatar?: string): Promise<string> {
    const participantData: Partial<Participant> = {
      name: participantName,
      sessionId,
      joinedAt: serverTimestamp() as any,
      isReady: true,
      avatar: avatar || '😀',
      gameState: {
        currentQuestionIndex: 0,
        score: 0,
        streak: 0,
        answers: []
      }
    }

    const participantRef = await addDoc(getSessionSubcollection(sessionId, 'participants'), participantData)

    // Update session participant count
    const sessionDoc = await getDoc(getSessionDoc(sessionId))
    if (sessionDoc.exists()) {
      const currentCount = sessionDoc.data().currentParticipants || 0
      await updateDoc(getSessionDoc(sessionId), {
        currentParticipants: currentCount + 1
      })
    }

    return participantRef.id
  }

  static async getSessionParticipants(sessionId: string): Promise<Participant[]> {
    const participantsQuery = query(
      getSessionSubcollection(sessionId, 'participants'),
      orderBy('joinedAt', 'asc')
    )

    const snapshot = await getDocs(participantsQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      joinedAt: doc.data().joinedAt?.toDate()
    })) as Participant[]
  }

  static async updateParticipantGameState(
    sessionId: string,
    participantId: string,
    gameState: Participant['gameState']
  ): Promise<void> {
    await updateDoc(doc(db, getCollectionName('sessions'), sessionId, 'participants', participantId), {
      gameState
    })
  }

  static async findSessionByCode(code: string): Promise<GameSession | null> {
    // Query sessions by code - only return waiting or active sessions
    const sessionsQuery = query(
      getSessionCollection(),
      where('code', '==', code.toUpperCase()),
      where('status', 'in', ['waiting', 'active']),
      limit(1)
    )

    const snapshot = await getDocs(sessionsQuery)

    if (snapshot.empty) {
      return null
    }

    const doc = snapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      startTime: doc.data().startTime?.toDate(),
      endTime: doc.data().endTime?.toDate()
    } as GameSession
  }

  static subscribeToSessionParticipants(
    sessionId: string,
    callback: (participants: Participant[]) => void
  ): () => void {
    const participantsQuery = query(
      getSessionSubcollection(sessionId, 'participants'),
      orderBy('joinedAt', 'asc')
    )

    return onSnapshot(participantsQuery, (snapshot) => {
      const participants = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinedAt: doc.data().joinedAt?.toDate()
      })) as Participant[]
      callback(participants)
    })
  }

  // Remove participant (kick functionality)
  static async removeParticipant(sessionId: string, participantId: string): Promise<void> {
    await deleteDoc(doc(db, getCollectionName('sessions'), sessionId, 'participants', participantId))

    // Update session participant count
    const sessionDoc = await getDoc(getSessionDoc(sessionId))
    if (sessionDoc.exists()) {
      const currentCount = sessionDoc.data().currentParticipants || 0
      await updateDoc(getSessionDoc(sessionId), {
        currentParticipants: Math.max(0, currentCount - 1)
      })
    }
  }

  // Subscribe to a specific participant (for kick detection)
  static subscribeToParticipant(
    sessionId: string,
    participantId: string,
    callback: (exists: boolean, participant?: Participant) => void
  ): () => void {
    const participantRef = doc(db, getCollectionName('sessions'), sessionId, 'participants', participantId)

    return onSnapshot(participantRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        callback(true, {
          id: docSnapshot.id,
          ...docSnapshot.data(),
          joinedAt: docSnapshot.data().joinedAt?.toDate()
        } as Participant)
      } else {
        callback(false)
      }
    })
  }

  // Update session timer (broadcaster pattern - trainer is authoritative)
  static async updateSessionTimer(
    sessionId: string,
    currentTimeRemaining: number,
    currentQuestionIndex: number
  ): Promise<void> {
    await updateDoc(getSessionDoc(sessionId), {
      currentTimeRemaining,
      currentQuestionIndex,
      lastTimerUpdate: serverTimestamp()
    })
  }

  // Submit individual answer
  static async submitAnswer(
    sessionId: string,
    participantId: string,
    answerData: {
      questionId: string
      questionIndex: number
      selectedAnswer: number
      isCorrect: boolean
      timeSpent: number
      participantName: string
    }
  ): Promise<string> {
    const answerRef = await addDoc(getSessionSubcollection(sessionId, 'answers'), {
      ...answerData,
      participantId,
      answeredAt: serverTimestamp()
    })
    return answerRef.id
  }

  // Get all answers for a session
  static async getSessionAnswers(sessionId: string): Promise<any[]> {
    const answersQuery = query(
      getSessionSubcollection(sessionId, 'answers'),
      orderBy('answeredAt', 'asc')
    )

    const snapshot = await getDocs(answersQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      answeredAt: doc.data().answeredAt?.toDate()
    }))
  }

  // Subscribe to session answers (for live tracking)
  static subscribeToSessionAnswers(
    sessionId: string,
    callback: (answers: any[]) => void
  ): () => void {
    const answersQuery = query(
      getSessionSubcollection(sessionId, 'answers'),
      orderBy('answeredAt', 'asc')
    )

    return onSnapshot(answersQuery, (snapshot) => {
      const answers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        answeredAt: doc.data().answeredAt?.toDate()
      }))
      callback(answers)
    })
  }

  // Mark participant as completed
  static async markParticipantCompleted(
    sessionId: string,
    participantId: string,
    finalScore: number,
    totalTime: number
  ): Promise<void> {
    await updateDoc(doc(db, getCollectionName('sessions'), sessionId, 'participants', participantId), {
      completed: true,
      completedAt: serverTimestamp(),
      finalScore,
      totalTime,
      'gameState.completed': true
    })
  }

  // Invitation operations
  static async createInvitation(orgId: string, data: Omit<Invitation, 'id' | 'createdAt'>): Promise<string> {
    const inviteRef = await addDoc(getOrgSubcollection(orgId, 'invitations'), {
      ...data,
      createdAt: serverTimestamp()
    })
    return inviteRef.id
  }

  static async getOrgInvitations(orgId: string, status?: string): Promise<Invitation[]> {
    const constraints = status
      ? [where('status', '==', status), orderBy('createdAt', 'desc')]
      : [orderBy('createdAt', 'desc')]

    const q = query(getOrgSubcollection(orgId, 'invitations'), ...constraints)
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
      acceptedAt: doc.data().acceptedAt?.toDate()
    })) as Invitation[]
  }

  static async getInvitationByToken(orgId: string, token: string): Promise<Invitation | null> {
    const q = query(
      getOrgSubcollection(orgId, 'invitations'),
      where('token', '==', token),
      limit(1)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null

    const doc = snapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
      acceptedAt: doc.data().acceptedAt?.toDate()
    } as Invitation
  }

  static async updateInvitation(orgId: string, inviteId: string, updates: Partial<Invitation>): Promise<void> {
    await updateDoc(getOrgSubdoc(orgId, 'invitations', inviteId), updates)
  }

  // Team member operations
  static async getOrgTeamMembers(orgId: string): Promise<User[]> {
    const snapshot = await getDocs(getOrgUserCollection(orgId))
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as User[]
  }

  // Utility functions
  static async generateSessionCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    for (let attempt = 0; attempt < 20; attempt++) {
      let result = ''
      for (let i = 0; i < 2; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
      }
      // Check no active/waiting session uses this code
      const existing = await FirestoreService.findSessionByCode(result)
      if (!existing) return result
    }
    // Extremely unlikely fallback — all 2-char codes in use among active sessions
    throw new Error('Unable to generate unique session code. Too many concurrent sessions.')
  }
}

export { serverTimestamp }
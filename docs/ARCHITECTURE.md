# Traind Platform - Technical Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Multi-Tenant Architecture](#multi-tenant-architecture)
3. [Authentication & Authorization](#authentication--authorization)
4. [Database Design](#database-design)
5. [Frontend Architecture](#frontend-architecture)
6. [Real-time Infrastructure](#real-time-infrastructure)
7. [Security Model](#security-model)
8. [Performance Considerations](#performance-considerations)
9. [Deployment Architecture](#deployment-architecture)
10. [Migration Strategy](#migration-strategy)

## Overview

Traind is a multi-tenant SaaS platform built on Firebase/Firestore that enables interactive post-training engagement through modular game systems. The architecture supports three distinct user types with proper data isolation and white-label branding capabilities.

### Core Principles
- **Multi-tenancy**: Complete data isolation between organizations
- **Real-time**: Live synchronization across all connected devices
- **Scalability**: Lightweight operations that scale with user growth
- **Modularity**: Subscription-based feature access
- **White-label**: Dynamic branding per organization

## Multi-Tenant Architecture

### Tenant Isolation Strategy

```
Firebase Project: traind-platform
│
├── organizations/ (Collection)
│   ├── {orgId-1}/
│   │   ├── trainers/ (Subcollection)
│   │   ├── modules/ (Subcollection)
│   │   ├── sessions/ (Subcollection)
│   │   ├── analytics/ (Subcollection)
│   │   └── settings/ (Document)
│   │       ├── branding: { logo, colors, theme }
│   │       ├── subscription: { plan, modules, limits }
│   │       └── billing: { customerId, status }
│   │
│   └── {orgId-2}/
│       └── [same structure]
│
├── users/ (Global Collection)
│   └── {userId}/
│       ├── profile: { name, email, avatar }
│       ├── organizations: [{ orgId, role, permissions }]
│       └── preferences: { theme, notifications }
│
└── platform_admin/ (Super Admin Collection)
    ├── organizations_index/
    ├── billing_events/
    └── system_analytics/
```

### Tenant Context Management

```javascript
// React Context for Multi-tenancy
export const TenantContext = createContext({
  currentOrganization: null,
  userRole: null,
  availableModules: [],
  brandingConfig: {}
})

// Tenant-aware Firebase operations
export const useFirestore = (organizationId) => {
  const getCollection = (collectionName) => {
    return collection(db, 'organizations', organizationId, collectionName)
  }

  const getDocument = (collectionName, docId) => {
    return doc(db, 'organizations', organizationId, collectionName, docId)
  }

  return { getCollection, getDocument }
}
```

## Authentication & Authorization

### User Role Hierarchy

```javascript
const UserRoles = {
  PLATFORM_ADMIN: {
    level: 10,
    permissions: ['manage_all_orgs', 'billing_access', 'system_config'],
    description: 'Platform owner with full system access'
  },

  ORG_OWNER: {
    level: 8,
    permissions: ['manage_org', 'billing_management', 'user_management'],
    description: 'Organization owner with full org control'
  },

  ORG_ADMIN: {
    level: 6,
    permissions: ['manage_trainers', 'view_analytics', 'session_management'],
    description: 'Organization administrator'
  },

  TRAINER: {
    level: 4,
    permissions: ['create_sessions', 'manage_content', 'view_own_analytics'],
    description: 'Content creator and session host'
  },

  PARTICIPANT: {
    level: 1,
    permissions: ['join_sessions', 'view_own_results'],
    description: 'End user participating in training sessions'
  }
}
```

### Authentication Flow

```javascript
// Enhanced Auth Context
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [currentOrganization, setCurrentOrganization] = useState(null)
  const [userRole, setUserRole] = useState(null)

  // Multi-tenant login
  const loginToOrganization = async (email, password, orgId) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const userData = await getUserOrganizations(userCredential.user.uid)

    // Verify user has access to requested organization
    const orgAccess = userData.organizations.find(org => org.orgId === orgId)
    if (!orgAccess) throw new Error('No access to organization')

    setCurrentOrganization(orgId)
    setUserRole(orgAccess.role)
    return userCredential
  }

  // Context switching between organizations
  const switchOrganization = async (orgId) => {
    const orgAccess = user.organizations.find(org => org.orgId === orgId)
    if (!orgAccess) throw new Error('No access to organization')

    setCurrentOrganization(orgId)
    setUserRole(orgAccess.role)
  }
}
```

### Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Platform admin access
    match /platform_admin/{document=**} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'PLATFORM_ADMIN';
    }

    // Organization-scoped access
    match /organizations/{orgId} {
      allow read, write: if request.auth != null &&
        isOrgMember(orgId, request.auth.uid);

      // Nested collections inherit organization access
      match /{document=**} {
        allow read, write: if request.auth != null &&
          isOrgMember(orgId, request.auth.uid) &&
          hasPermission(orgId, request.auth.uid, resource);
      }
    }

    // Global user profiles
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Helper functions
    function isOrgMember(orgId, userId) {
      return orgId in get(/databases/$(database)/documents/users/$(userId)).data.organizations;
    }

    function hasPermission(orgId, userId, resource) {
      let userRole = get(/databases/$(database)/documents/users/$(userId)).data.organizations[orgId].role;
      return checkRolePermissions(userRole, resource);
    }
  }
}
```

## Database Design

### Core Collections Schema

```javascript
// Organization Document
const OrganizationSchema = {
  id: "org_uuid",
  name: "Acme Corporation",
  domain: "acme.com",
  subscription: {
    plan: "professional", // basic | professional | enterprise
    status: "active",
    stripeCustomerId: "cus_xxxxx",
    modules: ["quiz", "millionaire", "bingo"],
    limits: {
      maxParticipants: 200,
      maxSessions: -1, // unlimited
      maxTrainers: 10
    },
    billingCycle: "monthly",
    nextBillingDate: "2024-01-15T00:00:00Z"
  },
  branding: {
    logo: "https://storage.googleapis.com/...",
    primaryColor: "#1a365d",
    secondaryColor: "#2d3748",
    theme: "corporate", // corporate | modern | playful | custom
    customCSS: "/* optional custom styles */"
  },
  settings: {
    defaultTimeZone: "America/New_York",
    emailNotifications: true,
    ssoEnabled: false,
    customDomain: "training.acme.com"
  },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z"
}

// Trainer Subcollection
const TrainerSchema = {
  id: "trainer_uuid",
  userId: "user_uuid", // Reference to global users collection
  role: "TRAINER", // ORG_OWNER | ORG_ADMIN | TRAINER
  permissions: ["create_sessions", "manage_content"],
  profile: {
    displayName: "John Smith",
    title: "Senior Safety Trainer",
    department: "Safety & Compliance",
    avatar: "https://storage.googleapis.com/..."
  },
  stats: {
    sessionsCreated: 45,
    totalParticipants: 1250,
    averageScore: 87.5,
    lastActivity: "2024-01-15T14:30:00Z"
  },
  createdAt: "2024-01-01T00:00:00Z"
}

// Session Schema (Multi-game Support)
const SessionSchema = {
  id: "session_uuid",
  gameType: "quiz", // quiz | millionaire | bingo | speedround | jeopardy
  gameData: {
    // Quiz-specific data
    quiz: {
      title: "Safety Compliance Quiz",
      questions: [...],
      timeLimit: 30,
      showCorrectAnswer: true
    },
    // Millionaire-specific data
    millionaire: {
      title: "Safety Millionaire",
      questions: [...],
      lifelines: ["5050", "audience", "phone"],
      safetyNets: [5, 10]
    }
    // Additional game types...
  },
  session: {
    code: "ABC123",
    status: "waiting", // waiting | active | completed
    trainerId: "trainer_uuid",
    participantLimit: 50,
    currentParticipants: 0,
    startTime: null,
    endTime: null
  },
  settings: {
    allowLateJoin: true,
    showLeaderboard: true,
    enableSounds: true,
    recordSession: true
  },
  createdAt: "2024-01-15T10:00:00Z"
}

// Participant Results Schema
const ParticipantResultSchema = {
  sessionId: "session_uuid",
  participantId: "participant_uuid",
  participantName: "Jane Doe",
  gameType: "quiz",
  results: {
    // Quiz results
    quiz: {
      totalQuestions: 10,
      correctAnswers: 8,
      score: 850,
      streak: 5,
      averageTime: 15.5,
      answers: [
        {
          questionId: 1,
          answer: 2,
          isCorrect: true,
          timeTaken: 12,
          timestamp: "2024-01-15T10:05:00Z"
        }
      ]
    },
    // Millionaire results
    millionaire: {
      questionsAnswered: 12,
      finalWinnings: 32000,
      lifelinesUsed: ["5050", "audience"],
      walkedAway: true,
      walkAwayAmount: 16000
    }
  },
  awards: ["Speed Demon", "Perfectionist"],
  joinTime: "2024-01-15T10:02:00Z",
  completeTime: "2024-01-15T10:25:00Z"
}
```

### Composite Indexes

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "participants",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "sessionId", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" },
        { "fieldPath": "completeTime", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "analytics",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "gameType", "order": "ASCENDING" },
        { "fieldPath": "dateRange", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Frontend Architecture

### Component Hierarchy

```
src/
├── components/
│   ├── common/
│   │   ├── Layout/
│   │   │   ├── SuperAdminLayout.jsx
│   │   │   ├── TrainerLayout.jsx
│   │   │   └── ParticipantLayout.jsx
│   │   ├── Navigation/
│   │   ├── Branding/
│   │   │   ├── DynamicTheme.jsx
│   │   │   └── BrandingProvider.jsx
│   │   └── Loading/
│   ├── auth/
│   │   ├── LoginForm.jsx
│   │   ├── OrganizationSelector.jsx
│   │   └── PermissionGate.jsx
│   └── games/
│       ├── shared/
│       │   ├── GameSession.jsx
│       │   ├── ParticipantGrid.jsx
│       │   └── ResultsDisplay.jsx
│       ├── quiz/
│       ├── millionaire/
│       ├── bingo/
│       └── speedround/
├── pages/
│   ├── platform-admin/
│   │   ├── Dashboard.jsx
│   │   ├── OrganizationManagement.jsx
│   │   └── BillingOverview.jsx
│   ├── trainer/
│   │   ├── Dashboard.jsx
│   │   ├── SessionManager.jsx
│   │   └── Analytics.jsx
│   └── participant/
│       ├── JoinSession.jsx
│       └── GameInterface.jsx
├── contexts/
│   ├── AuthContext.jsx
│   ├── TenantContext.jsx
│   ├── BrandingContext.jsx
│   └── GameContext.jsx
├── hooks/
│   ├── useFirestore.js
│   ├── useTenant.js
│   ├── useSubscription.js
│   └── useGameModule.js
├── lib/
│   ├── firebase.js
│   ├── firestore.js
│   ├── billing.js
│   └── gameModules.js
└── utils/
    ├── permissions.js
    ├── branding.js
    └── gameLogic.js
```

### Dynamic Theming System

```javascript
// BrandingProvider.jsx
export const BrandingProvider = ({ children }) => {
  const { currentOrganization } = useTenant()
  const [brandingConfig, setBrandingConfig] = useState(null)

  useEffect(() => {
    if (currentOrganization) {
      const unsubscribe = onSnapshot(
        doc(db, 'organizations', currentOrganization, 'settings', 'branding'),
        (doc) => {
          const branding = doc.data()
          setBrandingConfig(branding)
          applyBrandingToDOM(branding)
        }
      )
      return unsubscribe
    }
  }, [currentOrganization])

  const applyBrandingToDOM = (branding) => {
    const root = document.documentElement
    root.style.setProperty('--primary-color', branding.primaryColor)
    root.style.setProperty('--secondary-color', branding.secondaryColor)

    // Apply custom CSS if provided
    if (branding.customCSS) {
      const styleElement = document.getElementById('custom-branding')
      if (styleElement) styleElement.remove()

      const style = document.createElement('style')
      style.id = 'custom-branding'
      style.textContent = branding.customCSS
      document.head.appendChild(style)
    }
  }

  return (
    <BrandingContext.Provider value={{ brandingConfig }}>
      {children}
    </BrandingContext.Provider>
  )
}

// CSS Variables for Dynamic Theming
:root {
  --primary-color: #3b82f6;
  --secondary-color: #1e40af;
  --accent-color: #f59e0b;
  --background-color: #ffffff;
  --text-color: #1f2937;
  --border-radius: 0.5rem;
}

.btn-primary {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.brand-header {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
}
```

### Module Loading System

```javascript
// gameModules.js
export const GameModules = {
  quiz: () => import('../components/games/quiz/QuizModule'),
  millionaire: () => import('../components/games/millionaire/MillionaireModule'),
  bingo: () => import('../components/games/bingo/BingoModule'),
  speedround: () => import('../components/games/speedround/SpeedRoundModule'),
  jeopardy: () => import('../components/games/jeopardy/JeopardyModule')
}

// Module subscription checking
export const useGameModule = (gameType) => {
  const { subscription } = useTenant()
  const [module, setModule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadModule = async () => {
      try {
        // Check subscription access
        if (!subscription.modules.includes(gameType)) {
          throw new Error(`Module '${gameType}' not included in subscription`)
        }

        // Dynamic import
        const moduleLoader = GameModules[gameType]
        if (!moduleLoader) {
          throw new Error(`Module '${gameType}' not found`)
        }

        const loadedModule = await moduleLoader()
        setModule(loadedModule.default)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadModule()
  }, [gameType, subscription])

  return { module, loading, error }
}
```

## Real-time Infrastructure

### Real-time Synchronization Patterns

```javascript
// Real-time Session Management
export const useGameSession = (sessionId) => {
  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)

  useEffect(() => {
    if (!sessionId) return

    // Session document subscription
    const sessionUnsubscribe = onSnapshot(
      doc(db, 'sessions', sessionId),
      (doc) => setSession(doc.data())
    )

    // Participants collection subscription
    const participantsUnsubscribe = onSnapshot(
      collection(db, 'sessions', sessionId, 'participants'),
      (snapshot) => {
        const participantsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setParticipants(participantsList)
      }
    )

    // Current question subscription for live games
    const questionUnsubscribe = onSnapshot(
      doc(db, 'sessions', sessionId, 'live', 'current_question'),
      (doc) => setCurrentQuestion(doc.data())
    )

    return () => {
      sessionUnsubscribe()
      participantsUnsubscribe()
      questionUnsubscribe()
    }
  }, [sessionId])

  return { session, participants, currentQuestion }
}

// Optimized Real-time Updates
export const updateSessionState = async (sessionId, updates) => {
  // Batch multiple updates for efficiency
  const batch = writeBatch(db)

  // Update session document
  batch.update(doc(db, 'sessions', sessionId), updates.session)

  // Update live state
  if (updates.liveState) {
    batch.set(
      doc(db, 'sessions', sessionId, 'live', 'current_state'),
      updates.liveState,
      { merge: true }
    )
  }

  // Update participant states
  if (updates.participants) {
    updates.participants.forEach(participant => {
      batch.update(
        doc(db, 'sessions', sessionId, 'participants', participant.id),
        participant.updates
      )
    })
  }

  await batch.commit()
}
```

### Performance Optimizations

```javascript
// Connection State Management
export const useConnectionState = () => {
  const [isConnected, setIsConnected] = useState(true)
  const [connectionQuality, setConnectionQuality] = useState('good')

  useEffect(() => {
    const connectedRef = ref(database, '.info/connected')

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val()
      setIsConnected(connected)

      if (connected) {
        // Measure connection quality
        measureConnectionQuality()
      }
    })

    return unsubscribe
  }, [])

  const measureConnectionQuality = async () => {
    const start = Date.now()
    try {
      await get(ref(database, '.info/serverTimeOffset'))
      const latency = Date.now() - start

      if (latency < 100) setConnectionQuality('excellent')
      else if (latency < 300) setConnectionQuality('good')
      else if (latency < 1000) setConnectionQuality('fair')
      else setConnectionQuality('poor')
    } catch (error) {
      setConnectionQuality('poor')
    }
  }

  return { isConnected, connectionQuality }
}

// Intelligent Caching
export const useCachedFirestore = (query, dependencies = []) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const cache = useRef(new Map())

  useEffect(() => {
    const queryKey = JSON.stringify(query) + JSON.stringify(dependencies)

    // Check cache first
    if (cache.current.has(queryKey)) {
      const cached = cache.current.get(queryKey)
      if (Date.now() - cached.timestamp < 30000) { // 30 second cache
        setData(cached.data)
        setLoading(false)
        return
      }
    }

    // Fetch from Firestore
    const unsubscribe = onSnapshot(query, (snapshot) => {
      const result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Update cache
      cache.current.set(queryKey, {
        data: result,
        timestamp: Date.now()
      })

      setData(result)
      setLoading(false)
    })

    return unsubscribe
  }, dependencies)

  return { data, loading }
}
```

## Security Model

### Data Validation

```javascript
// Input validation middleware
export const validateGameData = (gameType, data) => {
  const validators = {
    quiz: {
      title: (val) => typeof val === 'string' && val.length > 0 && val.length <= 100,
      questions: (val) => Array.isArray(val) && val.length > 0 && val.length <= 50,
      timeLimit: (val) => Number.isInteger(val) && val >= 10 && val <= 300
    },
    millionaire: {
      questions: (val) => Array.isArray(val) && val.length === 15,
      lifelines: (val) => Array.isArray(val) && val.every(l => ['5050', 'audience', 'phone'].includes(l))
    }
  }

  const gameValidators = validators[gameType]
  if (!gameValidators) throw new Error(`Unknown game type: ${gameType}`)

  for (const [field, validator] of Object.entries(gameValidators)) {
    if (!validator(data[field])) {
      throw new Error(`Invalid ${field} for ${gameType}`)
    }
  }

  return true
}

// Rate limiting
export const useRateLimit = (action, limit = 10, windowMs = 60000) => {
  const attempts = useRef(new Map())

  const checkRateLimit = (userId) => {
    const now = Date.now()
    const userAttempts = attempts.current.get(userId) || []

    // Remove old attempts outside the window
    const recentAttempts = userAttempts.filter(time => now - time < windowMs)

    if (recentAttempts.length >= limit) {
      throw new Error(`Rate limit exceeded for ${action}`)
    }

    // Add current attempt
    recentAttempts.push(now)
    attempts.current.set(userId, recentAttempts)

    return true
  }

  return { checkRateLimit }
}
```

### GDPR Compliance

```javascript
// Data export functionality
export const exportUserData = async (userId, organizationId) => {
  const userData = {
    profile: {},
    sessions: [],
    results: [],
    analytics: {}
  }

  // Collect user profile data
  const userDoc = await getDoc(doc(db, 'users', userId))
  userData.profile = userDoc.data()

  // Collect session participation data
  const sessionsSnapshot = await getDocs(
    query(
      collectionGroup(db, 'participants'),
      where('userId', '==', userId),
      where('organizationId', '==', organizationId)
    )
  )

  userData.sessions = sessionsSnapshot.docs.map(doc => ({
    sessionId: doc.ref.parent.parent.id,
    ...doc.data()
  }))

  return userData
}

// Data deletion functionality
export const deleteUserData = async (userId, organizationId) => {
  const batch = writeBatch(db)

  // Remove from organization trainers
  const trainerRef = doc(db, 'organizations', organizationId, 'trainers', userId)
  batch.delete(trainerRef)

  // Remove participation records
  const participantSnapshots = await getDocs(
    query(
      collectionGroup(db, 'participants'),
      where('userId', '==', userId),
      where('organizationId', '==', organizationId)
    )
  )

  participantSnapshots.docs.forEach(doc => {
    batch.delete(doc.ref)
  })

  // Anonymize results (keep for analytics but remove PII)
  const resultsSnapshots = await getDocs(
    query(
      collectionGroup(db, 'results'),
      where('userId', '==', userId),
      where('organizationId', '==', organizationId)
    )
  )

  resultsSnapshots.docs.forEach(doc => {
    batch.update(doc.ref, {
      participantName: 'Anonymous User',
      email: null,
      userId: null,
      gdprDeleted: true,
      deletedAt: serverTimestamp()
    })
  })

  await batch.commit()
}
```

## Performance Considerations

### Database Optimization

```javascript
// Efficient pagination
export const usePaginatedQuery = (baseQuery, pageSize = 25) => {
  const [documents, setDocuments] = useState([])
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const loadMore = async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      let q = query(baseQuery, limit(pageSize))
      if (lastDoc) {
        q = query(q, startAfter(lastDoc))
      }

      const snapshot = await getDocs(q)
      const newDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      setDocuments(prev => [...prev, ...newDocs])
      setLastDoc(snapshot.docs[snapshot.docs.length - 1])
      setHasMore(snapshot.docs.length === pageSize)
    } finally {
      setLoading(false)
    }
  }

  return { documents, loadMore, hasMore, loading }
}

// Background data prefetching
export const useDataPrefetch = (prefetchQueries) => {
  useEffect(() => {
    const prefetchData = async () => {
      const prefetchPromises = prefetchQueries.map(async (query) => {
        try {
          const snapshot = await getDocs(query)
          // Store in browser cache for later use
          const cacheKey = `prefetch_${JSON.stringify(query)}`
          sessionStorage.setItem(cacheKey, JSON.stringify(snapshot.docs.map(doc => doc.data())))
        } catch (error) {
          console.warn('Prefetch failed:', error)
        }
      })

      await Promise.all(prefetchPromises)
    }

    // Prefetch after a short delay to not block initial render
    const timeoutId = setTimeout(prefetchData, 100)
    return () => clearTimeout(timeoutId)
  }, [prefetchQueries])
}
```

### Client-side Caching

```javascript
// Service Worker for offline support
// sw.js
const CACHE_NAME = 'traind-v1'
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', (event) => {
  // Cache-first strategy for static assets
  if (event.request.url.includes('/static/')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    )
  }

  // Network-first strategy for API calls
  if (event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    )
  }
})
```

## Deployment Architecture

### Firebase Hosting Configuration

```json
// firebase.json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": [
    {
      "target": "platform-admin",
      "public": "dist/admin",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ],
      "headers": [
        {
          "source": "**/*.@(js|css)",
          "headers": [
            {
              "key": "Cache-Control",
              "value": "max-age=31536000"
            }
          ]
        }
      ]
    },
    {
      "target": "app",
      "public": "dist/app",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  ],
  "functions": {
    "source": "functions",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  }
}
```

### Cloud Functions

```javascript
// functions/src/index.js
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { stripe } from './billing.js'

// Handle new organization creation
export const onOrganizationCreated = onDocumentCreated(
  'organizations/{orgId}',
  async (event) => {
    const orgData = event.data.data()

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: orgData.ownerEmail,
      name: orgData.name,
      metadata: {
        organizationId: event.params.orgId
      }
    })

    // Update organization with Stripe customer ID
    await event.data.ref.update({
      'subscription.stripeCustomerId': customer.id
    })
  }
)

// Handle subscription updates
export const onSubscriptionUpdated = onDocumentUpdated(
  'organizations/{orgId}',
  async (event) => {
    const before = event.data.before.data()
    const after = event.data.after.data()

    // Check if subscription changed
    if (before.subscription.plan !== after.subscription.plan) {
      // Update module access based on new plan
      await updateModuleAccess(event.params.orgId, after.subscription.plan)
    }
  }
)

// Scheduled cleanup of expired sessions
export const cleanupExpiredSessions = onSchedule(
  'every 24 hours',
  async () => {
    const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

    const expiredSessions = await db
      .collectionGroup('sessions')
      .where('status', '==', 'completed')
      .where('endTime', '<', expiredDate)
      .get()

    const batch = db.batch()
    expiredSessions.docs.forEach(doc => {
      batch.delete(doc.ref)
    })

    await batch.commit()
  }
)
```

### Environment Configuration

```javascript
// .env.production
VITE_FIREBASE_API_KEY=production_api_key
VITE_FIREBASE_AUTH_DOMAIN=traind-platform.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=traind-platform
VITE_FIREBASE_STORAGE_BUCKET=traind-platform.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_APP_ENV=production
VITE_API_BASE_URL=https://us-central1-traind-platform.cloudfunctions.net

// Build configuration for multi-target deployment
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      },
      output: {
        dir: 'dist',
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId && facadeModuleId.includes('admin')) {
            return 'admin/[name]-[hash].js'
          }
          return 'app/[name]-[hash].js'
        }
      }
    }
  }
})
```

## Migration Strategy

### Phase 1: Foundation Setup (Weeks 1-2)

```javascript
// Migration utilities
export class MigrationManager {
  constructor() {
    this.db = getFirestore()
    this.migrationHistory = []
  }

  async runMigration(migrationName, migrationFn) {
    console.log(`Starting migration: ${migrationName}`)

    try {
      await migrationFn()
      await this.recordMigration(migrationName, 'success')
      console.log(`Migration completed: ${migrationName}`)
    } catch (error) {
      await this.recordMigration(migrationName, 'failed', error.message)
      throw error
    }
  }

  async recordMigration(name, status, error = null) {
    await addDoc(collection(this.db, 'migration_history'), {
      name,
      status,
      error,
      timestamp: serverTimestamp()
    })
  }
}

// Example migration: Convert single-tenant to multi-tenant
const migrateSingleTenantData = async () => {
  const migration = new MigrationManager()

  await migration.runMigration('create-default-organization', async () => {
    // Create default organization for existing data
    const defaultOrg = {
      id: 'default-org',
      name: 'Default Organization',
      subscription: {
        plan: 'professional',
        status: 'active',
        modules: ['quiz', 'millionaire', 'bingo']
      },
      branding: {
        primaryColor: '#3b82f6',
        secondaryColor: '#1e40af',
        theme: 'corporate'
      }
    }

    await setDoc(doc(db, 'organizations', 'default-org'), defaultOrg)
  })

  await migration.runMigration('migrate-existing-sessions', async () => {
    // Move existing sessions to organization structure
    const existingSessions = await getDocs(collection(db, 'quizzes'))
    const batch = writeBatch(db)

    existingSessions.docs.forEach(doc => {
      const sessionData = doc.data()
      const newRef = doc(db, 'organizations', 'default-org', 'sessions', doc.id)
      batch.set(newRef, sessionData)
    })

    await batch.commit()
  })
}
```

### Data Migration Scripts

```javascript
// scripts/migrate-to-multi-tenant.js
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const runDataMigration = async () => {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  if (process.env.NODE_ENV === 'development') {
    connectFirestoreEmulator(db, 'localhost', 8080)
  }

  console.log('Starting data migration to multi-tenant architecture...')

  try {
    await migrateSingleTenantData()
    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDataMigration()
}
```

This comprehensive architecture documentation provides the technical foundation for implementing the Traind SaaS platform while maintaining the performance and user experience of the existing TrainingQuiz system.
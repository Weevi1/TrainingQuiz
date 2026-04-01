// Organization cache — single Firestore read per org per participant session.
// In-memory cache with sessionStorage persistence and request deduplication.
// When 50 participants join simultaneously, only ONE Firestore read occurs per org.

import { FirestoreService, type Organization } from './firestore'

const CACHE_KEY_PREFIX = 'traind_org_'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// In-memory cache (instant, survives page navigations within SPA)
const memoryCache = new Map<string, { org: Organization; cachedAt: number }>()

// Deduplication: concurrent requests for the same org share a single fetch
const inflightRequests = new Map<string, Promise<Organization | null>>()

function isExpired(cachedAt: number): boolean {
  return Date.now() - cachedAt > CACHE_TTL_MS
}

/** Store org in both memory and sessionStorage */
export function cacheOrganization(org: Organization): void {
  if (!org.id) return
  memoryCache.set(org.id, { org, cachedAt: Date.now() })
  try {
    sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${org.id}`,
      JSON.stringify({ org, cachedAt: Date.now() })
    )
  } catch {
    // sessionStorage full or unavailable — memory cache still works
  }
}

/** Read from memory → sessionStorage → null */
export function getCachedOrganization(orgId: string): Organization | null {
  // Check memory first (fastest)
  const mem = memoryCache.get(orgId)
  if (mem && !isExpired(mem.cachedAt)) return mem.org
  if (mem) memoryCache.delete(orgId)

  // Fall back to sessionStorage (survives full page reloads)
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${orgId}`)
    if (raw) {
      const entry = JSON.parse(raw) as { org: Organization; cachedAt: number }
      if (!isExpired(entry.cachedAt)) {
        memoryCache.set(orgId, entry) // Promote to memory
        return entry.org
      }
      sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${orgId}`)
    }
  } catch {
    // Corrupted or unavailable — ignore
  }
  return null
}

/**
 * Get organization with automatic caching and request deduplication.
 * Multiple concurrent calls for the same orgId share a single Firestore read.
 */
export async function getOrganizationCached(orgId: string): Promise<Organization | null> {
  // 1. Check cache
  const cached = getCachedOrganization(orgId)
  if (cached) return cached

  // 2. Deduplicate: if a fetch is already in-flight, piggyback on it
  const inflight = inflightRequests.get(orgId)
  if (inflight) return inflight

  // 3. Fetch from Firestore (single read for all concurrent callers)
  const promise = FirestoreService.getOrganization(orgId)
    .then(org => {
      if (org) cacheOrganization(org)
      return org
    })
    .finally(() => {
      inflightRequests.delete(orgId)
    })

  inflightRequests.set(orgId, promise)
  return promise
}

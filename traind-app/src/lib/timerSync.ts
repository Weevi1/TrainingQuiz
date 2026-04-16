// Clock-independent time sync using Firebase RTDB /.info/serverTimeOffset.
// Every device (trainer + participants) subscribes to the offset once on load.
// serverNow() returns the current server time regardless of device clock drift.
// All timer anchors and elapsed calculations use serverNow() instead of Date.now().

import { ref, onValue, get } from 'firebase/database'
import { rtdb } from './firebase'

let serverOffset = 0
let offsetReady = false
let readyCallbacks: Array<() => void> = []

// Subscribe to Firebase RTDB server time offset (runs once on import)
const offsetRef = ref(rtdb, '.info/serverTimeOffset')
onValue(offsetRef, (snapshot) => {
  serverOffset = snapshot.val() || 0
  if (!offsetReady) {
    offsetReady = true
    readyCallbacks.forEach(cb => cb())
    readyCallbacks = []
  }
}, (error) => {
  // RTDB listener failed — resolve pending waiters with offset=0 (Date.now() fallback)
  console.warn('RTDB server offset listener failed:', error)
  if (!offsetReady) {
    offsetReady = true
    readyCallbacks.forEach(cb => cb())
    readyCallbacks = []
  }
})

// Refresh server offset when tab becomes visible again (mobile tab suspension recovery).
// The onValue listener may have a stale offset after the tab was backgrounded.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      get(offsetRef).then((snapshot) => {
        serverOffset = snapshot.val() || 0
      }).catch(() => {
        // Best-effort — existing offset is still usable
      })
    }
  })
}

/**
 * Returns current server time in ms, corrected for device clock drift.
 * Safe to call before offset is ready — falls back to Date.now().
 */
export function serverNow(): number {
  return Date.now() + serverOffset
}

/**
 * Returns a promise that resolves when the server offset has been received.
 * Useful for one-time checks; most code should just call serverNow() directly.
 */
export function waitForOffset(): Promise<void> {
  if (offsetReady) return Promise.resolve()
  return new Promise(resolve => {
    readyCallbacks.push(resolve)
  })
}

/**
 * Returns the current server offset in ms (positive = device ahead of server).
 * Mostly for debugging.
 */
export function getServerOffset(): number {
  return serverOffset
}

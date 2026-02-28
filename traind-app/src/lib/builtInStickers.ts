// Built-in animated sticker avatars — platform-level defaults
// These are available to all orgs even without custom uploads.
// URLs point to platform/stickers/ in Firebase Storage.
// For initial development, this array is empty — stickers need to be
// created/sourced and uploaded to Firebase Storage manually.
// When uploaded, add their download URLs here.

import type { MediaItem } from './firestore'

export const BUILT_IN_STICKERS: MediaItem[] = [
  // Stickers will be added here once MP4s are uploaded to
  // gs://traind-platform.appspot.com/platform/stickers/
  // Example:
  // {
  //   id: 'builtin-star',
  //   url: 'https://firebasestorage.googleapis.com/...',
  //   thumbnailUrl: 'https://firebasestorage.googleapis.com/...',
  //   label: 'Star',
  //   isBuiltIn: true
  // },
]

#!/usr/bin/env node
/**
 * Upload demo GIF assets to a tenant as reactions + stickers.
 *
 * Usage: node scripts/upload-demo-assets.mjs <orgName>
 *
 * Converts GIFs → MP4 (200px max) + WebP thumbnail, uploads to Firebase Storage,
 * updates Firestore branding.reactions and branding.stickers.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { execSync } from 'child_process'
import { readFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, basename, parse } from 'path'
import { randomUUID } from 'crypto'

// Data lives in dev-prefixed collections (prod would be just 'organizations')
const COLLECTION_PREFIX = 'dev-'

// Firebase Admin init
if (!getApps().length) {
  const possibleKeys = [
    join(import.meta.dirname, '..', 'service-account.json'),
    join(import.meta.dirname, '..', 'service-account-key.json'),
  ]
  let foundKey = null
  for (const k of possibleKeys) {
    if (existsSync(k)) { foundKey = k; break }
  }

  if (foundKey) {
    const sa = JSON.parse(readFileSync(foundKey, 'utf8'))
    initializeApp({
      credential: cert(sa),
      projectId: 'traind-platform',
      storageBucket: 'traind-platform.firebasestorage.app'
    })
  } else {
    console.log('No service account key found. Place service-account.json in project root.')
    process.exit(1)
  }
}

const db = getFirestore()
const bucket = getStorage().bucket()
const ORG_COLLECTION = `${COLLECTION_PREFIX}organizations`

const DEMO_DIR = join(import.meta.dirname, '..', 'demo-assets')
const TMP_DIR = join(DEMO_DIR, '.tmp')

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })

async function findOrg(name) {
  const snapshot = await db.collection(ORG_COLLECTION).get()
  for (const doc of snapshot.docs) {
    const data = doc.data()
    if (data.name && data.name.toLowerCase().includes(name.toLowerCase())) {
      return { id: doc.id, ...data }
    }
  }
  return null
}

function convertGifToMp4(gifPath, mp4Path, maxDim = 200) {
  execSync(
    `ffmpeg -y -i "${gifPath}" -movflags faststart -pix_fmt yuv420p -vf "scale='min(${maxDim},iw)':'min(${maxDim},ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" "${mp4Path}"`,
    { stdio: 'pipe' }
  )
}

function extractThumbnail(gifPath, webpPath, maxDim = 256) {
  execSync(
    `ffmpeg -y -i "${gifPath}" -vframes 1 -vf "scale='min(${maxDim},iw)':'min(${maxDim},ih)':force_original_aspect_ratio=decrease" "${webpPath}"`,
    { stdio: 'pipe' }
  )
}

async function uploadFile(localPath, storagePath, contentType) {
  const file = bucket.file(storagePath)
  await file.save(readFileSync(localPath), { contentType, public: true })
  const encodedPath = encodeURIComponent(storagePath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`
}

async function processAndUpload(orgId, gifPath, storagePrefixPath) {
  const id = randomUUID().slice(0, 8)
  const name = parse(basename(gifPath)).name
  const mp4Path = join(TMP_DIR, `${id}.mp4`)
  const thumbPath = join(TMP_DIR, `${id}_thumb.webp`)

  console.log(`  Converting ${basename(gifPath)} → MP4 + WebP...`)
  convertGifToMp4(gifPath, mp4Path)
  extractThumbnail(gifPath, thumbPath)

  console.log(`  Uploading ${name}...`)
  const url = await uploadFile(join(TMP_DIR, `${id}.mp4`), `${storagePrefixPath}/${id}.mp4`, 'video/mp4')
  const thumbnailUrl = await uploadFile(join(TMP_DIR, `${id}_thumb.webp`), `${storagePrefixPath}/${id}_thumb.webp`, 'image/webp')

  return { id, url, thumbnailUrl, label: name }
}

async function main() {
  const orgName = process.argv[2]
  if (!orgName) {
    console.log('Available organizations:')
    const snapshot = await db.collection(ORG_COLLECTION).get()
    snapshot.docs.forEach(doc => {
      console.log(`  - ${doc.data().name} (${doc.id})`)
    })
    console.log(`\nUsage: node scripts/upload-demo-assets.mjs <org-name-fragment>`)
    process.exit(1)
  }

  const org = await findOrg(orgName)
  if (!org) {
    console.error(`No organization found matching "${orgName}"`)
    process.exit(1)
  }

  console.log(`Found org: ${org.name} (${org.id})`)

  const reactions = { correct: [], incorrect: [], celebration: [] }
  const stickers = []

  // Process reactions (correct, incorrect, celebration)
  for (const category of ['correct', 'incorrect', 'celebration']) {
    const dir = join(DEMO_DIR, category)
    if (!existsSync(dir)) continue
    const files = readdirSync(dir).filter(f => f.endsWith('.gif'))
    console.log(`\n${category.toUpperCase()} (${files.length} files):`)
    for (const file of files) {
      const item = await processAndUpload(
        org.id,
        join(dir, file),
        `organizations/${org.id}/media/reactions/${category}`
      )
      reactions[category].push(item)
    }
  }

  // Process avatars as stickers
  const avatarDir = join(DEMO_DIR, 'avatars')
  if (existsSync(avatarDir)) {
    const files = readdirSync(avatarDir).filter(f => f.endsWith('.gif'))
    console.log(`\nSTICKERS/AVATARS (${files.length} files):`)
    for (const file of files) {
      const item = await processAndUpload(
        org.id,
        join(avatarDir, file),
        `organizations/${org.id}/media/stickers`
      )
      stickers.push(item)
    }
  }

  // Update Firestore
  console.log('\nUpdating Firestore branding...')
  const orgRef = db.collection(ORG_COLLECTION).doc(org.id)
  const updateData = {}

  if (reactions.correct.length) updateData['branding.correct'] = reactions.correct
  if (reactions.incorrect.length) updateData['branding.incorrect'] = reactions.incorrect
  if (reactions.celebration.length) updateData['branding.celebration'] = reactions.celebration
  if (stickers.length) updateData['branding.stickers'] = stickers

  await orgRef.update(updateData)

  console.log('\nDone! Uploaded:')
  console.log(`  Correct reactions: ${reactions.correct.length}`)
  console.log(`  Incorrect reactions: ${reactions.incorrect.length}`)
  console.log(`  Celebration reactions: ${reactions.celebration.length}`)
  console.log(`  Stickers: ${stickers.length}`)

  // Cleanup tmp
  execSync(`rm -rf "${TMP_DIR}"`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

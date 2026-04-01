#!/usr/bin/env node
/**
 * Upload platform-wide avatar stickers to Firebase Storage.
 *
 * Usage: node scripts/upload-platform-stickers.mjs
 *
 * Converts GIFs in demo-assets/avatars/ → MP4 + WebP thumbnail,
 * uploads to gs://traind-platform.firebasestorage.app/platform/stickers/,
 * and outputs TypeScript for builtInStickers.ts.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { execSync } from 'child_process'
import { readFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, parse } from 'path'
import { randomUUID } from 'crypto'

// Firebase Admin init
if (!getApps().length) {
  const keyPath = join(import.meta.dirname, '..', 'service-account.json')
  if (!existsSync(keyPath)) {
    console.error('No service-account.json found in project root.')
    process.exit(1)
  }
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'))
  initializeApp({
    credential: cert(sa),
    projectId: 'traind-platform',
    storageBucket: 'traind-platform.firebasestorage.app'
  })
}

const bucket = getStorage().bucket()
const AVATAR_DIR = join(import.meta.dirname, '..', 'demo-assets', 'avatars')
const TMP_DIR = join(import.meta.dirname, '..', 'demo-assets', '.tmp')
const STORAGE_PREFIX = 'platform/stickers'

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })

function convertGifToMp4(gifPath, mp4Path) {
  execSync(
    `ffmpeg -y -i "${gifPath}" -movflags faststart -pix_fmt yuv420p -vf "scale='min(200,iw)':'min(200,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -profile:v baseline -level 3.0 -preset fast -crf 23 -an "${mp4Path}"`,
    { stdio: 'pipe' }
  )
}

function extractThumbnail(gifPath, webpPath) {
  execSync(
    `ffmpeg -y -i "${gifPath}" -vframes 1 -vf "scale='min(128,iw)':'min(128,ih)':force_original_aspect_ratio=decrease" "${webpPath}"`,
    { stdio: 'pipe' }
  )
}

async function uploadFile(localPath, storagePath, contentType) {
  const file = bucket.file(storagePath)
  await file.save(readFileSync(localPath), { contentType, public: true })
  const encodedPath = encodeURIComponent(storagePath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`
}

async function main() {
  const files = readdirSync(AVATAR_DIR).filter(f => f.endsWith('.gif')).sort()
  console.log(`Found ${files.length} avatar GIFs in ${AVATAR_DIR}\n`)

  const stickers = []

  for (const file of files) {
    const id = randomUUID().slice(0, 8)
    const name = parse(file).name.replace('avatar-', '')
    const label = name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
    const gifPath = join(AVATAR_DIR, file)
    const mp4Path = join(TMP_DIR, `${id}.mp4`)
    const thumbPath = join(TMP_DIR, `${id}_thumb.webp`)

    console.log(`  [${stickers.length + 1}/${files.length}] ${file} → ${label}`)

    convertGifToMp4(gifPath, mp4Path)
    extractThumbnail(gifPath, thumbPath)

    const url = await uploadFile(mp4Path, `${STORAGE_PREFIX}/${id}.mp4`, 'video/mp4')
    const thumbnailUrl = await uploadFile(thumbPath, `${STORAGE_PREFIX}/${id}_thumb.webp`, 'image/webp')

    stickers.push({ id: `builtin-${name}`, url, thumbnailUrl, label })
  }

  // Output TypeScript
  console.log('\n\n// === Copy this into builtInStickers.ts ===\n')
  console.log('export const BUILT_IN_STICKERS: MediaItem[] = [')
  for (const s of stickers) {
    console.log(`  {`)
    console.log(`    id: '${s.id}',`)
    console.log(`    url: '${s.url}',`)
    console.log(`    thumbnailUrl: '${s.thumbnailUrl}',`)
    console.log(`    label: '${s.label}',`)
    console.log(`    isBuiltIn: true,`)
    console.log(`  },`)
  }
  console.log(']')

  // Cleanup tmp
  execSync(`rm -rf "${TMP_DIR}"`)

  console.log(`\nDone! Uploaded ${stickers.length} platform stickers.`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

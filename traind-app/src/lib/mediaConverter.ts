// Media Converter — FFmpeg WASM lazy-loader for client-side GIF→MP4 conversion
// Uses single-threaded @ffmpeg/core (no SharedArrayBuffer/COOP/COEP headers needed)

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

const CORE_VERSION = '0.12.6'
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`

/**
 * Lazy-load FFmpeg WASM singleton (~25MB, browser-cached after first load).
 * Only called in Settings upload flow — never on participant devices.
 */
export async function getFFmpeg(
  onProgress?: (message: string) => void
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    onProgress?.('Loading conversion engine...')
    const ffmpeg = new FFmpeg()

    ffmpeg.on('log', ({ message }) => {
      // Forward FFmpeg logs for debugging
      if (import.meta.env.DEV) {
        console.log('[FFmpeg]', message)
      }
    })

    await ffmpeg.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegInstance = ffmpeg
    onProgress?.('Conversion engine ready')
    return ffmpeg
  })()

  return loadPromise
}

/** Check if a file is an animated format that needs GIF→MP4 conversion */
export function needsConversion(file: File): boolean {
  return file.type === 'image/gif' || file.type === 'image/webp'
}

/** Check if a file is already a usable video format */
export function isVideoFile(file: File): boolean {
  return file.type === 'video/mp4' || file.type === 'video/webm'
}

interface ConvertOptions {
  maxWidth?: number
  maxHeight?: number
  maxDurationSec?: number
  keepAudio?: boolean              // Retain audio track (for interstitial animations)
  crf?: number                     // Quality (lower = bigger/better, default 23)
  onProgress?: (ratio: number) => void
  onMessage?: (message: string) => void
}

/**
 * Convert GIF (or other animated image) to H.264 MP4.
 * Returns the MP4 file and a static WebP thumbnail of the first frame.
 *
 * @param file - Input GIF/WebP/WebM file (max 5MB)
 * @param opts - Conversion options (dimensions, duration, progress callback)
 */
export async function convertToMp4(
  file: File,
  opts: ConvertOptions = {}
): Promise<{ mp4: File; thumbnail: File }> {
  const {
    maxWidth = 480,
    maxHeight = 480,
    maxDurationSec = 10,
    keepAudio = false,
    crf = 23,
    onProgress,
    onMessage
  } = opts

  // Validate input
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File must be under 5MB')
  }

  const ffmpeg = await getFFmpeg(onMessage)

  // Set up progress tracking
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.min(progress, 1))
    })
  }

  const inputName = `input.${getExtension(file)}`
  const outputName = 'output.mp4'
  const thumbName = 'thumb.webp'

  // Write input file to FFmpeg virtual filesystem
  await ffmpeg.writeFile(inputName, await fetchFile(file))

  onMessage?.('Converting animation...')

  // Convert to H.264 MP4
  // -t: max duration, -vf: scale with aspect ratio preservation,
  // -c:v libx264: H.264 codec (widest device support),
  // -profile baseline: iOS/Android compatible, -pix_fmt yuv420p: universal playback,
  // -movflags +faststart: web streaming optimization
  const audioArgs = keepAudio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']

  await ffmpeg.exec([
    '-i', inputName,
    '-t', String(maxDurationSec),
    '-vf', `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2`,
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', String(crf),
    ...audioArgs,
    '-movflags', '+faststart',
    outputName
  ])

  // Extract first frame as WebP thumbnail
  await ffmpeg.exec([
    '-i', inputName,
    '-vframes', '1',
    '-vf', `scale='min(200,iw)':'min(200,ih)':force_original_aspect_ratio=decrease`,
    thumbName
  ])

  // Read output files
  const mp4Data = await ffmpeg.readFile(outputName)
  const thumbData = await ffmpeg.readFile(thumbName)

  // Clean up virtual filesystem
  await ffmpeg.deleteFile(inputName)
  await ffmpeg.deleteFile(outputName)
  await ffmpeg.deleteFile(thumbName)

  const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })
  const thumbBlob = new Blob([thumbData], { type: 'image/webp' })

  const baseName = file.name.replace(/\.\w+$/, '')

  return {
    mp4: new File([mp4Blob], `${baseName}.mp4`, { type: 'video/mp4' }),
    thumbnail: new File([thumbBlob], `${baseName}_thumb.webp`, { type: 'image/webp' })
  }
}

/**
 * Extract a static WebP thumbnail from an existing video file (MP4/WebM).
 */
export async function extractThumbnail(file: File): Promise<File> {
  const ffmpeg = await getFFmpeg()

  const inputName = `input.${getExtension(file)}`
  const thumbName = 'thumb.webp'

  await ffmpeg.writeFile(inputName, await fetchFile(file))

  await ffmpeg.exec([
    '-i', inputName,
    '-vframes', '1',
    '-vf', `scale='min(200,iw)':'min(200,ih)':force_original_aspect_ratio=decrease`,
    thumbName
  ])

  const thumbData = await ffmpeg.readFile(thumbName)

  await ffmpeg.deleteFile(inputName)
  await ffmpeg.deleteFile(thumbName)

  const thumbBlob = new Blob([thumbData], { type: 'image/webp' })
  const baseName = file.name.replace(/\.\w+$/, '')

  return new File([thumbBlob], `${baseName}_thumb.webp`, { type: 'image/webp' })
}

function getExtension(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext) return ext
  // Fallback based on MIME type
  const mimeMap: Record<string, string> = {
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm'
  }
  return mimeMap[file.type] || 'bin'
}

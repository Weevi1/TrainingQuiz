/**
 * Client-side image resizing for logo uploads.
 * Resizes images to optimal dimensions before uploading to Firebase Storage,
 * reducing storage costs and improving load times across the app.
 */

interface ResizeOptions {
  /** Maximum width in pixels */
  maxWidth: number
  /** Maximum height in pixels */
  maxHeight: number
  /** Output quality (0-1) for JPEG/WebP. Ignored for PNG. */
  quality: number
  /** Output format */
  outputType: 'image/webp' | 'image/png' | 'image/jpeg'
}

const LOGO_DEFAULTS: ResizeOptions = {
  maxWidth: 400,
  maxHeight: 200,
  quality: 0.85,
  outputType: 'image/webp'
}

/**
 * Resizes an image File to the specified max dimensions while preserving
 * aspect ratio. Returns a new File in WebP format for optimal size.
 * Transparent PNGs are preserved with alpha channel.
 */
export async function resizeImage(
  file: File,
  options: Partial<ResizeOptions> = {}
): Promise<File> {
  const opts = { ...LOGO_DEFAULTS, ...options }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Only downscale, never upscale
      if (width <= opts.maxWidth && height <= opts.maxHeight) {
        // Image is already small enough — still convert to WebP for consistency
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Failed to process image'))
            const resized = new File([blob], file.name.replace(/\.\w+$/, '.webp'), {
              type: opts.outputType
            })
            resolve(resized)
          },
          opts.outputType,
          opts.quality
        )
        return
      }

      // Calculate new dimensions preserving aspect ratio
      const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height)
      const newWidth = Math.round(width * ratio)
      const newHeight = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext('2d')!
      // Use high-quality downscaling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to resize image'))
          const resized = new File([blob], file.name.replace(/\.\w+$/, '.webp'), {
            type: opts.outputType
          })
          resolve(resized)
        },
        opts.outputType,
        opts.quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for resizing'))
    }

    img.src = url
  })
}

/** Convenience: resize specifically for org logos (400×200 max, WebP) */
export function resizeLogo(file: File): Promise<File> {
  return resizeImage(file, LOGO_DEFAULTS)
}

/** Convenience: resize specifically for signatures (600×200 max, WebP) */
export function resizeSignature(file: File): Promise<File> {
  return resizeImage(file, {
    maxWidth: 600,
    maxHeight: 200,
    quality: 0.85,
    outputType: 'image/webp'
  })
}

/** Convenience: resize for sticker thumbnails (200×200 max, WebP) */
export function resizeStickerThumbnail(file: File): Promise<File> {
  return resizeImage(file, {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.80,
    outputType: 'image/webp'
  })
}

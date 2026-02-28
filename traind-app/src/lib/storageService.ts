import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export class StorageService {
  static async uploadLogo(orgId: string, file: File): Promise<string> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size must be under 2MB')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('File must be a PNG, JPG, or WebP image')
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const storageRef = ref(storage, `organizations/${orgId}/branding/logo.${ext}`)
    await uploadBytes(storageRef, file, { contentType: file.type })
    return getDownloadURL(storageRef)
  }

  static async deleteLogo(orgId: string): Promise<void> {
    const extensions = ['png', 'jpg', 'jpeg', 'webp']
    for (const ext of extensions) {
      try {
        const storageRef = ref(storage, `organizations/${orgId}/branding/logo.${ext}`)
        await deleteObject(storageRef)
      } catch {
        // File with this extension doesn't exist, continue
      }
    }
  }

  static async uploadSignature(orgId: string, file: File): Promise<string> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size must be under 2MB')
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('File must be a PNG, JPG, or WebP image')
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const storageRef = ref(storage, `organizations/${orgId}/branding/signature.${ext}`)
    await uploadBytes(storageRef, file, { contentType: file.type })
    return getDownloadURL(storageRef)
  }

  static async deleteSignature(orgId: string): Promise<void> {
    const extensions = ['png', 'jpg', 'jpeg', 'webp']
    for (const ext of extensions) {
      try {
        const storageRef = ref(storage, `organizations/${orgId}/branding/signature.${ext}`)
        await deleteObject(storageRef)
      } catch {
        // File with this extension doesn't exist, continue
      }
    }
  }

  // --- Media uploads (reactions & stickers) ---

  static async uploadReaction(
    orgId: string,
    category: 'correct' | 'incorrect' | 'celebration',
    id: string,
    file: File
  ): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new Error('File must be under 5MB')
    const storageRef = ref(storage, `organizations/${orgId}/media/reactions/${category}/${id}.mp4`)
    await uploadBytes(storageRef, file, { contentType: 'video/mp4' })
    return getDownloadURL(storageRef)
  }

  static async uploadReactionThumbnail(
    orgId: string,
    category: 'correct' | 'incorrect' | 'celebration',
    id: string,
    file: File
  ): Promise<string> {
    const storageRef = ref(storage, `organizations/${orgId}/media/reactions/${category}/${id}_thumb.webp`)
    await uploadBytes(storageRef, file, { contentType: 'image/webp' })
    return getDownloadURL(storageRef)
  }

  static async deleteReaction(
    orgId: string,
    category: 'correct' | 'incorrect' | 'celebration',
    id: string
  ): Promise<void> {
    const paths = [
      `organizations/${orgId}/media/reactions/${category}/${id}.mp4`,
      `organizations/${orgId}/media/reactions/${category}/${id}_thumb.webp`
    ]
    await Promise.all(paths.map(path => {
      return deleteObject(ref(storage, path)).catch(() => {})
    }))
  }

  static async uploadSticker(orgId: string, id: string, file: File): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new Error('File must be under 5MB')
    const storageRef = ref(storage, `organizations/${orgId}/media/stickers/${id}.mp4`)
    await uploadBytes(storageRef, file, { contentType: 'video/mp4' })
    return getDownloadURL(storageRef)
  }

  static async uploadStickerThumbnail(orgId: string, id: string, file: File): Promise<string> {
    const storageRef = ref(storage, `organizations/${orgId}/media/stickers/${id}_thumb.webp`)
    await uploadBytes(storageRef, file, { contentType: 'image/webp' })
    return getDownloadURL(storageRef)
  }

  static async deleteSticker(orgId: string, id: string): Promise<void> {
    const paths = [
      `organizations/${orgId}/media/stickers/${id}.mp4`,
      `organizations/${orgId}/media/stickers/${id}_thumb.webp`
    ]
    await Promise.all(paths.map(path => {
      return deleteObject(ref(storage, path)).catch(() => {})
    }))
  }

  // --- Animation uploads (interstitial custom animations) ---

  static async uploadAnimation(orgId: string, id: string, file: File): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new Error('File must be under 5MB')
    const storageRef = ref(storage, `organizations/${orgId}/media/animations/${id}.mp4`)
    await uploadBytes(storageRef, file, { contentType: 'video/mp4' })
    return getDownloadURL(storageRef)
  }

  static async uploadAnimationThumbnail(orgId: string, id: string, file: File): Promise<string> {
    const storageRef = ref(storage, `organizations/${orgId}/media/animations/${id}_thumb.webp`)
    await uploadBytes(storageRef, file, { contentType: 'image/webp' })
    return getDownloadURL(storageRef)
  }

  static async deleteAnimation(orgId: string, id: string): Promise<void> {
    const paths = [
      `organizations/${orgId}/media/animations/${id}.mp4`,
      `organizations/${orgId}/media/animations/${id}_thumb.webp`
    ]
    await Promise.all(paths.map(path => {
      return deleteObject(ref(storage, path)).catch(() => {})
    }))
  }
}

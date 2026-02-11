import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export class StorageService {
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
}

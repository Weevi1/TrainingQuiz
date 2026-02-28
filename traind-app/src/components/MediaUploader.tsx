// MediaUploader — Upload widget with FFmpeg GIF→MP4 conversion and preview grid
import React, { useState, useRef } from 'react'
import { Upload, X, Loader2, Film } from 'lucide-react'
import type { MediaItem } from '../lib/firestore'
import { needsConversion, isVideoFile, convertToMp4, extractThumbnail } from '../lib/mediaConverter'

interface MediaUploaderProps {
  label: string
  description: string
  items: MediaItem[]
  maxItems: number
  onUpload: (id: string, mp4: File, thumbnail: File, label: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  mediaType: 'reaction' | 'sticker' | 'animation'
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  label,
  description,
  items,
  maxItems,
  onUpload,
  onDelete,
  mediaType
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [converting, setConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [conversionMessage, setConversionMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const maxDimension = mediaType === 'animation' ? 720 : mediaType === 'sticker' ? 200 : 480

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    const id = crypto.randomUUID()
    const fileLabel = file.name.replace(/\.\w+$/, '')

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File must be under 5MB')
      }

      let mp4File: File
      let thumbnailFile: File

      if (needsConversion(file)) {
        setConverting(true)
        setConversionProgress(0)
        const isAnim = mediaType === 'animation'
        const result = await convertToMp4(file, {
          maxWidth: maxDimension,
          maxHeight: maxDimension,
          ...(isAnim && { maxDurationSec: 5, crf: 28, keepAudio: true }),
          onProgress: setConversionProgress,
          onMessage: setConversionMessage
        })
        mp4File = result.mp4
        thumbnailFile = result.thumbnail
        setConverting(false)
      } else if (isVideoFile(file)) {
        // For animations, always convert video files too (to enforce duration/size limits)
        if (mediaType === 'animation') {
          setConverting(true)
          setConversionProgress(0)
          const result = await convertToMp4(file, {
            maxWidth: maxDimension,
            maxHeight: maxDimension,
            maxDurationSec: 5,
            crf: 28,
            keepAudio: true,
            onProgress: setConversionProgress,
            onMessage: setConversionMessage
          })
          mp4File = result.mp4
          thumbnailFile = result.thumbnail
        } else {
          mp4File = file
          setConverting(true)
          setConversionMessage('Extracting thumbnail...')
          thumbnailFile = await extractThumbnail(file)
        }
        setConverting(false)
      } else {
        throw new Error('Unsupported file type. Use GIF or MP4.')
      }

      setUploading(true)
      await onUpload(id, mp4File, thumbnailFile, fileLabel)
    } catch (err: any) {
      setError(err.message || 'Failed to process media')
    } finally {
      setConverting(false)
      setUploading(false)
      setConversionProgress(0)
      setConversionMessage('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    setError(null)
    try {
      await onDelete(id)
    } catch (err: any) {
      setError(err.message || 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  const canAdd = items.length < maxItems && !converting && !uploading

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium" style={{ color: 'var(--text-color)' }}>{label}</h4>
        <p className="text-xs" style={{ color: 'var(--text-secondary-color)' }}>{description}</p>
      </div>

      {/* Item grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative group rounded-lg overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-hover-color)',
                border: '1px solid var(--border-color)',
                aspectRatio: '1'
              }}
            >
              <video
                src={item.url}
                autoPlay
                muted
                playsInline
                loop
                className="w-full h-full object-cover"
                poster={item.thumbnailUrl}
              />
              {!item.isBuiltIn && (
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: 'var(--error-color)', color: 'white' }}
                >
                  {deleting === item.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <X size={12} />
                  )}
                </button>
              )}
              <div
                className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversion progress */}
      {converting && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary-color)' }}>
            <Loader2 size={14} className="animate-spin" />
            <span>{conversionMessage || 'Converting...'}</span>
          </div>
          {conversionProgress > 0 && (
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(conversionProgress * 100)}%`,
                  backgroundColor: 'var(--primary-color)'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Upload progress */}
      {uploading && !converting && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary-color)' }}>
          <Loader2 size={14} className="animate-spin" />
          <span>Uploading...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm" style={{ color: 'var(--error-color)' }}>{error}</p>
      )}

      {/* Add button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/gif,video/mp4"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={!canAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        style={{
          backgroundColor: 'var(--surface-color)',
          border: '1px dashed var(--border-color)',
          color: 'var(--text-secondary-color)'
        }}
      >
        {converting || uploading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Film size={16} />
        )}
        {items.length >= maxItems
          ? `Maximum ${maxItems} reached`
          : `Add ${mediaType === 'animation' ? 'animation' : mediaType === 'sticker' ? 'sticker' : 'reaction'} (GIF or MP4)`
        }
      </button>
    </div>
  )
}

export default MediaUploader

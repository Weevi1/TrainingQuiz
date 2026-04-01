// StickerPicker — Animated sticker avatar selector for JoinSession
import React from 'react'
import type { MediaItem } from '../lib/firestore'

interface StickerPickerProps {
  stickers: MediaItem[]
  selectedAvatar: string
  onSelect: (avatar: string) => void
}

export const StickerPicker: React.FC<StickerPickerProps> = ({
  stickers,
  selectedAvatar,
  onSelect,
}) => {
  return (
    <div>
      <label className="block text-base font-medium mb-2" style={{ color: 'var(--text-color)' }}>
        Choose Your Avatar
      </label>

      <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
        {stickers.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => onSelect(sticker.url)}
            className={`w-14 h-14 rounded-xl transition-all overflow-hidden ${
              selectedAvatar === sticker.url ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
            }`}
            style={{
              backgroundColor: selectedAvatar === sticker.url
                ? 'var(--primary-light-color)'
                : 'var(--surface-color)',
              border: '1px solid',
              borderColor: selectedAvatar === sticker.url
                ? 'var(--primary-color)'
                : 'var(--border-color)',
              ringColor: 'var(--primary-color)'
            }}
            type="button"
          >
            <video
              src={sticker.url}
              autoPlay
              muted
              playsInline
              loop
              preload="none"
              className="w-full h-full object-cover"
              poster={sticker.thumbnailUrl}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export default StickerPicker

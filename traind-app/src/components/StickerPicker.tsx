// StickerPicker — Animated sticker + DiceBear + emoji avatar selector for JoinSession
import React, { useState, useMemo } from 'react'
import type { MediaItem } from '../lib/firestore'

interface StickerPickerProps {
  stickers: MediaItem[]
  selectedAvatar: string
  onSelect: (avatar: string) => void
  participantName?: string
}

const EMOJI_AVATARS = ['😀', '😎', '🤓', '🦊', '🐱', '🐼', '🦁', '🐸', '🦄', '🌟', '🚀', '💪']

// Vibrant pastel palette (matches AvatarDisplay)
const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// DiceBear styles to show as generated avatar options
const DICEBEAR_STYLES = [
  { style: 'fun-emoji', label: 'Fun' },
  { style: 'bottts-neutral', label: 'Robot' },
  { style: 'adventurer-neutral', label: 'Character' },
  { style: 'thumbs', label: 'Thumbs' },
  { style: 'lorelei-neutral', label: 'Portrait' },
  { style: 'notionists-neutral', label: 'Sketch' },
  { style: 'pixel-art-neutral', label: 'Pixel' },
  { style: 'shapes', label: 'Shapes' },
]

function diceBearUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`
}

type TabType = 'stickers' | 'generated' | 'emoji'

export const StickerPicker: React.FC<StickerPickerProps> = ({
  stickers,
  selectedAvatar,
  onSelect,
  participantName = ''
}) => {
  const hasStickers = stickers.length > 0

  // Default tab: generated (always available), stickers if org has them
  const [tab, setTab] = useState<TabType>(hasStickers ? 'stickers' : 'generated')

  // Generate DiceBear avatar URLs for the participant's name (or a default seed)
  const generatedAvatars = useMemo(() => {
    const seed = participantName.trim() || 'player'
    return DICEBEAR_STYLES.map(({ style, label }) => ({
      url: diceBearUrl(style, seed),
      label,
      style,
    }))
  }, [participantName])

  const tabs: { key: TabType; label: string }[] = [
    ...(hasStickers ? [{ key: 'stickers' as TabType, label: 'Stickers' }] : []),
    { key: 'generated', label: 'Generated' },
    { key: 'emoji', label: 'Emoji' },
  ]

  return (
    <div>
      <label className="block text-base font-medium mb-2" style={{ color: 'var(--text-color)' }}>
        Choose Your Avatar
      </label>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-3">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={tab === key
              ? { backgroundColor: 'var(--primary-color)', color: 'var(--text-on-primary-color)' }
              : { color: 'var(--text-secondary-color)', backgroundColor: 'var(--surface-color)' }
            }
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stickers tab */}
      {tab === 'stickers' && (
        <div className="grid grid-cols-4 gap-3">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => onSelect(sticker.url)}
              className={`w-16 h-16 rounded-xl transition-all overflow-hidden ${
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
                className="w-full h-full object-cover"
                poster={sticker.thumbnailUrl}
              />
            </button>
          ))}
        </div>
      )}

      {/* Generated (DiceBear) tab */}
      {tab === 'generated' && (
        <div>
          {!participantName.trim() && (
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary-color)' }}>
              Enter your name above to see personalized avatars
            </p>
          )}
          <div className="grid grid-cols-4 gap-3">
            {generatedAvatars.map(({ url, label }) => (
              <button
                key={url}
                onClick={() => onSelect(url)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  selectedAvatar === url ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: selectedAvatar === url
                    ? 'var(--primary-light-color)'
                    : 'var(--surface-color)',
                  border: '1px solid',
                  borderColor: selectedAvatar === url
                    ? 'var(--primary-color)'
                    : 'var(--border-color)',
                  ringColor: 'var(--primary-color)'
                }}
                type="button"
              >
                <img
                  src={url}
                  alt={label}
                  className="w-12 h-12 rounded-full"
                  style={{ backgroundColor: '#f3f4f6' }}
                  loading="lazy"
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary-color)' }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji tab */}
      {tab === 'emoji' && (
        <div className="grid grid-cols-6 gap-3">
          {EMOJI_AVATARS.map((emoji) => {
            const bgColor = AVATAR_COLORS[hashString(emoji) % AVATAR_COLORS.length]
            return (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className={`w-12 h-12 rounded-full transition-all flex items-center justify-center ${
                  selectedAvatar === emoji ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: bgColor,
                  border: '2px solid',
                  borderColor: selectedAvatar === emoji
                    ? 'var(--primary-color)'
                    : 'transparent',
                  ringColor: 'var(--primary-color)'
                }}
                type="button"
              >
                <span className="text-xl">{emoji}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default StickerPicker

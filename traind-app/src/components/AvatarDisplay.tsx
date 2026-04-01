// AvatarDisplay — Universal avatar renderer (emoji, animated sticker video, or image URL)
import React from 'react'

interface AvatarDisplayProps {
  avatar?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: { container: 'w-8 h-8', text: 'text-base', video: 'w-8 h-8', px: 32 },
  md: { container: 'w-12 h-12', text: 'text-xl', video: 'w-12 h-12', px: 48 },
  lg: { container: 'w-16 h-16', text: 'text-2xl', video: 'w-16 h-16', px: 64 },
  xl: { container: 'w-20 h-20', text: 'text-4xl', video: 'w-20 h-20', px: 80 },
}

// Vibrant pastel palette for emoji circle backgrounds
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

function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://')
}

function isImageUrl(str: string): boolean {
  return str.includes('.svg') || str.includes('.png') || str.includes('.jpg') || str.includes('.webp')
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  avatar = '\u{1F600}',
  size = 'md',
  className = ''
}) => {
  const s = sizeMap[size]

  // Image URLs (legacy DiceBear SVGs, static images) → render as <img>
  if (isUrl(avatar) && isImageUrl(avatar)) {
    return (
      <img
        src={avatar}
        alt="Avatar"
        className={`${s.container} rounded-full object-cover ${className}`}
        style={{ backgroundColor: '#f3f4f6' }}
        loading="lazy"
      />
    )
  }

  // Video URLs (animated stickers) → render as <video>
  if (isUrl(avatar)) {
    return (
      <video
        src={avatar}
        autoPlay
        muted
        playsInline
        loop
        className={`${s.video} rounded-full object-cover ${className}`}
      />
    )
  }

  // Emoji → render inside colored circle
  const bgColor = AVATAR_COLORS[hashString(avatar) % AVATAR_COLORS.length]

  return (
    <div
      className={`${s.container} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      <span className={s.text}>{avatar}</span>
    </div>
  )
}

export default AvatarDisplay

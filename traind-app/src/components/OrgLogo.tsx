import React from 'react'

interface OrgLogoProps {
  logo?: string
  orgName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: { img: 'h-8', monogram: 'w-8 h-8 text-xs' },
  md: { img: 'h-10', monogram: 'w-10 h-10 text-sm' },
  lg: { img: 'h-12', monogram: 'w-12 h-12 text-base' },
  xl: { img: 'h-16', monogram: 'w-16 h-16 text-xl' }
}

/** Generates initials from an org name, e.g. "ESI Attorneys" → "EA" */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

/**
 * Renders org logo image, or a styled monogram fallback using the org's
 * primary color. Use this everywhere the org identity should appear.
 * Respects the --logo-border-radius CSS variable set by BrandingContext.
 */
export const OrgLogo: React.FC<OrgLogoProps> = ({ logo, orgName, size = 'md', className = '' }) => {
  const s = sizeMap[size]

  if (logo) {
    return (
      <img
        src={logo}
        alt={orgName || 'Organization'}
        className={`${s.img} w-auto object-contain ${className}`}
        style={{ borderRadius: 'var(--logo-border-radius, 0)' }}
      />
    )
  }

  if (orgName) {
    return (
      <div
        className={`${s.monogram} rounded-lg flex items-center justify-center font-bold flex-shrink-0 ${className}`}
        style={{
          backgroundColor: 'var(--primary-color)',
          color: 'var(--text-on-primary-color)'
        }}
      >
        {getInitials(orgName)}
      </div>
    )
  }

  return null
}

import React, { useRef, type ReactNode } from 'react'
import { useViewportScale } from '../../hooks/useViewportScale'

interface PresenterCanvasProps {
  children: ReactNode
  designWidth?: number
  designHeight?: number
}

/**
 * Scales a fixed-size design canvas (default 1920x1080) to fit any screen.
 *
 * Uses the same approach as reveal.js / Google Slides:
 * - Content is authored at a fixed reference resolution
 * - A uniform scale factor is applied via CSS transform
 * - Letterbox/pillarbox bars appear when aspect ratios differ
 * - Content looks identical on every screen, just bigger/smaller
 */
export const PresenterCanvas: React.FC<PresenterCanvasProps> = ({
  children,
  designWidth = 1920,
  designHeight = 1080,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scale, offsetX, offsetY } = useViewportScale(
    containerRef,
    designWidth,
    designHeight
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
    >
      <div
        style={{
          width: designWidth,
          height: designHeight,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}

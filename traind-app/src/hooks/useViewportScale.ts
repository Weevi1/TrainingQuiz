import { useState, useEffect, type RefObject } from 'react'

interface ViewportScaleResult {
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Measures a container element via ResizeObserver and computes a uniform
 * scale factor to fit a fixed-size design canvas (default 1920x1080) within it.
 *
 * This is the same "slide canvas" pattern used by reveal.js and Google Slides:
 * design at a reference resolution, scale uniformly to fill any screen.
 */
export function useViewportScale(
  containerRef: RefObject<HTMLElement | null>,
  designWidth = 1920,
  designHeight = 1080
): ViewportScaleResult {
  const [result, setResult] = useState<ViewportScaleResult>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cw === 0 || ch === 0) return

      const scaleX = cw / designWidth
      const scaleY = ch / designHeight
      const scale = Math.min(scaleX, scaleY)

      const scaledWidth = designWidth * scale
      const scaledHeight = designHeight * scale

      setResult({
        scale,
        offsetX: (cw - scaledWidth) / 2,
        offsetY: (ch - scaledHeight) / 2,
      })
    }

    const observer = new ResizeObserver(update)
    observer.observe(el)

    return () => observer.disconnect()
  }, [designWidth, designHeight])

  return result
}

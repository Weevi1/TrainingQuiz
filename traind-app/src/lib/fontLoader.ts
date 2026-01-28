// Google Fonts Loader - Dynamically loads fonts based on theme

// Popular Google Fonts for different use cases
export const availableFonts = {
  // Sans-serif fonts
  'Inter': 'Inter:wght@300;400;500;600;700',
  'Open Sans': 'Open+Sans:wght@300;400;600;700',
  'Poppins': 'Poppins:wght@300;400;500;600;700',
  'Nunito': 'Nunito:wght@300;400;600;700',
  'Roboto': 'Roboto:wght@300;400;500;700',
  'Lato': 'Lato:wght@300;400;700',
  'Montserrat': 'Montserrat:wght@300;400;500;600;700',
  'Source Sans Pro': 'Source+Sans+Pro:wght@300;400;600;700',
  'Raleway': 'Raleway:wght@300;400;500;600;700',

  // Serif fonts
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
  'Merriweather': 'Merriweather:wght@300;400;700',
  'Lora': 'Lora:wght@400;500;600;700',
  'Georgia': 'none', // System font, no loading needed

  // Display/Decorative fonts
  'Cinzel': 'Cinzel:wght@400;500;600;700',
  'Cinzel Decorative': 'Cinzel+Decorative:wght@400;700',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',

  // Monospace fonts
  'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700',
  'Fira Code': 'Fira+Code:wght@400;500;600;700',
  'Source Code Pro': 'Source+Code+Pro:wght@400;500;600;700',

  // System fonts (no loading needed)
  'system-ui': 'none',
  'sans-serif': 'none',
  'serif': 'none',
  'monospace': 'none'
}

export type FontName = keyof typeof availableFonts

// Keep track of loaded fonts to avoid duplicate loading
const loadedFonts = new Set<string>()
let linkElement: HTMLLinkElement | null = null

/**
 * Extract the primary font name from a font stack
 * e.g., "Inter, system-ui, sans-serif" -> "Inter"
 */
export const extractPrimaryFont = (fontStack: string): string => {
  const firstFont = fontStack.split(',')[0].trim()
  // Remove quotes if present
  return firstFont.replace(/['"]/g, '')
}

/**
 * Check if a font is a system font that doesn't need loading
 */
const isSystemFont = (fontName: string): boolean => {
  const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'Georgia']
  return systemFonts.includes(fontName) || fontName.startsWith('-apple-system')
}

/**
 * Get the Google Fonts parameter for a font
 */
const getFontParam = (fontName: string): string | null => {
  const normalizedName = fontName as FontName
  const param = availableFonts[normalizedName]

  if (!param || param === 'none') {
    return null
  }

  return param
}

/**
 * Load a single Google Font
 */
export const loadFont = async (fontName: string): Promise<boolean> => {
  // Skip if already loaded or is a system font
  if (loadedFonts.has(fontName) || isSystemFont(fontName)) {
    return true
  }

  const fontParam = getFontParam(fontName)
  if (!fontParam) {
    console.warn(`Font "${fontName}" is not in the available fonts list`)
    return false
  }

  try {
    // Create or update the link element
    const url = `https://fonts.googleapis.com/css2?family=${fontParam}&display=swap`

    // Create a new link element for this font
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.id = `font-${fontName.replace(/\s+/g, '-').toLowerCase()}`

    // Check if already exists
    const existing = document.getElementById(link.id)
    if (existing) {
      loadedFonts.add(fontName)
      return true
    }

    // Add to document head
    document.head.appendChild(link)

    // Wait for font to load
    await new Promise<void>((resolve, reject) => {
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`Failed to load font: ${fontName}`))
      // Timeout after 5 seconds
      setTimeout(() => resolve(), 5000)
    })

    loadedFonts.add(fontName)
    console.log(`Font loaded: ${fontName}`)
    return true
  } catch (error) {
    console.error(`Error loading font "${fontName}":`, error)
    return false
  }
}

/**
 * Load multiple fonts at once
 */
export const loadFonts = async (fontNames: string[]): Promise<void> => {
  const uniqueFonts = [...new Set(fontNames)]
  const fontsToLoad = uniqueFonts.filter(font => !loadedFonts.has(font) && !isSystemFont(font))

  if (fontsToLoad.length === 0) {
    return
  }

  // Build a single URL with all fonts
  const fontParams = fontsToLoad
    .map(font => getFontParam(font))
    .filter((param): param is string => param !== null)

  if (fontParams.length === 0) {
    return
  }

  try {
    const url = `https://fonts.googleapis.com/css2?${fontParams.map(p => `family=${p}`).join('&')}&display=swap`

    // Remove existing combined link if any
    if (linkElement) {
      linkElement.remove()
    }

    // Create new combined link
    linkElement = document.createElement('link')
    linkElement.rel = 'stylesheet'
    linkElement.href = url
    linkElement.id = 'theme-fonts'

    document.head.appendChild(linkElement)

    // Wait for fonts to load
    await new Promise<void>((resolve) => {
      linkElement!.onload = () => resolve()
      // Timeout after 5 seconds
      setTimeout(() => resolve(), 5000)
    })

    fontsToLoad.forEach(font => loadedFonts.add(font))
    console.log(`Fonts loaded: ${fontsToLoad.join(', ')}`)
  } catch (error) {
    console.error('Error loading fonts:', error)
  }
}

/**
 * Load fonts for a theme's typography settings
 */
export const loadThemeFonts = async (
  fontFamily: string,
  fontFamilyHeading?: string
): Promise<void> => {
  const fonts: string[] = []

  // Extract primary font from font stack
  const primaryFont = extractPrimaryFont(fontFamily)
  if (primaryFont) {
    fonts.push(primaryFont)
  }

  // Add heading font if different
  if (fontFamilyHeading) {
    const headingFont = extractPrimaryFont(fontFamilyHeading)
    if (headingFont && headingFont !== primaryFont) {
      fonts.push(headingFont)
    }
  }

  await loadFonts(fonts)
}

/**
 * Preload popular fonts for better UX in theme picker
 */
export const preloadPopularFonts = async (): Promise<void> => {
  const popularFonts = [
    'Inter',
    'Poppins',
    'Playfair Display',
    'Cinzel',
    'Open Sans',
    'JetBrains Mono'
  ]

  await loadFonts(popularFonts)
}

/**
 * Get CSS font-family value with fallbacks
 */
export const getFontFamilyCSS = (fontName: string): string => {
  const systemFallbacks = {
    'sans-serif': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'serif': 'Georgia, "Times New Roman", serif',
    'monospace': '"SF Mono", Monaco, Consolas, "Liberation Mono", monospace'
  }

  // Determine appropriate fallback based on font type
  let fallback = systemFallbacks['sans-serif']

  if (['Playfair Display', 'Merriweather', 'Lora', 'Georgia', 'Cinzel', 'Cinzel Decorative', 'Cormorant Garamond'].includes(fontName)) {
    fallback = systemFallbacks['serif']
  } else if (['JetBrains Mono', 'Fira Code', 'Source Code Pro'].includes(fontName)) {
    fallback = systemFallbacks['monospace']
  }

  // Handle system fonts
  if (isSystemFont(fontName)) {
    return fallback
  }

  return `"${fontName}", ${fallback}`
}

/**
 * Check if fonts are available (for font picker previews)
 */
export const isFontLoaded = (fontName: string): boolean => {
  return loadedFonts.has(fontName) || isSystemFont(fontName)
}

/**
 * Get all loaded fonts
 */
export const getLoadedFonts = (): string[] => {
  return Array.from(loadedFonts)
}

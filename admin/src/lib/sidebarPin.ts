import { useCallback, useEffect, useState } from 'react'

/**
 * Whether the sidebar is pinned open. Each person's choice is remembered on this browser;
 * until they make one, it follows the screen: pinned on wide monitors, a rail on laptops.
 */
const KEY = 'ghtrust.sidebar.pinned'
const WIDE = '(min-width: 1280px)'

function storedChoice(): boolean | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === null ? null : value === '1'
  } catch {
    return null
  }
}

function isWide(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(WIDE).matches
}

export function useSidebarPin() {
  const [pinned, setPinned] = useState(() => storedChoice() ?? isWide())

  // No saved choice yet: keep following the screen size as the window changes.
  useEffect(() => {
    const media = window.matchMedia(WIDE)
    const onChange = (e: MediaQueryListEvent) => {
      if (storedChoice() === null) setPinned(e.matches)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const togglePinned = useCallback(() => {
    setPinned((current) => {
      const next = !current
      try {
        localStorage.setItem(KEY, next ? '1' : '0')
      } catch {
        // Storage unavailable (private mode): the choice lasts for this page only.
      }
      return next
    })
  }, [])

  return { pinned, togglePinned }
}

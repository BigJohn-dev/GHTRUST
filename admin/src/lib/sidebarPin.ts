import { useCallback, useSyncExternalStore } from 'react'

/** One curve and duration for every moving part of the sidebar, so they move as one:
 * a quick ease-out with no overshoot. */
export const SIDEBAR_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const SIDEBAR_MS = 260

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

// One shared value, so the sidebar and the profile page's preference stay in step.
let pinned = storedChoice() ?? isWide()
const listeners = new Set<() => void>()

function setPinned(next: boolean) {
  if (next === pinned) return
  pinned = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  // No saved choice yet: keep following the screen size as the window changes.
  window.matchMedia(WIDE).addEventListener('change', (e) => {
    if (storedChoice() === null) setPinned(e.matches)
  })
}

/**
 * Whether the sidebar is pinned open. Each person's choice is remembered on this browser;
 * until they make one, it follows the screen: pinned on wide monitors, a rail on laptops.
 */
export function useSidebarPin() {
  const value = useSyncExternalStore(subscribe, () => pinned)

  const togglePinned = useCallback(() => {
    const next = !pinned
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page only.
    }
    setPinned(next)
  }, [])

  return { pinned: value, togglePinned }
}

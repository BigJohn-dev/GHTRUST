/**
 * Scrollbars that appear while something scrolls and fade out once it stops. Scroll events
 * don't bubble, so one capturing listener marks whichever element is scrolling with
 * `data-scrolling`; index.css shows the thumb only while that attribute is present.
 */
const IDLE_MS = 900
const timers = new WeakMap<Element, number>()

function onScroll(event: Event) {
  const el = event.target === document ? document.documentElement : event.target
  if (!(el instanceof Element)) return
  el.setAttribute('data-scrolling', '')
  window.clearTimeout(timers.get(el))
  timers.set(
    el,
    window.setTimeout(() => el.removeAttribute('data-scrolling'), IDLE_MS),
  )
}

export function installScrollbars() {
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
}

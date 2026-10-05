// Oct 5 2026: remembers the last data each Admin Console panel loaded, so
// going back to a panel you already opened shows it straight away (no
// skeleton) while fresh data loads quietly in the background and replaces
// it. Kept in memory for this browser tab only: a page refresh, closing
// the tab or logging out clears it, and nothing is saved to the browser.
const store = new Map()

export function peek(key) {
  return store.get(key)
}

export function keep(key, value) {
  store.set(key, value)
  return value
}

export function forgetAll() {
  store.clear()
}

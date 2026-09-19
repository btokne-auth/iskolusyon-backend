// app/lib/offlineSync.js
//
// Offline resilience layer for the applicant portal. Two jobs:
//
//  1. DRAFT PERSISTENCE — mirrors personalInfo/academicInfo/applicantEmail
//     into IndexedDB (not just React state) on every change, so a closed
//     tab, closed browser, or a save that failed because Supabase was
//     unreachable never loses what the applicant typed. This is *on top
//     of* the existing Supabase draft-saving, not a replacement for it —
//     Supabase stays the source of truth once a save succeeds; this is
//     the safety net for when it can't.
//
//  2. UPLOAD QUEUE — if a document upload fails because of a network
//     problem (not a quality-precheck rejection, not a server error —
//     specifically "couldn't reach the server at all"), the file itself
//     is held in IndexedDB and retried automatically once the browser
//     reports it's back online, instead of the applicant having to
//     notice the failure and redo it.
//
// IndexedDB (not localStorage) is used because localStorage is
// string-only and capped around ~5MB — it can't hold File/Blob objects,
// which the upload queue needs. IndexedDB can store Blobs directly and
// has a much higher practical limit.
//
// Every function here is safe to call during SSR/build (no `window`) —
// they just no-op or resolve to null, since this module is only ever
// meaningfully used client-side after mount.

const DB_NAME = 'iskolusyon-offline'
const DB_VERSION = 1
const DRAFTS_STORE = 'drafts'
const QUEUE_STORE = 'uploadQueue'

function hasIndexedDB() {
  return typeof window !== 'undefined' && !!window.indexedDB
}

// Normalizes an applicant name into the same key shape used for the
// Supabase `ilike` lookups elsewhere in the app — trimmed, lowercased —
// so a local draft and a DB draft for "Juan Dela Cruz" / "juan dela cruz"
// are treated as the same applicant.
function keyFor(name) {
  return (name || '').trim().toLowerCase()
}

let dbPromise = null
function openDB() {
  if (!hasIndexedDB()) return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'name' })
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function withStore(storeName, mode, fn) {
  return openDB().then((db) => {
    if (!db) return null
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
      const result = fn(store)
      tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result)
      tx.onerror = () => reject(tx.error)
    })
  })
}

// ---------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------

// Saves the applicant's current in-progress form state locally. Call this
// on every meaningful change (debounced), not just on submit — the whole
// point is that it's already saved before anything goes wrong.
export async function saveDraftLocal(name, { personalInfo, academicInfo, applicantEmail, step }) {
  const key = keyFor(name)
  if (!key) return
  try {
    await withStore(DRAFTS_STORE, 'readwrite', (store) =>
      store.put({
        name: key,
        personalInfo,
        academicInfo,
        applicantEmail,
        step,
        savedAt: new Date().toISOString(),
      })
    )
  } catch (err) {
    // Local persistence failing (e.g. private browsing mode with IndexedDB
    // disabled) should never break the app — it's a best-effort safety net.
    console.error('Local draft save failed (non-blocking):', err)
  }
}

// Returns the locally-saved draft for this applicant, or null if none
// exists. Doesn't compare timestamps against the Supabase draft — callers
// decide which one to prefer (see the integration notes for the
// recommended "offer local if the DB check failed or came back empty"
// logic).
export async function loadDraftLocal(name) {
  const key = keyFor(name)
  if (!key) return null
  try {
    const result = await withStore(DRAFTS_STORE, 'readonly', (store) => {
      const req = store.get(key)
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => reject(req.error)
      })
    })
    return result
  } catch (err) {
    console.error('Local draft load failed (non-blocking):', err)
    return null
  }
}

// Clears the local draft — call this once a save to Supabase actually
// succeeds, so a stale local copy doesn't linger and confuse a future
// "resume from local" check.
export async function clearDraftLocal(name) {
  const key = keyFor(name)
  if (!key) return
  try {
    await withStore(DRAFTS_STORE, 'readwrite', (store) => store.delete(key))
  } catch (err) {
    console.error('Local draft clear failed (non-blocking):', err)
  }
}

// ---------------------------------------------------------------------
// Upload queue
// ---------------------------------------------------------------------

// Queues a document upload that couldn't reach the server, to retry once
// connectivity returns. `file` must be an actual File/Blob — IndexedDB
// stores it as-is, no base64 conversion needed.
export async function queueUpload({ docType, file, applicantName, applicantEmail }) {
  try {
    const id = await withStore(QUEUE_STORE, 'readwrite', (store) => {
      const req = store.add({
        docType,
        file,
        fileName: file?.name || 'document',
        applicantName,
        applicantEmail,
        queuedAt: new Date().toISOString(),
      })
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    })
    return id
  } catch (err) {
    console.error('Queueing upload failed (non-blocking):', err)
    return null
  }
}

// Returns every queued upload, optionally filtered to one applicant name
// (case-insensitive, same matching convention as the rest of the app).
export async function getQueuedUploads(applicantName) {
  try {
    const all = await withStore(QUEUE_STORE, 'readonly', (store) => {
      const req = store.getAll()
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => reject(req.error)
      })
    })
    if (!applicantName) return all || []
    const key = keyFor(applicantName)
    return (all || []).filter((entry) => keyFor(entry.applicantName) === key)
  } catch (err) {
    console.error('Reading upload queue failed (non-blocking):', err)
    return []
  }
}

export async function removeQueuedUpload(id) {
  try {
    await withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(id))
  } catch (err) {
    console.error('Removing queued upload failed (non-blocking):', err)
  }
}

// ---------------------------------------------------------------------
// Connectivity helpers
// ---------------------------------------------------------------------

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

// Subscribes to browser online/offline events. Returns an unsubscribe
// function — call it in a useEffect cleanup. `callback` receives a single
// boolean (true = back online, false = went offline).
export function onConnectivityChange(callback) {
  if (typeof window === 'undefined') return () => {}
  const onOnline = () => callback(true)
  const onOffline = () => callback(false)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

// Heuristic for "this failed because we couldn't reach the server at
// all" (worth queueing/retrying) vs. "the server responded with a real
// error" (a 4xx/5xx, a quality-precheck rejection, etc. — not worth
// retrying blindly). fetch() throws a TypeError with this kind of
// message specifically when the request never got a response at all.
export function isNetworkError(err) {
  if (!isOnline()) return true
  return err instanceof TypeError && /fetch|network/i.test(err.message || '')
}
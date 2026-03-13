import { useEffect, useRef } from 'react'


const PARAM = 'modal'
const SEP = ','

/**
 * Write the ?modal= param directly via the History API so that react-router's
 * useSearchParams subscribers (DataTable, FishPage, etc.) are NOT notified.
 * This prevents the entire page from re-rendering when the modal opens/closes.
 *
 * @param {'replace'|'push'} mode
 */
function writeModalParam(trail, mode = 'replace') {
  const url = new URL(window.location.href)
  // For HashRouter, search params live inside the hash: #/path?param=value
  const hashParts = url.hash.split('?')
  const hashPath = hashParts[0] || '#/'
  const params = new URLSearchParams(hashParts[1] || '')

  if (trail) {
    params.set(PARAM, trail)
  } else {
    params.delete(PARAM)
  }

  const paramStr = params.toString()
  const newHash = paramStr ? `${hashPath}?${paramStr}` : hashPath
  const newUrl = `${url.origin}${url.pathname}${newHash}`

  if (mode === 'push') {
    window.history.pushState(null, '', newUrl)
  } else {
    window.history.replaceState(null, '', newUrl)
  }
}

/**
 * Read the current ?modal= param from the hash portion of the URL.
 */
function readModalParam() {
  const hash = window.location.hash
  const qIdx = hash.indexOf('?')
  if (qIdx === -1) return ''
  const params = new URLSearchParams(hash.slice(qIdx + 1))
  return params.get(PARAM) || ''
}

/**
 * Syncs a modal's breadcrumb history to/from the URL search param `?modal=id1,id2,id3`.
 * Enabled automatically when onOpen is provided.
 *
 * Uses the History API directly (not react-router's setSearchParams) to avoid
 * triggering re-renders in every component that uses useSearchParams.
 *
 * @param {boolean}  enabled       - Whether URL sync is active
 * @param {Object[]} history       - Current breadcrumb history array
 * @param {Function} setHistory    - Setter for history
 * @param {Function} onOpen        - Called with the root entity when URL param is present on load
 * @param {Function} findEntity    - Resolves an entity by ID
 * @param {boolean}  isOpen        - Whether the modal is currently open
 * @param {Function} onClose       - Called when the modal should close
 */
export function useModalUrl({ enabled, history, setHistory, onOpen, findEntity, entitiesLoading, isOpen, onClose }) {
  // Authoritative ref for what trail we last intentionally wrote to the URL.
  // Used to suppress the popstate handler from firing on our own writes.
  const canonicalTrail = useRef(null)
  const wasOpen = useRef(false)

  // ── On mount (after entities load): restore modal from URL if param is present ──
  const didRestore = useRef(false)
  useEffect(() => {
    if (!enabled || entitiesLoading || didRestore.current) return
    const raw = readModalParam()
    if (!raw) return
    const ids = raw.split(SEP).filter(Boolean)
    if (ids.length === 0) return
    const entities = ids.map(id => findEntity(id))
    if (entities.some(e => !e)) return
    didRestore.current = true
    canonicalTrail.current = raw
    setHistory(entities)
    onOpen(entities[0])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, entitiesLoading])

  // ── History → URL ─────────────────────────────────────────────────────────
  // When local history changes, write it to the URL and update canonicalTrail.
  useEffect(() => {
    if (!enabled) return
    if (!isOpen) return
    if (history.length === 0) return

    const trail = history.map(e => e.id).join(SEP)

    // Already canonical — nothing to do
    if (trail === canonicalTrail.current) return

    const isDeeper = canonicalTrail.current !== null &&
      history.length > canonicalTrail.current.split(SEP).length

    canonicalTrail.current = trail
    writeModalParam(trail, isDeeper ? 'push' : 'replace')
  }, [enabled, history, isOpen])

  // ── Close → URL: clear param when modal closes ────────────────────────────
  useEffect(() => {
    if (!enabled) return
    if (isOpen) { wasOpen.current = true; return }
    if (!wasOpen.current) return
    wasOpen.current = false
    canonicalTrail.current = null

    // Only write if there's actually a modal param to clear
    if (readModalParam()) {
      writeModalParam(null, 'replace')
    }
  }, [enabled, isOpen])

  // ── Browser back/forward: sync URL → history ──────────────────────────────
  // Listen for popstate events (browser back/forward buttons) to sync URL changes
  // back into the modal's history state.
  const onCloseRef = useRef(onClose)
  const onOpenRef = useRef(onOpen)
  const findEntityRef = useRef(findEntity)
  const setHistoryRef = useRef(setHistory)
  const isOpenRef = useRef(isOpen)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { onOpenRef.current = onOpen }, [onOpen])
  useEffect(() => { findEntityRef.current = findEntity }, [findEntity])
  useEffect(() => { setHistoryRef.current = setHistory }, [setHistory])
  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])

  useEffect(() => {
    if (!enabled) return

    const handlePopState = () => {
      const trail = readModalParam()

      // This is a URL state we ourselves wrote — ignore
      if (trail === canonicalTrail.current) return

      canonicalTrail.current = trail

      if (!trail) {
        if (isOpenRef.current) onCloseRef.current()
        return
      }

      const ids = trail.split(SEP).filter(Boolean)
      const entities = ids.map(id => findEntityRef.current(id))
      if (entities.some(e => !e)) return

      setHistoryRef.current(entities)
      if (!isOpenRef.current) onOpenRef.current(entities[0])
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [enabled])
}

import { useEffect, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'


const PARAM = 'modal'
const SEP = ','

/**
 * Syncs a modal's breadcrumb history to/from the URL search param `?modal=id1,id2,id3`.
 * Enabled automatically when onOpen is provided.
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
  const [, setSearchParams] = useSearchParams()
  const location = useLocation()
  const isSyncing = useRef(false)
  const prevHistoryLen = useRef(0)
  const wasOpen = useRef(false)

  // ── On mount (after entities load): restore modal from URL if param is present ──
  const didRestore = useRef(false)
  useEffect(() => {
    if (!enabled || entitiesLoading || didRestore.current) return
    const params = new URLSearchParams(location.search)
    const raw = params.get(PARAM)
    if (!raw) return
    const ids = raw.split(SEP).filter(Boolean)
    if (ids.length === 0) return
    const entities = ids.map(id => findEntity(id))
    if (entities.some(e => !e)) return
    didRestore.current = true
    isSyncing.current = true
    prevHistoryLen.current = ids.length
    setHistory(entities)
    onOpen(entities[0])
    setTimeout(() => { isSyncing.current = false }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, entitiesLoading])

  // ── History → URL ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    if (isSyncing.current) return
    if (!isOpen) return
    if (history.length === 0) return

    const trail = history.map(e => e.id).join(SEP)
    const isDeeper = history.length > prevHistoryLen.current
    prevHistoryLen.current = history.length

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set(PARAM, trail)
      return next
    }, { replace: !isDeeper })
  }, [enabled, history, isOpen, setSearchParams])

  // ── Close → URL: clear param when modal closes ────────────────────────────
  useEffect(() => {
    if (!enabled) return
    if (isOpen) { wasOpen.current = true; return }
    if (!wasOpen.current) return
    wasOpen.current = false
    prevHistoryLen.current = 0
    setSearchParams(prev => {
      if (!prev.has(PARAM)) return prev
      const next = new URLSearchParams(prev)
      next.delete(PARAM)
      return next
    }, { replace: true })
  }, [enabled, isOpen, setSearchParams])

  // ── Location change: sync URL → history (handles browser back/forward) ────
  const prevTrail = useRef(null)
  useEffect(() => {
    if (!enabled) return
    const params = new URLSearchParams(location.search)
    const raw = params.get(PARAM)
    const trail = raw || ''

    if (isSyncing.current) return
    if (trail === prevTrail.current) return
    prevTrail.current = trail

    if (!trail) {
      if (isOpen) {
        isSyncing.current = true
        prevHistoryLen.current = 0
        onClose()
        setTimeout(() => { isSyncing.current = false }, 0)
      }
      return
    }

    const ids = trail.split(SEP).filter(Boolean)
    const entities = ids.map(id => findEntity(id))
    if (entities.some(e => !e)) return

    const currentTrail = history.map(e => e.id).join(SEP)
    if (trail === currentTrail) return

    isSyncing.current = true
    prevHistoryLen.current = ids.length
    setHistory(entities)
    if (!isOpen) onOpen(entities[0])
    setTimeout(() => { isSyncing.current = false }, 0)
  }, [enabled, location.search]) // eslint-disable-line react-hooks/exhaustive-deps
}

import { createContext, useContext, useState, useCallback, useMemo } from 'react'

// Separate contexts so that opening/closing the modal (activeEntity change) does not
// re-render every ModalItemButton on the page (they only need openModal, which is stable).
const ModalActionsContext = createContext()  // stable: openModal, closeModal
const ModalStateContext = createContext()    // changes on open/close: activeEntity
const ModalStackContext = createContext()    // changes on push/pop: stack state

export function ModalProvider({ children }) {
  const [modalStack, setModalStack] = useState([])
  const [activeEntity, setActiveEntity] = useState(null)

  // ── Z-index stack (for nested modal layering) ─────────────────────────────
  const pushModal = useCallback((id) => {
    setModalStack(prev => [...prev, id])
  }, [])

  const popModal = useCallback((id) => {
    setModalStack(prev => prev.filter(modalId => modalId !== id))
  }, [])

  const getModalIndex = useCallback((id) => {
    return modalStack.indexOf(id)
  }, [modalStack])

  const isTopModal = useCallback((id) => {
    return modalStack[modalStack.length - 1] === id
  }, [modalStack])

  // ── Global entity modal ───────────────────────────────────────────────────
  const openModal = useCallback((entity) => {
    setActiveEntity(entity)
  }, [])

  const closeModal = useCallback(() => {
    setActiveEntity(null)
  }, [])

  // Stable actions — never changes after mount, so ModalItemButton never re-renders
  const actionsValue = useMemo(() => ({ openModal, closeModal }), [openModal, closeModal])

  // State — changes on open/close, consumed only by UniversalModal host + App
  const stateValue = useMemo(() => ({ activeEntity }), [activeEntity])

  // Stack — changes on push/pop, consumed only by GlobalSearch + Modal
  const stackValue = useMemo(() => ({
    pushModal, popModal, getModalIndex, isTopModal, modalCount: modalStack.length,
  }), [pushModal, popModal, getModalIndex, isTopModal, modalStack])

  return (
    <ModalActionsContext.Provider value={actionsValue}>
      <ModalStateContext.Provider value={stateValue}>
        <ModalStackContext.Provider value={stackValue}>
          {children}
        </ModalStackContext.Provider>
      </ModalStateContext.Provider>
    </ModalActionsContext.Provider>
  )
}

export function useModalStack() {
  const context = useContext(ModalStackContext)
  if (!context) throw new Error('useModalStack must be used within a ModalProvider')
  return context
}

/** Returns { activeEntity, openModal, closeModal } — the full modal API. */
export function useModal() {
  const actions = useContext(ModalActionsContext)
  const state = useContext(ModalStateContext)
  if (!actions || !state) throw new Error('useModal must be used within a ModalProvider')
  return { ...actions, ...state }
}

/** Returns only { openModal } — stable, never triggers re-renders on modal open/close. */
export function useOpenModal() {
  const context = useContext(ModalActionsContext)
  if (!context) throw new Error('useOpenModal must be used within a ModalProvider')
  return context.openModal
}

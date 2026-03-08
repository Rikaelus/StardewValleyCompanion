import { createContext, useContext, useState, useCallback } from 'react'

const ModalContext = createContext()

export function ModalProvider({ children }) {
  const [modalStack, setModalStack] = useState([])

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
  const [activeEntity, setActiveEntity] = useState(null)

  const openModal = useCallback((entity) => {
    setActiveEntity(entity)
  }, [])

  const closeModal = useCallback(() => {
    setActiveEntity(null)
  }, [])

  return (
    <ModalContext.Provider value={{
      pushModal, popModal, getModalIndex, isTopModal, modalCount: modalStack.length,
      activeEntity, openModal, closeModal,
    }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModalStack() {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModalStack must be used within a ModalProvider')
  return context
}

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModal must be used within a ModalProvider')
  return context
}

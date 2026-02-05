import { useEffect, useId, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalStack } from '../../contexts/ModalContext'
import './Modal.css'

function Modal({ isOpen, onClose, title, children }) {
  const modalId = useId()
  const { pushModal, popModal, getModalIndex, isTopModal } = useModalStack()
  const [isClosing, setIsClosing] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // Handle opening/closing with animation
  useEffect(() => {
    if (isOpen) {
      // Opening
      setShouldRender(true)
      setIsClosing(false)
    } else if (shouldRender) {
      // Closing - start animation
      setIsClosing(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
      }, 300) // Match fadeOut animation duration
      return () => clearTimeout(timer)
    }
  }, [isOpen, shouldRender])

  // Manage modal stack
  useEffect(() => {
    if (isOpen) {
      pushModal(modalId)
      return () => {
        popModal(modalId)
      }
    }
  }, [isOpen, modalId, pushModal, popModal])

  // Close on Escape key (only if this is the top modal)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && isTopModal(modalId)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, modalId, isTopModal])

  // Handle body scroll - only lock when modals are open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      // Only unlock scroll if no modals are open
      const hasModals = document.querySelectorAll('.modal-overlay').length > 1
      if (!hasModals) {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  if (!shouldRender) return null

  const stackIndex = getModalIndex(modalId)
  const zIndex = 1000 + stackIndex * 10
  const isTop = isTopModal(modalId)

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && isTop) {
      onClose()
    }
  }

  return createPortal(
    <div
      className={`modal-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleOverlayClick}
      style={{ zIndex }}
    >
      <div
        className={`modal-content ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          '--stack-scale': 1 - stackIndex * 0.02,
          transform: `scale(${1 - stackIndex * 0.02})`,
          top: `${stackIndex * 20}px`,
        }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal

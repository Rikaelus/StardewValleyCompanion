import { useEffect, useId, useLayoutEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useModalStack } from '../../contexts/ModalContext'
import './Modal.css'

function Modal({ isOpen, onClose, title, breadcrumb, sections, children }) {
  const modalId = useId()
  const { pushModal, popModal, getModalIndex, isTopModal } = useModalStack()
  const [isClosing, setIsClosing] = useState(false)
  const [shouldRender, setShouldRender] = useState(isOpen)
  const bodyRef = useRef(null)

  const scrollToSection = useCallback((sectionId) => {
    const body = bodyRef.current
    if (!body) return
    const target = body.querySelector(`#${sectionId}`)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Open: push to stack and show in a single layout pass so the first painted
  // frame already has the correct stackIndex (no animation-restarting re-render).
  useLayoutEffect(() => {
    if (isOpen) {
      pushModal(modalId)
      setShouldRender(true)
      setIsClosing(false)
      return () => {
        popModal(modalId)
      }
    }
  }, [isOpen, modalId, pushModal, popModal])

  // Close: trigger closing animation then unmount
  useEffect(() => {
    if (!isOpen && shouldRender) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, shouldRender])

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

  const rawStackIndex = getModalIndex(modalId)
  const stackIndex = Math.max(rawStackIndex, 0)
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
          '--stack-top': `${stackIndex * 20}px`,
        }}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          {breadcrumb && breadcrumb}
          {sections && sections.length > 0 && (
            <nav className="modal-section-nav">
              {sections.map(({ id, label }) => (
                <button
                  key={id}
                  className="modal-section-nav-link"
                  onClick={() => scrollToSection(id)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="modal-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal

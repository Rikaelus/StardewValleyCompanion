import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './InfoTooltip.css'

/**
 * Small "?" icon with click-to-show tooltip
 * Uses a React portal so the popup isn't clipped by parent overflow
 *
 * Usage:
 *   <InfoTooltip text="This is helpful information" />
 */
function InfoTooltip({ text, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)
  const popupRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popupEl = popupRef.current
    const popupWidth = popupEl ? popupEl.offsetWidth : 200

    let left = rect.left + rect.width / 2 - popupWidth / 2
    // Keep within viewport
    if (left < 8) left = 8
    if (left + popupWidth > window.innerWidth - 8) left = window.innerWidth - 8 - popupWidth

    setPosition({
      top: rect.top + window.scrollY - 8,
      left: left + window.scrollX
    })
  }, [])

  // Position the popup when it opens
  useLayoutEffect(() => {
    if (isOpen) updatePosition()
  }, [isOpen, updatePosition])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (triggerRef.current && triggerRef.current.contains(event.target)) return
      if (popupRef.current && popupRef.current.contains(event.target)) return
      setIsOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <span className="info-tooltip-wrapper" ref={triggerRef}>
      <span
        className={`info-tooltip ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
      >
        ?
      </span>
      {isOpen && createPortal(
        <span
          ref={popupRef}
          className="info-tooltip-popup"
          style={{ top: position.top, left: position.left }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  )
}

export default InfoTooltip

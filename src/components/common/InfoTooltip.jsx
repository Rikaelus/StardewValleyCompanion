import { useState, useRef, useEffect } from 'react'
import './InfoTooltip.css'

/**
 * Small "?" icon with click-to-show tooltip
 *
 * Usage:
 *   <InfoTooltip id="unique-id" text="This is helpful information" />
 */
function InfoTooltip({ text, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <span className="info-tooltip-wrapper" ref={tooltipRef}>
      <span
        className={`info-tooltip ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
      >
        ?
      </span>
      {isOpen && (
        <span className="info-tooltip-popup">
          {text}
        </span>
      )}
    </span>
  )
}

export default InfoTooltip

import { useState, useEffect } from 'react'
import './ModalHeader.css'

/**
 * Reusable modal header component with icon and title
 * Automatically handles icon fallback if image fails to load
 *
 * Usage:
 *   <ModalHeader icon={item.icon} name={item.name} subtitle="Category Name" />
 */
function ModalHeader({ icon, iconChar, iconClass, iconColor, name, subtitle, children, className = '' }) {
  const [iconError, setIconError] = useState(false)

  useEffect(() => {
    setIconError(false)
  }, [icon])

  return (
    <div className={`modal-item-header ${className}`}>
      {(iconChar || iconClass) ? (
        <div className="modal-item-header-icon-char" style={{ backgroundColor: iconColor || '#7f8c8d' }}>
          {iconClass ? <i className={iconClass} /> : iconChar}
        </div>
      ) : !icon || iconError ? (
        <div className="modal-item-header-icon-fallback" title={`${name} (icon not found)`}>
          {(() => {
          const words = name.split(/\s+/)
          return words.length > 1
            ? (words[0][0] + words[1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase()
        })()}
        </div>
      ) : (
        <img
          src={icon}
          alt={name}
          className="modal-item-header-icon"
          onError={() => setIconError(true)}
        />
      )}
      <div className="modal-item-header-title-section">
        <div className="modal-item-header-title-row">
          <h3>{name}</h3>
          {subtitle && <span className="modal-item-header-subtitle">{subtitle}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

export default ModalHeader

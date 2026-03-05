import { useState, useEffect } from 'react'
import './ModalHeader.css'

/**
 * Reusable modal header component with icon and title
 * Automatically handles icon fallback if image fails to load
 *
 * Usage:
 *   <ModalHeader icon={item.icon} name={item.name} subtitle="Category Name" />
 */
function ModalHeader({ icon, name, subtitle, children, className = '' }) {
  const [iconError, setIconError] = useState(false)
  const [iconLoaded, setIconLoaded] = useState(false)

  useEffect(() => {
    setIconError(false)
    setIconLoaded(false)
  }, [icon])

  return (
    <div className={`modal-item-header ${className}`}>
      {iconError ? (
        <div className="modal-item-header-icon-fallback" title={`${name} (icon not found)`}>
          {name.slice(0, 2).toUpperCase()}
        </div>
      ) : (
        <img
          src={icon}
          alt={name}
          className="modal-item-header-icon"
          style={iconLoaded ? undefined : { visibility: 'hidden' }}
          onLoad={() => setIconLoaded(true)}
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

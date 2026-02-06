import './ModalHeader.css'

/**
 * Reusable modal header component with icon and title
 * Automatically handles icon fallback if image fails to load
 *
 * Usage:
 *   <ModalHeader icon={item.icon} name={item.name} subtitle="Category Name" />
 */
function ModalHeader({ icon, name, subtitle, children, className = '' }) {
  const handleImageError = (e) => {
    // Prevent duplicate fallbacks
    if (e.target.dataset.errorHandled) return
    e.target.dataset.errorHandled = 'true'

    // Fallback to text if image fails to load
    e.target.style.display = 'none'
    const fallback = document.createElement('div')
    fallback.className = 'modal-item-header-icon-fallback'
    fallback.textContent = name.slice(0, 2).toUpperCase()
    fallback.title = `${name} (icon not found)`
    e.target.parentNode.insertBefore(fallback, e.target)
  }

  return (
    <div className={`modal-item-header ${className}`}>
      <img
        src={icon}
        alt={name}
        className="modal-item-header-icon"
        onError={handleImageError}
      />
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

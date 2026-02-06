import './ModalNote.css'

/**
 * Reusable note/callout component for modals
 *
 * Usage:
 *   <ModalNote>This is a general note</ModalNote>
 *   <ModalNote type="warning">This is a warning</ModalNote>
 *   <ModalNote type="info">This is informational</ModalNote>
 */
function ModalNote({ children, type = 'default', className = '' }) {
  return (
    <div className={`modal-note modal-note-${type} ${className}`}>
      {children}
    </div>
  )
}

export default ModalNote

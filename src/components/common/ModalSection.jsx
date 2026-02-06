import './ModalSection.css'

/**
 * Reusable modal section component with title and content
 *
 * Usage:
 *   <ModalSection title="Fishing Info">
 *     <div>Content here</div>
 *   </ModalSection>
 *
 *   <ModalSection title="Location & Time" className="custom-class">
 *     <ModalGrid>...</ModalGrid>
 *   </ModalSection>
 */
function ModalSection({ title, children, className = '' }) {
  return (
    <div className={`modal-section ${className}`}>
      {title && <h4>{title}</h4>}
      {children}
    </div>
  )
}

export default ModalSection

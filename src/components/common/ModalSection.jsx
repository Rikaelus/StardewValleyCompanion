import { useRegisterSection } from '../../contexts/SectionNavContext'
import './ModalSection.css'

/**
 * Reusable modal section component with title and content.
 *
 * If `navLabel` is provided (along with `id`), the section registers itself
 * in the modal's section nav so users can jump to it. Sections without
 * navLabel render normally but don't appear in the nav.
 */
function ModalSection({ title, id, navLabel, children, className = '' }) {
  useRegisterSection(id, navLabel)

  return (
    <div id={id} className={`modal-section ${className}`}>
      {title && <h4>{title}</h4>}
      {children}
    </div>
  )
}

export default ModalSection

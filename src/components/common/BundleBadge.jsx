import { useState } from 'react'
import UniversalModal from './UniversalModal'
import './BundleBadge.css'

/**
 * Badge for displaying a bundle with an optional magnifying glass button
 * to open a modal
 *
 * @param {Object} bundle - Bundle object with id, name, etc.
 * @param {boolean} showModal - Whether to show the magnifying glass and enable modal
 * @param {function} onNavigate - Navigation callback from parent modal (breadcrumb navigation)
 */
function BundleBadge({ bundle, showModal = false, onNavigate = null }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!bundle) return null

  const handleClick = (e) => {
    if (!showModal) return

    e.stopPropagation()

    // If parent provides navigation callback, use it instead of opening own modal
    if (onNavigate) {
      onNavigate(bundle)
      return
    }

    setIsModalOpen(true)
  }

  // Whether to render own modal (only when not using parent navigation)
  const shouldRenderModal = showModal && !onNavigate

  return (
    <>
      <div
        className={`bundle-badge ${showModal ? 'bundle-badge-clickable' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {showModal && (
          <span className="bundle-badge-icon" style={{ opacity: isHovered ? 1 : 0.4 }}>
            🔍
          </span>
        )}
        <span className="bundle-badge-name">{bundle.name}</span>
      </div>

      {shouldRenderModal && (
        <UniversalModal
          entity={bundle}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  )
}

export default BundleBadge

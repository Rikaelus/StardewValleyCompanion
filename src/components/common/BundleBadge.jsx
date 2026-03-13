import { useState } from 'react'
import { useOpenModal } from '../../contexts/ModalContext'
import './BundleBadge.css'

function BundleBadge({ bundle, showModal = false, onNavigate = null }) {
  const openModal = useOpenModal()
  const [isHovered, setIsHovered] = useState(false)

  if (!bundle) return null

  const handleClick = (e) => {
    if (!showModal) return
    e.stopPropagation()
    if (onNavigate) {
      onNavigate(bundle)
    } else {
      openModal(bundle)
    }
  }

  return (
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
  )
}

export default BundleBadge

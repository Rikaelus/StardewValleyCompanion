import UniversalModalButton from './UniversalModalButton'
import './BundleBadge.css'

function BundleBadge({ bundle, showModal = false, onNavigate = null }) {
  if (!bundle) return null

  if (!showModal) {
    return (
      <span className="bundle-badge">
        <span className="bundle-badge-name">{bundle.name}</span>
      </span>
    )
  }

  return (
    <span className="bundle-badge bundle-badge-clickable">
      <UniversalModalButton
        item={bundle}
        variant="inline"
        stopPropagation
        onNavigate={onNavigate}
        label={bundle.name}
      />
    </span>
  )
}

export default BundleBadge

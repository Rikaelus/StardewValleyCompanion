import BundleBadge from './BundleBadge'
import './BundleList.css'

/**
 * List of bundle badges
 *
 * @param {Array} bundles - Array of bundle objects
 * @param {boolean} showModal - Whether to show magnifying glass and enable modals
 * @param {number} modalDepth - Track modal nesting depth
 */
function BundleList({ bundles, showModal = false, modalDepth = 0 }) {
  if (!bundles || bundles.length === 0) {
    return <span className="bundle-list-empty">None</span>
  }

  return (
    <div className="bundle-list">
      {bundles.map((bundle) => (
        <BundleBadge
          key={bundle.id}
          bundle={bundle}
          showModal={showModal}
          modalDepth={modalDepth}
        />
      ))}
    </div>
  )
}

export default BundleList

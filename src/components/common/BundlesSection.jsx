import ModalSection from './ModalSection'
import BundleBadge from './BundleBadge'

function BundlesSection({ entity, getBundle, onNavigate }) {
  if (!entity?.bundles || entity.bundles.length === 0) return null

  const bundleDetails = entity.bundles
    .map(bundleId => {
      const bundle = getBundle(bundleId)
      if (!bundle) {
        console.warn(`Bundle not found: ${bundleId}`)
      }
      return bundle
    })
    .filter(Boolean)

  if (bundleDetails.length === 0) return null

  return (
    <ModalSection id="section-bundles" title="Bundles" navLabel="Bundles">
      <div className="bundle-badges-list">
        {bundleDetails.map(bundle => (
          <BundleBadge
            key={bundle.id}
            bundle={bundle}
            showModal={true}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </ModalSection>
  )
}

export default BundlesSection

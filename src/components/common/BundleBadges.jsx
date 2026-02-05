import './BundleBadges.css'

function BundleBadges({ bundleIds, bundlesData }) {
  if (!bundleIds || bundleIds.length === 0) {
    return <span className="no-bundles">-</span>
  }

  const bundles = bundleIds
    .map(id => bundlesData?.find(b => b.id === id))
    .filter(Boolean)

  return (
    <div className="bundle-badges">
      {bundles.map(bundle => (
        <span key={bundle.id} className="bundle-badge" title={bundle.name}>
          {bundle.name.replace(' Bundle', '')}
        </span>
      ))}
    </div>
  )
}

export default BundleBadges

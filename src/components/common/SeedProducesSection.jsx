import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'
import SeasonBadges from './SeasonBadges'
import ItemSellPrice from './ItemSellPrice'

function SeedProducesSection({ entity, cropItems, forageItems, onNavigate }) {
  if (!entity || entity.type !== 'seed') return null
  const produces = entity.produces
  if (!produces || produces.length === 0) return null

  return (
    <ModalSection id="section-produces" title="Produces">
      <div className="produces-table">
        {produces.map((p, idx) => {
          const crop = cropItems.find(c => c.id === p.cropId)
            ?? forageItems.find(f => f.id === p.cropId)
          const cropSeasons = crop?.seasons || []
          return (
            <div key={p.cropId} className="processing-row processing-row--output processing-row--with-price">
              <span className="processing-arrow">{idx === produces.length - 1 ? '└→' : '├→'}</span>
              <div className="processing-row__name">
                {crop
                  ? <ModalItemButton item={crop} variant="inline" onNavigate={onNavigate} />
                  : <strong>{p.cropName}</strong>
                }
              </div>
              <div className="processing-row__seasons">
                {cropSeasons.length > 0 && <SeasonBadges seasons={cropSeasons} />}
              </div>
              <div className="processing-row__growth">
                {p.growthDays && `${p.growthDays}d${p.regrowDays ? ` (+${p.regrowDays}d)` : ''}`}
              </div>
              {crop
                ? <ItemSellPrice item={crop} showQualities={crop.maxQuality !== 0} />
                : <span />
              }
            </div>
          )
        })}
      </div>
    </ModalSection>
  )
}

export default SeedProducesSection

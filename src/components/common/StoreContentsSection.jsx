import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'
import ConditionBadge from './ConditionBadge'
import SeasonBadges from './SeasonBadges'

const CATEGORY_ORDER = ['furniture', 'clothing', 'fish', 'crop', 'seed', 'artisan', 'animal-product', 'forage', 'tree-fruit', 'mineral', 'metal-bar', 'ore', 'resource', 'big-craftable', 'monster-loot', 'ring', 'weapon', 'boot', 'food', 'bait', 'tackle', 'fertilizer', 'flooring', 'crafted', 'book', 'artifact', 'tree-seed', 'tool', 'trinket', 'trash', 'misc', 'other']

const CATEGORY_LABELS = {
  furniture: 'Furniture', clothing: 'Clothing', fish: 'Fish', crop: 'Crops', seed: 'Seeds',
  artisan: 'Artisan Goods', 'animal-product': 'Animal Products', forage: 'Forage',
  'tree-fruit': 'Tree Fruits', mineral: 'Minerals',
  'metal-bar': 'Metal Bars', ore: 'Ores', resource: 'Resources',
  'big-craftable': 'Big Craftables', 'monster-loot': 'Monster Loot',
  ring: 'Rings', weapon: 'Weapons', boot: 'Boots', food: 'Food',
  bait: 'Bait', tackle: 'Tackle',
  fertilizer: 'Fertilizers', flooring: 'Flooring', crafted: 'Crafted Items',
  book: 'Books', artifact: 'Artifacts', 'tree-seed': 'Tree Seeds',
  tool: 'Tools', trinket: 'Trinkets',
  trash: 'Trash', misc: 'Miscellaneous',
}

function StoreContentsSection({ entity, entityType, allItems, findById, onNavigate }) {
  const storeId = entity.id
  const childStalls = allItems
    .filter(s => s.type === 'location' && s.locations?.some(l => l.id === storeId))
    .sort((a, b) => a.name.localeCompare(b.name))

  const storeItems = allItems.filter(item =>
    item.sources?.some(s => s.type === 'shop' && s.id === storeId)
  ).sort((a, b) => a.name.localeCompare(b.name))

  if (storeItems.length === 0 && childStalls.length === 0) return null

  // Total row count (may exceed storeItems.length when items have multiple sources for this store)
  const totalRows = storeItems.reduce((n, item) =>
    n + (item.sources?.filter(s => s.type === 'shop' && s.id === storeId).length ?? 0), 0
  )

  const grouped = {}
  for (const item of storeItems) {
    const cat = item.type || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a); const bi = CATEGORY_ORDER.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return (
    <ModalSection id="section-store-items" title={childStalls.length > 0 ? `Villager Stalls (${childStalls.length})` : `Available Items (${totalRows})`} navLabel={childStalls.length > 0 ? 'Stalls' : 'Items'}>
      {childStalls.length > 0 && (
        <div className="store-items-grid">
          {childStalls.map(stall => (
            <span key={stall.id} className="source-entry">
              <ModalItemButton item={stall} variant="inline" onNavigate={onNavigate} />
            </span>
          ))}
        </div>
      )}

      {sortedGroups.map(([cat, items]) => (
        <div key={cat} className="store-category-group">
          {sortedGroups.length > 1 && (
            <div className="modal-label" style={{ marginBottom: '0.25rem' }}>
              {CATEGORY_LABELS[cat] || cat}
            </div>
          )}
          <div className="store-items-grid">
            {items.flatMap(item => {
              const srcs = item.sources?.filter(s => s.type === 'shop' && s.id === storeId) ?? []
              return srcs.map((src, si) => {
                const isBarter = src.tradeItemId !== undefined || src.tradeItemGameId !== undefined
                const currencyItem = isBarter && findById ? findById(src.tradeItemId) : null
                const priceDetail = isBarter ? (
                  <>
                    {(src.quantity > 1 || src.tradeItemAmount > 1) && (
                      <span className="source-qualifier">
                        {src.quantity > 1 ? `${src.quantity} for ` : ''}{src.tradeItemAmount > 1 ? `×${src.tradeItemAmount}` : ''}
                      </span>
                    )}
                    {currencyItem ? (
                      <ModalItemButton item={currencyItem} variant="inline" onNavigate={onNavigate} plural={src.tradeItemAmount > 1} />
                    ) : (
                      <>
                        {src.tradeItemIcon && (
                          <img src={`/${src.tradeItemIcon}`} alt={src.tradeItemName} className="source-trade-icon" />
                        )}
                        {src.tradeItemName}
                      </>
                    )}
                  </>
                ) : (
                  src.price != null
                    ? (src.quantity > 1 ? `${src.quantity} for ${src.price.toLocaleString()}g` : `${src.price.toLocaleString()}g`)
                    : '—'
                )

                // Build qualifier chips (year, season, etc.) matching ShopSourceList logic
                const qualifiers = []
                if (src.days?.length > 0)
                  qualifiers.push(src.days.join('/'))
                if (src.dayParity)
                  qualifiers.push(src.dayParity === 'odd' ? 'Odd days' : 'Even days')
                if (src.yearCycle)
                  qualifiers.push(`Year ${src.yearCycle} cycle`)
                if (src.yearUnlock)
                  qualifiers.push(src.yearUnlockBefore ? `Before Year ${src.yearUnlock}` : `Year ${src.yearUnlock}+`)
                if (src.rotating)
                  qualifiers.push('Rotating')
                if (src.stock && src.stock !== -1)
                  qualifiers.push(`Stock: ${src.stock}`)

                return (
                  <ConditionBadge key={`${item.id}-${si}`} condition={src.condition} conditionItemNames={src.conditionItemNames}>
                    {(badge, clauseElements, open) => (
                      <>
                        <span className="source-entry">
                          <ModalItemButton item={item} variant="inline" onNavigate={onNavigate} />
                          <span className="source-qualifiers">
                            {qualifiers.map((q, qi) => <span key={qi} className="source-qualifier">{q}</span>)}
                            {badge}
                          </span>
                          <span className="source-seasons">
                            {src.seasons?.length > 0 && <SeasonBadges seasons={src.seasons} compact />}
                          </span>
                          <span className="source-detail">{priceDetail}</span>
                        </span>
                        {open && (
                          <span className="source-entry source-entry--expanded">
                            <span className="source-expanded-cell">{clauseElements}</span>
                          </span>
                        )}
                      </>
                    )}
                  </ConditionBadge>
                )
              })
            })}
          </div>
        </div>
      ))}
    </ModalSection>
  )
}

export default StoreContentsSection

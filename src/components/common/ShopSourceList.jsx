import ModalItemButton from './ModalItemButton'
import TagList from './TagList'
import { usePlayer } from '../../contexts/PlayerContext'

/**
 * Renders shop sources in two modes:
 *
 * compact — deduplicated by storeId, renders as TagList chips (for table cells)
 * full    — one row per source with qualifiers and price detail (for modals)
 *
 * Props:
 *   sources        {Array}    All item sources (filtered to type==='shop' internally)
 *   compact        {boolean}  Use compact tag list mode (default false)
 *   findEntity     {Function} (full mode) gameId → item object for currency lookups
 *   onNavigate     {Function} (full mode) modal navigation callback
 */
function ShopSourceList({ sources, compact = false, findEntity, findEntityById, onNavigate }) {
  const { player } = usePlayer()
  const shopSources = (sources || []).filter(s => s.type === 'shop')
  if (shopSources.length === 0) return <span style={{ color: '#999' }}>—</span>

  // ── Compact mode ────────────────────────────────────────────────────────────
  if (compact) {
    // Deduplicate by base name (strip parenthetical suffixes like "(Emily)" or "(Egg Shop)")
    const stripParens = name => name?.replace(/\s*\(.*?\)\s*$/, '').trim() ?? name
    const seen = new Map()
    for (const src of shopSources) {
      const name = src.storeBaseName ?? src.storeName ?? src.storeId
      const key = stripParens(name)
      if (!seen.has(key)) seen.set(key, { src, key })
    }
    const tags = [...seen.values()].map(({ src, key }) => {
      return src.seasons?.length
        ? `${key} (${src.seasons.map(s => s[0].toUpperCase() + s.slice(1)).join('/')})`
        : key
    })
    return <TagList items={tags} variant="location" />
  }

  // ── Full mode ────────────────────────────────────────────────────────────────
  return (
    <div className="source-list">
      {shopSources.map((src, i) => {
        const storeName = src.storeName ?? src.storeId
        const isBarter = src.tradeItemId !== undefined || src.tradeItemGameId !== undefined
        // Joja members pay base × 2 instead of base × 2.5, so member price = non-member × 0.8
        const price = src.price != null && src.storeId === 'joja' && player.jojaMember
          ? Math.floor(src.price * 0.8)
          : src.price
        const currencyItem = isBarter && findEntity
          ? (src.tradeItemId && findEntityById ? findEntityById(src.tradeItemId) : null) ?? findEntity(src.tradeItemGameId)
          : null
        const shopCurrencyItem = src.shopCurrencyGameId && findEntity ? findEntity(src.shopCurrencyGameId) : null

        // Condition qualifier chips
        const qualifiers = []
        if (src.seasons?.length > 0)
          qualifiers.push(src.seasons.map(s => s[0].toUpperCase() + s.slice(1)).join('/'))
        if (src.days?.length > 0)
          qualifiers.push(src.days.join('/'))
        if (src.yearUnlock)
          qualifiers.push(src.yearUnlockBefore ? `Before Yr ${src.yearUnlock}` : `Yr ${src.yearUnlock}+`)
        if (src.daysPlayed)
          qualifiers.push(`Day ${src.daysPlayed}+`)
        if (src.heartsRequired)
          qualifiers.push(`${src.heartsRequired.count}♥ ${src.heartsRequired.npc}`)
        if (src.skillRequired)
          qualifiers.push(`${src.skillRequired.skill[0].toUpperCase() + src.skillRequired.skill.slice(1)} ${src.skillRequired.level}+`)
        if (src.mineLevel)
          qualifiers.push(`Floor ${src.mineLevel}+`)
        if (src.rotating)
          qualifiers.push('Rotating')
        if (src.stock && src.stock !== -1)
          qualifiers.push(`Stock: ${src.stock}`)

        return (
          <span key={i} className="source-entry">
            <span className="source-name">{storeName}</span>
            {qualifiers.length > 0 ? (
              <span className="source-qualifiers">
                {qualifiers.map((q, qi) => <span key={qi} className="source-qualifier">{q}</span>)}
              </span>
            ) : <span />}
            <span className="source-detail">
              {isBarter ? (
                <>
                  {(src.quantity > 1 || src.tradeItemAmount > 1) && (
                    <span className="source-qualifier">
                      {src.quantity > 1 ? `${src.quantity} for ` : ''}{src.tradeItemAmount > 1 ? src.tradeItemAmount : ''}
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
              ) : shopCurrencyItem ? (
                <>
                  <span className="source-qualifier">
                    {src.quantity > 1 ? `${src.quantity} for ` : ''}{price > 1 ? price : ''}
                  </span>
                  <ModalItemButton item={shopCurrencyItem} variant="inline" onNavigate={onNavigate} plural={price > 1} />
                </>
              ) : (
                price != null ? `${price}g` : '—'
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export default ShopSourceList

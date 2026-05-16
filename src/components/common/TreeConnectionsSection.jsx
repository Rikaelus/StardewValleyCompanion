import ModalSection from './ModalSection'
import UniversalModalButton from './UniversalModalButton'
import SeasonBadges from './SeasonBadges'
import { formatChance } from '../../utils/Formatters'

/**
 * Renders tree-related connection info in the universal modal.
 *
 * Handles four entity types:
 *   - tree          → shows "Planted From" (seed/sapling), "Produces" (fruit / tap items)
 *   - fruit-tree-sapling → shows "Grows Into" (tree entity)
 *   - tree-seed     → shows "Grows Into" (tree entity)
 *   - tree-fruit    → shows "Produced By" (tree entity)
 */
function TreeConnectionsSection({ entity, findById, allItems, onNavigate }) {
  if (!entity) return null
  const type = entity.type

  // ── Tree entity: show seed/sapling + produces ────────────────────────────
  if (type === 'tree') {
    const seedItem = entity.seedId ? findById(entity.seedId) : null
    const saplingItem = entity.saplingId ? findById(entity.saplingId) : null
    const plantedFrom = saplingItem || seedItem
    const fruitItem = entity.fruitId ? findById(entity.fruitId) : null
    const tapItems = entity.tapItems || []

    const hasProduces = fruitItem || tapItems.length > 0

    const chopDrops = entity.chopDrops || []
    const woodItem = entity.dropsWood ? findById('wood') : null
    const chopSeedItem = entity.seedOnChopChance ? (findById(entity.seedId) || null) : null
    const hasChopDrops = entity.dropsWood || entity.seedOnChopChance || chopDrops.length > 0

    return (
      <>
        {plantedFrom && (
          <ModalSection id="section-planted-from" title="Planted From" navLabel="Planted From">
            <div className="source-list">
              <span className="source-entry">
                <UniversalModalButton item={plantedFrom} variant="inline" onNavigate={onNavigate} />
              </span>
            </div>
          </ModalSection>
        )}
        {hasProduces && (
          <ModalSection id="section-tree-produces" title="Produces" navLabel="Produces">
            <div className="source-list">
              {fruitItem && (
                <span className="source-entry">
                  <UniversalModalButton item={fruitItem} variant="inline" onNavigate={onNavigate} />
                  <span className="source-qualifiers">
                    {entity.seasons?.length > 0 && (
                      <SeasonBadges seasons={entity.seasons} compact greenhouse gingerIsland />
                    )}
                  </span>
                </span>
              )}
              {tapItems.flatMap((tap, idx) => {
                const tapItem = findById(tap.id)
                const tapperEntity = findById('tapper')
                const heavyTapperEntity = findById('heavy-tapper')
                const heavyDays = tap.daysUntilReady ? Math.ceil(tap.daysUntilReady / 2) : null
                const productDisplay = tapItem
                  ? <UniversalModalButton item={tapItem} variant="inline" onNavigate={onNavigate} />
                  : <span>{tap.name}</span>
                const seasonBadges = <SeasonBadges seasons={tap.seasons || ['spring', 'summer', 'fall', 'winter']} compact />
                return [
                  <span key={`${idx}-tapper`} className="source-entry">
                    <span className="source-name">{productDisplay}</span>
                    <span className="source-qualifiers">
                      {tap.note && (
                        <span className="source-qualifier source-condition">{tap.note}</span>
                      )}
                      {tap.daysUntilReady && (
                        <span className="source-qualifier">{tap.daysUntilReady}d</span>
                      )}
                      {seasonBadges}
                    </span>
                    <span className="source-detail">
                      via {tapperEntity
                        ? <UniversalModalButton item={tapperEntity} variant="inline" onNavigate={onNavigate} />
                        : 'Tapper'}
                    </span>
                  </span>,
                  <span key={`${idx}-heavy`} className="source-entry">
                    <span className="source-name">{productDisplay}</span>
                    <span className="source-qualifiers">
                      {tap.note && (
                        <span className="source-qualifier source-condition">{tap.note}</span>
                      )}
                      {heavyDays && (
                        <span className="source-qualifier">{heavyDays}d</span>
                      )}
                      {seasonBadges}
                    </span>
                    <span className="source-detail">
                      via {heavyTapperEntity
                        ? <UniversalModalButton item={heavyTapperEntity} variant="inline" onNavigate={onNavigate} />
                        : 'Heavy Tapper'}
                    </span>
                  </span>,
                ]
              })}
            </div>
          </ModalSection>
        )}
        {hasChopDrops && (
          <ModalSection id="section-when-chopped" title="When Chopped" navLabel="When Chopped">
            <div className="source-list">
              {entity.dropsWood && (
                <span className="source-entry">
                  {woodItem
                    ? <UniversalModalButton item={woodItem} variant="inline" onNavigate={onNavigate} />
                    : <span className="source-name--indented">Wood</span>}
                </span>
              )}
              {chopSeedItem && entity.seedOnChopChance && (
                <span className="source-entry">
                  <UniversalModalButton item={chopSeedItem} variant="inline" onNavigate={onNavigate} />
                  <span className="source-detail">{formatChance(entity.seedOnChopChance)}</span>
                </span>
              )}
              {chopDrops.map((drop, i) => {
                const dropItem = findById(drop.id)
                const stackLabel = drop.maxStack
                  ? `${drop.minStack}–${drop.maxStack}`
                  : drop.minStack > 1 ? `${drop.minStack}` : null
                return (
                  <span key={`${drop.gameId}-${i}`} className="source-entry">
                    <span className="source-name">
                      {dropItem
                        ? <UniversalModalButton item={dropItem} variant="inline" onNavigate={onNavigate} />
                        : <span className="source-name--indented">{drop.name}</span>}
                    </span>
                    <span className="source-detail">
                      {[
                        drop.chance < 1 ? formatChance(drop.chance) : null,
                        stackLabel ? `×${stackLabel}` : null,
                      ].filter(Boolean).join(', ')}
                    </span>
                  </span>
                )
              })}
            </div>
          </ModalSection>
        )}
      </>
    )
  }

  // ── Sapling / tree-seed: show "Grows Into" ───────────────────────────────
  if (type === 'fruit-tree-sapling' || type === 'tree-seed') {
    // Find the tree entity that references this seed/sapling
    const tree = allItems.find(i =>
      i.type === 'tree' && (i.saplingId === entity.id || i.seedId === entity.id)
    )
    if (!tree) return null

    return (
      <ModalSection id="section-grows-into" title="Grows Into" navLabel="Grows Into">
        <div className="source-list">
          <span className="source-entry">
            <UniversalModalButton item={tree} variant="inline" onNavigate={onNavigate} />
            {tree.daysToMature && (
              <span className="source-detail">{tree.daysToMature}d to mature</span>
            )}
          </span>
        </div>
      </ModalSection>
    )
  }

  // ── Tree fruit: show "Produced By" ───────────────────────────────────────
  if (type === 'tree-fruit') {
    const tree = allItems.find(i =>
      i.type === 'tree' && i.fruitId === entity.id
    )
    if (!tree) return null

    return (
      <ModalSection id="section-produced-by" title="Produced By" navLabel="Produced By">
        <div className="source-list">
          <span className="source-entry">
            <UniversalModalButton item={tree} variant="inline" onNavigate={onNavigate} />
            <span className="source-qualifiers">
              {tree.seasons?.length > 0 && (
                <SeasonBadges seasons={tree.seasons} compact greenhouse gingerIsland />
              )}
            </span>
          </span>
        </div>
      </ModalSection>
    )
  }

  return null
}

export default TreeConnectionsSection

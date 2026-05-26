import { useMemo, useState } from 'react'
import PagePanel from '../common/PagePanel'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import UniversalModalButton from '../common/UniversalModalButton'
import './FieldOfficePage.css'
import walnutRules from '../../../data/rules/golden-walnuts.json'

const _walnutSources = walnutRules.sources
const PLANT_LEFT  = _walnutSources.find(s => s.save_key === 'location:IslandFieldOffice.plantsRestoredLeft')
const PLANT_RIGHT = _walnutSources.find(s => s.save_key === 'location:IslandFieldOffice.plantsRestoredRight')

// Slot index → item gameId, matching FieldOfficeMenu.getPieceIndexForDonationItem()
// Dino grid (indices 0–5): rows are bottom→top visually; leg fills slots 0 (front) and 2 (back)
// Snake column (indices 6–8): top→bottom is skull(8), vertebrae(7), vertebrae(6)
const SLOT_ITEM_GAME_ID = {
  // Dinosaur (3×2 grid, bottom row first)
  0: '(O)823', // Fossilized Leg (front leg)
  1: '(O)824', // Fossilized Ribs
  2: '(O)823', // Fossilized Leg (back leg) — same item, second slot
  3: '(O)822', // Fossilized Tail
  4: '(O)821', // Fossilized Spine
  5: '(O)820', // Fossilized Skull
  // Snake (3 vertical slots)
  6: '(O)826', // Snake Vertebrae (bottom)
  7: '(O)826', // Snake Vertebrae (top) — same item, second slot
  8: '(O)825', // Snake Skull
  // Single pieces
  9: '(O)827',  // Mummified Bat
  10: '(O)828', // Mummified Frog
}

// Dino grid layout: 2 rows × 3 columns, slot indices
// Row 0 = top row (tail, spine, skull), Row 1 = bottom row (leg, ribs, leg)
const DINO_GRID = [
  [3, 4, 5], // top row
  [0, 1, 2], // bottom row
]

// Snake layout: 3 rows × 1 column, top to bottom
const SNAKE_SLOTS = [6, 7, 8]

function SinglePieceSection({ item, donated, hasSaveData, frameColor, label }) {
  return (
    <div className="fo-single-section">
      <div className="fo-single-label">{label}</div>
      {item && (
        <UniversalModalButton
          item={item}
          variant="collection-tile"
          donated={hasSaveData ? donated : null}
          frameColor={frameColor}
          tileSize="lg"
        />
      )}
      {hasSaveData && (
        <div className={`fo-single-status ${donated ? 'fo-single-status--done' : ''}`}>
          {donated ? 'Donated' : 'Needed'}
        </div>
      )}
    </div>
  )
}

const INLINE_SOURCE_THRESHOLD = 4

function sourceEntity(s, findById, findByGameId) {
  if (s.entityId) return findById(s.entityId)
  if (s.entityGameId) return findByGameId(s.entityGameId)
  return null
}

function ListRow({ item, onClick, findById, findByGameId }) {
  const iconSrc = item.icon
    ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`)
    : null

  const renderItems = []
  const seenEntityIds = new Set()
  const seenLabels = new Set()
  for (const s of (item.sources ?? [])) {
    if (s.type === 'fishing-chest') {
      if (!seenLabels.has('fishing-chest')) {
        seenLabels.add('fishing-chest')
        renderItems.push({ kind: 'label', key: 'fishing-chest', label: 'Fishing Chest' })
      }
      continue
    }
    if (s.type === 'secret-note-reward') {
      const key = `secret-note-${s.noteNumber}`
      if (!seenLabels.has(key)) {
        seenLabels.add(key)
        renderItems.push({ kind: 'label', key, label: `Secret Note #${s.noteNumber}` })
      }
      continue
    }
    const ent = sourceEntity(s, findById, findByGameId)
    if (!ent || seenEntityIds.has(ent.id)) continue
    seenEntityIds.add(ent.id)
    renderItems.push({ kind: 'entity', key: ent.id, entity: ent })
  }
  const inline = renderItems.length > 0 && renderItems.length <= INLINE_SOURCE_THRESHOLD

  return (
    <li className="fo-list-row">
      <button type="button" className="fo-list-button" onClick={() => onClick(item)}>
        {iconSrc && <img src={iconSrc} alt="" className="fo-list-icon" />}
        <span className="fo-list-name">{item.name}</span>
      </button>
      {inline ? (
        <span className="fo-source-buttons" onClick={(e) => e.stopPropagation()}>
          {renderItems.map(r => r.kind === 'entity' ? (
            <UniversalModalButton
              key={r.key}
              item={r.entity}
              variant="inline"
              showIcon
              stopPropagation
            />
          ) : (
            <span key={r.key} className="fo-source-label">{r.label}</span>
          ))}
        </span>
      ) : renderItems.length > INLINE_SOURCE_THRESHOLD ? (
        <span className="fo-list-cta">{renderItems.length} sources — click row →</span>
      ) : null}
    </li>
  )
}

function FieldOfficePage() {
  const { items: allItems, findById, findByGameId, loading } = useEntities()
  const progress = useProgress()
  const openModal = useOpenModal()
  const [showOnlyNeeded, setShowOnlyNeeded] = useState(false)

  const { itemByGameId, fossilItems, totals } = useMemo(() => {
    if (loading) return { itemByGameId: {}, fossilItems: [], totals: { total: 0, donated: 0, missing: 0 } }

    const hasSave = progress.hasSaveData

    const byGameId = {}
    for (const item of allItems) {
      if (item.gameId) byGameId[item.gameId] = item
    }

    const fossils = allItems.filter(it => it.fieldOfficeDonatable)
    // Deduplicate for the list (Leg and Vertebrae appear in two slots but are one item)
    const seenGameIds = new Set()
    const uniqueFossils = fossils.filter(it => {
      if (seenGameIds.has(it.gameId)) return false
      seenGameIds.add(it.gameId)
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))

    // Total: 11 fossil pieces + 2 plant survey completions
    const total = 11 + 2
    let donatedPieces = 0
    if (hasSave) {
      for (let i = 0; i <= 10; i++) {
        if (progress.isFieldOfficeDonated(i)) donatedPieces++
      }
    }
    const donatedPlants = hasSave
      ? (progress.isFieldOfficePlantRestored('left') ? 1 : 0) + (progress.isFieldOfficePlantRestored('right') ? 1 : 0)
      : 0
    const donated = donatedPieces + donatedPlants

    return {
      itemByGameId: byGameId,
      fossilItems: uniqueFossils,
      totals: { total, donated, missing: total - donated },
    }
  }, [allItems, loading, progress])

  const hasSaveData = progress.hasSaveData

  if (loading) {
    return <PagePanel><div className="fo-loading">Loading Field Office data…</div></PagePanel>
  }

  const needsList = hasSaveData && showOnlyNeeded
    ? fossilItems.filter(it => {
        const primaryMissing = !progress.isFieldOfficeDonated(it.pieceIndex)
        const altMissing = it.pieceIndexAlt !== undefined && !progress.isFieldOfficeDonated(it.pieceIndexAlt)
        return primaryMissing || altMissing
      })
    : []

  return (
    <PagePanel>
      <div className="fo-page">
        <header className="fo-header">
          <h1 className="fo-title">Island Field Office</h1>
          {hasSaveData && (
            <div className="fo-score-block">
              <div className="fo-score-numbers">
                <span className="fo-score-donated">{totals.donated}</span>
                <span className="fo-score-divider">/</span>
                <span className="fo-score-max">{totals.total}</span>
                <span className="fo-score-label">donated</span>
              </div>
              <div className="fo-milestones">
                <span className={totals.donated >= totals.total ? 'fo-milestone fo-milestone--reached' : 'fo-milestone'}>
                  {totals.total} — Ostrich Egg
                </span>
              </div>
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="fo-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track which fossils you've donated to the Field Office.
          </button>
        )}

        <div className="fo-mode-toggle" role="tablist" aria-label="Display mode">
          <button
            type="button"
            role="tab"
            aria-selected={!showOnlyNeeded}
            className={`fo-mode-btn ${!showOnlyNeeded ? 'fo-mode-btn--active' : ''}`}
            onClick={() => setShowOnlyNeeded(false)}
          >
            All Items
            <span className="fo-mode-count">{fossilItems.length}</span>
          </button>
          {hasSaveData && (
            <button
              type="button"
              role="tab"
              aria-selected={showOnlyNeeded}
              className={`fo-mode-btn ${showOnlyNeeded ? 'fo-mode-btn--active' : ''}`}
              onClick={() => setShowOnlyNeeded(true)}
            >
              Still Needed
              <span className="fo-mode-count">{totals.missing}</span>
            </button>
          )}
        </div>

        {hasSaveData && showOnlyNeeded ? (
          <section className="fo-group">
            <ul className="fo-list">
              {needsList.map(it => (
                <ListRow key={it.id} item={it} onClick={openModal} findById={findById} findByGameId={findByGameId} />
              ))}
              {!progress.isFieldOfficePlantRestored('left') && (
                <li className="fo-list-row fo-list-row--plant">
                  <div className="fo-list-button fo-list-button--static">
                    <span className="fo-list-name">{PLANT_LEFT?.label ?? 'Purple Flowers Survey'}</span>
                  </div>
                  <span className="fo-list-cta">Completed via survey</span>
                </li>
              )}
              {!progress.isFieldOfficePlantRestored('right') && (
                <li className="fo-list-row fo-list-row--plant">
                  <div className="fo-list-button fo-list-button--static">
                    <span className="fo-list-name">{PLANT_RIGHT?.label ?? 'Purple Starfish Survey'}</span>
                  </div>
                  <span className="fo-list-cta">Completed via survey</span>
                </li>
              )}
            </ul>
          </section>
        ) : (
          <div className="fo-visual-layout-wrap">
          <div className="fo-visual-layout">
            {/* Dinosaur section */}
            <div className="fo-dino-section">
              <div className="fo-section-label">Large Animal Fossil</div>
              <div className="fo-dino-body">
                <div className="fo-dino-grid">
                  {DINO_GRID.map((row, rowIdx) => (
                    <div key={rowIdx} className="fo-dino-row">
                      {row.map(slotIndex => {
                        const item = itemByGameId[SLOT_ITEM_GAME_ID[slotIndex]]
                        return item ? (
                          <UniversalModalButton
                            key={slotIndex}
                            item={item}
                            variant="collection-tile"
                            donated={hasSaveData ? progress.isFieldOfficeDonated(slotIndex) : null}
                            frameColor="gold"
                          />
                        ) : null
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {hasSaveData && (
                <div className="fo-section-score">
                  {[0,1,2,3,4,5].filter(i => progress.isFieldOfficeDonated(i)).length} / 6 pieces
                </div>
              )}
            </div>

            {/* Snake section */}
            <div className="fo-snake-section">
              <div className="fo-section-label">Snake Fossil</div>
              <div className="fo-snake-body">
                <div className="fo-snake-slots">
                  {SNAKE_SLOTS.map(slotIndex => {
                    const item = itemByGameId[SLOT_ITEM_GAME_ID[slotIndex]]
                    return item ? (
                      <UniversalModalButton
                        key={slotIndex}
                        item={item}
                        variant="collection-tile"
                        donated={hasSaveData ? progress.isFieldOfficeDonated(slotIndex) : null}
                        frameColor="gold"
                      />
                    ) : null
                  })}
                </div>
              </div>
              {hasSaveData && (
                <div className="fo-section-score">
                  {[6,7,8].filter(i => progress.isFieldOfficeDonated(i)).length} / 3 pieces
                </div>
              )}
            </div>

            {/* Single pieces: bat and frog */}
            <div className="fo-singles-column">
              <SinglePieceSection
                item={itemByGameId['(O)827']}
                donated={hasSaveData ? progress.isFieldOfficeDonated(9) : false}
                hasSaveData={hasSaveData}
                frameColor="teal"
                label="Mummified Bat"
              />
              <SinglePieceSection
                item={itemByGameId['(O)828']}
                donated={hasSaveData ? progress.isFieldOfficeDonated(10) : false}
                hasSaveData={hasSaveData}
                frameColor="green"
                label="Mummified Frog"
              />
            </div>

            {/* Plants section */}
            <div className="fo-plants-section">
              <div className="fo-section-label">Plant Fossils</div>
              <div className="fo-plant-note">
                Plant collections are completed by answering surveys correctly, not by donating specific fossils.
              </div>
              {hasSaveData && (
                <div className="fo-plant-status">
                  <span className={`fo-plant-pill ${progress.isFieldOfficePlantRestored('left') ? 'fo-plant-pill--done' : 'fo-plant-pill--pending'}`}>
                    {PLANT_LEFT?.label ?? 'Purple Flowers Survey'} {progress.isFieldOfficePlantRestored('left') ? '✓' : '—'}
                  </span>
                  <span className={`fo-plant-pill ${progress.isFieldOfficePlantRestored('right') ? 'fo-plant-pill--done' : 'fo-plant-pill--pending'}`}>
                    {PLANT_RIGHT?.label ?? 'Purple Starfish Survey'} {progress.isFieldOfficePlantRestored('right') ? '✓' : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    </PagePanel>
  )
}

export default FieldOfficePage

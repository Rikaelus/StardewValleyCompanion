import { useMemo, useState } from 'react'
import PagePanel from '../common/PagePanel'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import UniversalModalButton from '../common/UniversalModalButton'
import './MuseumPage.css'

// Group key → title + which items belong. Catch-all goes to Artifacts so
// that items the pipeline classifies under non-artifact/mineral types but
// are donatable (e.g. Dinosaur Egg as animal-product) still appear.
const GROUPS = [
  { id: 'gems',       title: 'Gems',
    match: it => it.type === 'mineral' && it.subtype === 'gem' },
  { id: 'minerals',   title: 'Minerals',
    match: it => it.type === 'mineral' && (it.subtype === 'crystal' || it.subtype === 'mineral') },
  { id: 'geode',      title: 'Geode Minerals',
    match: it => it.type === 'mineral' && it.subtype === 'geode-mineral' },
  { id: 'artifacts',  title: 'Artifacts',
    match: () => true },  // catch-all — runs last
]

function ItemTile({ item, donated, onClick }) {
  const iconSrc = item.icon
    ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`)
    : null
  const tileClass = donated == null ? 'museum-tile--neutral' : donated ? 'museum-tile--donated' : 'museum-tile--missing'
  const tileTitle = donated == null ? item.name : `${item.name} — ${donated ? 'Donated' : 'Not donated'}`
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`museum-tile ${tileClass}`}
      title={tileTitle}
    >
      {iconSrc ? (
        <img src={iconSrc} alt="" className="museum-tile-icon" />
      ) : (
        <span className="museum-tile-fallback">{item.name?.slice(0, 2).toUpperCase()}</span>
      )}
    </button>
  )
}

// Resolve the entity a source row points to using the Phase 2 normalized
// fields. Some rows have no entity link (fishing-chest, secret-note-reward,
// crafting recipes — handled separately by the caller).
function sourceEntity(s, findById, findByGameId) {
  if (s.entityId) return findById(s.entityId)
  if (s.entityGameId) return findByGameId(s.entityGameId)
  return null
}

const INLINE_SOURCE_THRESHOLD = 4

function ListRow({ item, onClick, findById, findByGameId }) {
  const iconSrc = item.icon
    ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`)
    : null

  // Build a deduped list of source representations. Each entry is either an
  // entity (rendered as a UniversalModalButton) or a static label (rendered as text).
  const renderItems = []  // [{ kind: 'entity', entity } | { kind: 'label', label }]
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
    <li className="museum-list-row">
      <button type="button" className="museum-list-button" onClick={() => onClick(item)}>
        {iconSrc && <img src={iconSrc} alt="" className="museum-list-icon" />}
        <span className="museum-list-name">{item.name}</span>
      </button>
      {inline ? (
        <span className="museum-source-buttons" onClick={(e) => e.stopPropagation()}>
          {renderItems.map(r => r.kind === 'entity' ? (
            <UniversalModalButton
              key={r.key}
              item={r.entity}
              variant="inline"
              showIcon
              stopPropagation
            />
          ) : (
            <span key={r.key} className="museum-source-label">{r.label}</span>
          ))}
        </span>
      ) : (
        <span className="museum-list-cta">{renderItems.length} sources — click row →</span>
      )}
    </li>
  )
}

function MuseumPage() {
  const { items: allItems, findById, findByGameId, loading } = useEntities()
  const progress = useProgress()
  const openModal = useOpenModal()
  const [showOnlyNeeded, setShowOnlyNeeded] = useState(false)

  const groups = useMemo(() => {
    if (loading) return []
    const donatable = allItems.filter(it => it.museumDonatable)

    // Assign each item to the first matching group (mutually exclusive).
    const buckets = GROUPS.map(g => ({ ...g, items: [] }))
    for (const it of donatable) {
      for (const bucket of buckets) {
        if (bucket.match(it)) {
          bucket.items.push(it)
          break
        }
      }
    }

    return buckets.map(b => {
      b.items.sort((a, b) => a.name.localeCompare(b.name))
      const donatedCount = b.items.filter(it => progress.isMuseumDonated(it.gameId)).length
      return { ...b, donatedCount, total: b.items.length }
    })
  }, [allItems, loading, progress])

  const totals = useMemo(() => {
    const total = groups.reduce((s, g) => s + g.total, 0)
    const donated = groups.reduce((s, g) => s + g.donatedCount, 0)
    return { total, donated, missing: total - donated }
  }, [groups])

  const hasSaveData = progress.hasSaveData

  if (loading) {
    return <PagePanel><div className="museum-loading">Loading museum data…</div></PagePanel>
  }

  return (
    <PagePanel>
      <div className="museum-page">
        <header className="museum-header">
          <h1 className="museum-title">Museum Collection</h1>
          {hasSaveData && (
            <div className="museum-score-block">
              <div className="museum-score-numbers">
                <span className="museum-score-total">{totals.donated}</span>
                <span className="museum-score-divider">/</span>
                <span className="museum-score-max">{totals.total}</span>
                <span className="museum-score-label">donated</span>
              </div>
              <div className="museum-milestones">
                <span className={totals.donated >= 40 ? 'museum-milestone museum-milestone--reached' : 'museum-milestone'}>
                  40 — Treasure Trove
                </span>
                <span className={totals.donated >= 60 ? 'museum-milestone museum-milestone--reached' : 'museum-milestone'}>
                  60 — Rusty Key (grandpa point)
                </span>
                <span className={totals.donated >= totals.total ? 'museum-milestone museum-milestone--reached' : 'museum-milestone'}>
                  {totals.total} — Stardrop + A Complete Collection
                </span>
              </div>
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="museum-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track which artifacts and minerals you've donated to Gunther.
          </button>
        )}

        <div className="museum-mode-toggle" role="tablist" aria-label="Display mode">
          <button
            type="button"
            role="tab"
            aria-selected={!showOnlyNeeded}
            className={`museum-mode-btn ${!showOnlyNeeded ? 'museum-mode-btn--active' : ''}`}
            onClick={() => setShowOnlyNeeded(false)}
          >
            All Items
            <span className="museum-mode-count">{totals.total}</span>
          </button>
          {hasSaveData && (
            <button
              type="button"
              role="tab"
              aria-selected={showOnlyNeeded}
              className={`museum-mode-btn ${showOnlyNeeded ? 'museum-mode-btn--active' : ''}`}
              onClick={() => setShowOnlyNeeded(true)}
            >
              Still Needed
              <span className="museum-mode-count">{totals.missing}</span>
            </button>
          )}
        </div>

        {hasSaveData && showOnlyNeeded ? (
          <section className="museum-group">
            <ul className="museum-list">
              {groups
                .flatMap(g => g.items)
                .filter(it => !progress.isMuseumDonated(it.gameId))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(it => (
                  <ListRow key={it.id} item={it} onClick={openModal} findById={findById} findByGameId={findByGameId} />
                ))}
            </ul>
          </section>
        ) : (
          <div className="museum-groups">
            {groups.map(group => (
              <section key={group.id} className="museum-group">
                <header className="museum-group-header">
                  <h2 className="museum-group-name">{group.title}</h2>
                  {hasSaveData && (
                    <span className="museum-group-score">
                      {group.donatedCount} / {group.total}
                    </span>
                  )}
                </header>
                <div className="museum-grid">
                  {group.items.map(it => (
                    <ItemTile
                      key={it.id}
                      item={it}
                      donated={hasSaveData ? progress.isMuseumDonated(it.gameId) : null}
                      onClick={openModal}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PagePanel>
  )
}

export default MuseumPage

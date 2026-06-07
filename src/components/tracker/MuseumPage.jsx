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


function sourceDesc(item, findById, findByGameId) {
  const labels = []
  const seenEntityIds = new Set()
  const seenLabels = new Set()
  for (const s of (item.sources ?? [])) {
    if (s.type === 'fishing-chest') {
      if (!seenLabels.has('fishing-chest')) { seenLabels.add('fishing-chest'); labels.push('Fishing Chest') }
      continue
    }
    if (s.type === 'secret-note-reward') {
      const key = `secret-note-${s.noteNumber}`
      if (!seenLabels.has(key)) { seenLabels.add(key); labels.push(`Secret Note #${s.noteNumber}`) }
      continue
    }
    const ent = s.entityId ? findById(s.entityId) : s.entityGameId ? findByGameId(s.entityGameId) : null
    if (!ent || seenEntityIds.has(ent.id)) continue
    seenEntityIds.add(ent.id)
    labels.push(ent.name)
  }
  if (!labels.length) return null
  return labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} +${labels.length - 3}`
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
            {totals.missing === 0 ? (
              <p className="museum-complete-note">You've donated everything — the museum is complete!</p>
            ) : (
              <div className="museum-card-grid">
                {groups
                  .flatMap(g => g.items)
                  .filter(it => !progress.isMuseumDonated(it.gameId))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(it => (
                    <UniversalModalButton
                      key={it.id}
                      item={it}
                      variant="card"
                      cardState="needed"
                      cardDesc={sourceDesc(it, findById, findByGameId)}
                      onNavigate={openModal}
                    />
                  ))}
              </div>
            )}
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
                <div className="museum-card-grid">
                  {group.items.map(it => {
                    const donated = hasSaveData ? progress.isMuseumDonated(it.gameId) : null
                    return (
                      <UniversalModalButton
                        key={it.id}
                        item={it}
                        variant="card"
                        cardState={donated === null ? null : donated ? 'earned' : 'needed'}
                        cardDesc={sourceDesc(it, findById, findByGameId)}
                        onNavigate={openModal}
                      />
                    )
                  })}
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

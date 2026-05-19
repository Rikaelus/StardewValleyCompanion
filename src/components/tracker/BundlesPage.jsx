import { useMemo, useState } from 'react'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import './BundlesPage.css'

// Canonical room order from the game
const ROOM_ORDER = [
  'Pantry',
  'Crafts Room',
  'Fish Tank',
  'Boiler Room',
  'Bulletin Board',
  'Vault',
  'Abandoned Joja Mart',
]

const PLACEHOLDER_GAME_IDS = new Set(['(O)0', '(O)2', '(O)10'])

function realItems(bundle) {
  return (bundle.items ?? []).filter(i => !PLACEHOLDER_GAME_IDS.has(i.gameId))
}

function BundleTile({ bundle, onClick, progress, isMissingBundleAvailable }) {
  const isGold = !!bundle.goldCost
  const items = isGold ? [] : realItems(bundle)
  const required = bundle.minItemsRequired ?? items.length

  let complete = false
  let filledCount = 0

  if (progress && isGold) {
    complete = progress.complete
    filledCount = complete ? 1 : 0
  } else if (progress) {
    filledCount = progress.items.filter(Boolean).length
    complete = filledCount >= required
  }

  const isGated = bundle.id === 'bundle-the-missing' && !isMissingBundleAvailable

  const iconSrc = bundle.icon
    ? (bundle.icon.startsWith('/') ? bundle.icon : `/${bundle.icon}`)
    : null

  let statusClass = 'bundle-tile--default'
  if (progress) {
    statusClass = complete ? 'bundle-tile--complete' : 'bundle-tile--incomplete'
  }
  if (isGated) statusClass = 'bundle-tile--gated'

  return (
    <button
      type="button"
      className={`bundle-tile ${statusClass}`}
      onClick={() => onClick(bundle)}
      title={bundle.name}
    >
      <div className="bundle-tile-icon-wrap">
        {iconSrc && <img src={iconSrc} alt="" className="bundle-tile-icon" />}
        {progress && complete && <span className="bundle-tile-check">✓</span>}
      </div>
      <span className="bundle-tile-name">{bundle.name}</span>

      {isGold ? (
        <span className="bundle-tile-gold">
          {bundle.goldCost.toLocaleString()}g
        </span>
      ) : (
        <div className="bundle-tile-pips">
          {Array.from({ length: required }).map((_, i) => (
            <span
              key={i}
              className={`bundle-pip ${progress && progress.items[i] ? 'bundle-pip--filled' : ''}`}
            />
          ))}
          {bundle.minItemsRequired && (
            <span className="bundle-tile-of">/{items.length}</span>
          )}
        </div>
      )}
    </button>
  )
}

const QUALITY_LABEL = { 1: 'Silver+', 2: 'Gold+', 4: 'Iridium+' }

function ShoppingList({ bundles, findByGameId, openModal, progress }) {
  const needed = useMemo(() => {
    // Key by gameId:quality so wine(q0) and wine(q1) are separate rows.
    const byKey = new Map()

    for (const bundle of bundles) {
      if (bundle.goldCost) continue

      const items = realItems(bundle)
      const required = bundle.minItemsRequired ?? items.length
      const prog = progress.getBundleProgress(bundle.bundleNumber, items.length)

      if (prog?.complete) continue

      const filledCount = prog ? prog.items.filter(Boolean).length : 0
      if (filledCount >= required) continue

      for (let i = 0; i < items.length; i++) {
        const slot = items[i]
        const turnedIn = prog ? prog.items[i] : false
        if (turnedIn) continue

        const entity = findByGameId(slot.gameId)
        if (!entity) continue

        const key = `${slot.gameId}:${slot.quality}:${slot.quantity}`
        if (!byKey.has(key)) {
          byKey.set(key, { entity, bundles: [], quantity: slot.quantity, quality: slot.quality })
        }
        byKey.get(key).bundles.push(bundle)
      }
    }

    return Array.from(byKey.values()).sort((a, b) =>
      a.entity.name.localeCompare(b.entity.name) || a.quality - b.quality || a.quantity - b.quantity
    )
  }, [bundles, findByGameId, progress])

  if (needed.length === 0) {
    return (
      <div className="bundles-empty">
        <p>All bundles complete!</p>
      </div>
    )
  }

  return (
    <ul className="bundles-shopping-list">
      {needed.map(({ entity, bundles: neededFor, quantity, quality }) => (
        <li key={`${entity.id}:${quality}:${quantity}`} className="bundles-shopping-row">
          <UniversalModalButton
            item={entity}
            variant="bundle-item"
            quality={quality}
            quantity={quantity}
            stopPropagation
            onNavigate={openModal}
          />
          <span className="bundles-shopping-info">
            <span className="bundles-shopping-name">{entity.name}</span>
            {quality > 0 && (
              <span className="bundles-shopping-quality">{QUALITY_LABEL[quality]}</span>
            )}
          </span>
          <span className="bundles-shopping-for">
            {neededFor.map((b, i) => (
              <span key={b.id}>
                {i > 0 && ', '}
                <button
                  type="button"
                  className="bundles-shopping-bundle-link"
                  onClick={() => openModal(b)}
                >
                  {b.name}
                </button>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function BundlesPage() {
  const { items: allItems, findByGameId, loading } = useEntities()
  const progress = useProgress()
  const openModal = useOpenModal()
  const [tab, setTab] = useState('all')

  const { rooms, totals } = useMemo(() => {
    if (loading) return { rooms: [], totals: { complete: 0, total: 0 } }

    const bundles = allItems.filter(i => i.type === 'bundle')

    // Group by room in canonical order
    const roomMap = new Map(ROOM_ORDER.map(r => [r, []]))
    for (const b of bundles) {
      if (roomMap.has(b.room)) roomMap.get(b.room).push(b)
      else {
        if (!roomMap.has(b.room)) roomMap.set(b.room, [])
        roomMap.get(b.room).push(b)
      }
    }

    let totalComplete = 0
    let totalBundles = 0

    const resolvedRooms = ROOM_ORDER
      .filter(r => roomMap.has(r) && roomMap.get(r).length > 0)
      .map(r => {
        const roomBundles = roomMap.get(r)
        let roomComplete = 0
        for (const b of roomBundles) {
          totalBundles++
          const isGold = !!b.goldCost
          const items = isGold ? [] : realItems(b)
          const required = b.minItemsRequired ?? items.length
          const prog = progress.hasSaveData
            ? progress.getBundleProgress(b.bundleNumber, isGold ? 1 : items.length)
            : null
          const complete = isGold ? !!prog?.complete : (prog ? prog.items.filter(Boolean).length >= required : false)
          if (complete) { roomComplete++; totalComplete++ }
        }
        return { room: r, bundles: roomBundles, roomComplete, roomTotal: roomBundles.length }
      })

    return { rooms: resolvedRooms, totals: { complete: totalComplete, total: totalBundles } }
  }, [allItems, loading, progress])

  const hasSaveData = progress.hasSaveData
  const isJojaRoute = progress.isJojaRoute

  const allBundles = useMemo(() => allItems.filter(i => i.type === 'bundle'), [allItems])

  const tabs = [
    { id: 'all', label: 'All Bundles', count: totals.total },
    ...(hasSaveData && !isJojaRoute
      ? [{ id: 'needed', label: 'Shopping List', count: null }]
      : []),
  ]

  if (loading) {
    return <PagePanel><div className="bundles-loading">Loading bundle data…</div></PagePanel>
  }

  return (
    <PagePanel>
      <div className="bundles-page">
        <header className="bundles-header">
          <h1 className="bundles-title">Bundles</h1>
          {hasSaveData && !isJojaRoute && (
            <div className="bundles-score-block">
              <span className="bundles-score-done">{totals.complete}</span>
              <span className="bundles-score-divider">/</span>
              <span className="bundles-score-max">{totals.total}</span>
              <span className="bundles-score-label">bundles complete</span>
            </div>
          )}
        </header>

        {isJojaRoute && (
          <div className="bundles-joja-notice">
            You're on the Joja route — the Community Center has been demolished and bundles are not tracked.
          </div>
        )}

        {!hasSaveData && (
          <button
            type="button"
            className="bundles-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track bundle progress and see what you still need.
          </button>
        )}

        {!isJojaRoute && (
          <>
            <div className="bundles-tabs" role="tablist">
              {tabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`bundles-tab ${tab === t.id ? 'bundles-tab--active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.count != null && <span className="bundles-tab-count">{t.count}</span>}
                </button>
              ))}
            </div>

            {tab === 'needed' ? (
              <ShoppingList
                bundles={allBundles}
                findByGameId={findByGameId}
                openModal={openModal}
                progress={progress}
              />
            ) : (
              <div className="bundles-rooms">
                {rooms.map(({ room, bundles, roomComplete, roomTotal }) => (
                  <section key={room} className="bundles-room">
                    <header className="bundles-room-header">
                      <h2 className="bundles-room-name">{room}</h2>
                      {hasSaveData && (
                        <span className="bundles-room-score">
                          {roomComplete} / {roomTotal}
                        </span>
                      )}
                    </header>
                    <div className="bundles-room-grid">
                      {bundles.map(b => {
                        const isGold = !!b.goldCost
                        const items = isGold ? [] : realItems(b)
                        const prog = hasSaveData
                          ? progress.getBundleProgress(b.bundleNumber, isGold ? 1 : items.length)
                          : null
                        return (
                          <BundleTile
                            key={b.id}
                            bundle={b}
                            onClick={openModal}
                            progress={prog}
                            isMissingBundleAvailable={progress.isMissingBundleAvailable}
                          />
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PagePanel>
  )
}

export default BundlesPage

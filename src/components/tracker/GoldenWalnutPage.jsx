import { useMemo } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import { useEntities } from '../../contexts/EntityContext'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import './GoldenWalnutPage.css'
import walnutRules from '../../../data/rules/golden-walnuts.json'

const WALNUT_SOURCES = walnutRules.sources.map(s => ({ ...s, saveKey: s.save_key }))

const AREA_ORDER = ['general', 'east', 'west', 'north', 'volcano', 'south', 'southeast']
const AREA_LABELS = {
  general: 'General (All Areas)',
  east: 'Island East',
  west: 'Island West',
  north: 'Island North',
  volcano: 'Volcano Dungeon',
  south: 'Island South',
  southeast: 'Island SE & Pirate Cove',
}

const PARROT_UPGRADES = [
  { cost: 1, label: 'Island North access', description: 'Unlock the north side of the island.' },
  { cost: 10, label: 'Island West access', description: 'Unlock the west side of the island.' },
  { cost: 20, label: 'Island Farmhouse', description: 'Unlock the farmhouse — sleep here to skip leaving the island.' },
  { cost: 5, label: 'Farmhouse Mailbox', description: 'Check your mail without leaving the island.' },
  { cost: 20, label: 'Farm Obelisk', description: 'Teleport back to your farm.' },
  { cost: 10, label: 'Dig Site Bridge', description: 'Repair the bridge to access the dig site.' },
  { cost: 10, label: 'Island Trader', description: 'Unlock the Island Trader shop.' },
  { cost: 5, label: 'Volcano Bridge', description: 'Permanent bridge into the Volcano (no watering can needed).' },
  { cost: 5, label: 'Volcano Exit Shortcut', description: 'Quick escape from level 5 of the Volcano Dungeon.' },
  { cost: 20, label: 'Beach Resort', description: 'Unlock the beach resort, Island Southeast, and Pirate Cove.' },
  { cost: 10, label: 'Parrot Express', description: 'Unlock fast travel around the island.' },
]
const TOTAL_PARROT_COST = PARROT_UPGRADES.reduce((s, u) => s + u.cost, 0)

function resolveSourceStatus(source, walnutData, mailReceived) {
  if (!walnutData) return { found: null, max: source.count }

  const key = source.saveKey
  if (!key) return { found: null, max: source.count }

  if (key.startsWith('mail:')) {
    const flag = key.slice(5)
    return { found: mailReceived?.includes(flag) ? source.count : 0, max: source.count }
  }

  if (key.startsWith('limitedNutDrops:')) {
    const val = walnutData.limitedNutDrops?.[key.slice(16)] ?? 0
    return { found: val, max: source.count }
  }

  if (key.startsWith('collectedNutTracker:')) {
    const trackerKey = key.slice(20)
    return { found: walnutData.collectedNutTracker?.has(trackerKey) ? source.count : 0, max: source.count }
  }

  if (key.startsWith('foundBuriedNuts:')) {
    const nutKey = key.slice(16)
    return { found: walnutData.foundBuriedNuts?.has(nutKey) ? source.count : 0, max: source.count }
  }

  if (key.startsWith('location:')) {
    const rest = key.slice(9) // e.g. "IslandFarmCave.gourmandRequestsFulfilled>=2"
    // Check for >= comparison: "Loc.field>=N"
    const geMatch = rest.match(/^(.+?)>=(\d+)$/)
    if (geMatch) {
      const flagKey = geMatch[1] // "IslandFarmCave.gourmandRequestsFulfilled"
      const threshold = parseInt(geMatch[2], 10)
      const val = walnutData.locationFlags?.[flagKey]
      if (val == null) return { found: null, max: source.count }
      return { found: val >= threshold ? source.count : 0, max: source.count }
    }
    // Plain boolean or nested: "Loc.flag" or "Loc.nested.field"
    const val = walnutData.locationFlags?.[rest]
    if (val == null) return { found: null, max: source.count }
    return { found: val === true || val === 1 ? source.count : 0, max: source.count }
  }

  return { found: null, max: source.count }
}

function SourceRow({ source, status, hasSaveData }) {
  const isComplete = hasSaveData && status.found != null && status.found >= status.max
  const isPartial = hasSaveData && status.found != null && status.found > 0 && !isComplete
  const isUntrackable = source.saveKey === null

  let rowClass = 'walnut-row'
  if (isComplete) rowClass += ' walnut-row--done'
  else if (isPartial) rowClass += ' walnut-row--partial'

  return (
    <div className={rowClass}>
      <div className="walnut-row-left">
        <span className={`walnut-check ${isComplete ? 'walnut-check--done' : isPartial ? 'walnut-check--partial' : 'walnut-check--empty'}`}>
          {isComplete ? '✓' : isPartial ? '…' : ''}
        </span>
        <div className="walnut-row-info">
          <span className="walnut-row-label">{source.label}</span>
          <span className="walnut-row-desc">{source.description}</span>
        </div>
      </div>
      <div className="walnut-row-right">
        {hasSaveData && !isUntrackable && status.found != null ? (
          <span className="walnut-count">
            {`${status.found}/${source.count}`}
          </span>
        ) : (
          <span className="walnut-count walnut-count--max">×{source.count}</span>
        )}
      </div>
    </div>
  )
}

function AreaSection({ area, sources, walnutData, mailReceived, hasSaveData }) {
  const statuses = sources.map(s => resolveSourceStatus(s, walnutData, mailReceived))
  const areaFound = hasSaveData
    ? statuses.reduce((sum, st) => sum + (st.found ?? 0), 0)
    : null
  const areaTotal = sources.reduce((sum, s) => sum + s.count, 0)

  return (
    <section className="walnut-area">
      <div className="walnut-area-header">
        <h2 className="walnut-area-title">{AREA_LABELS[area]}</h2>
        {hasSaveData && areaFound != null && (
          <span className="walnut-area-count">{areaFound} / {areaTotal}</span>
        )}
        {!hasSaveData && (
          <span className="walnut-area-count">{areaTotal} available</span>
        )}
      </div>
      <div className="walnut-area-rows">
        {sources.map((source, i) => (
          <SourceRow
            key={source.id}
            source={source}
            status={statuses[i]}
            hasSaveData={hasSaveData}
          />
        ))}
      </div>
    </section>
  )
}

function GoldenWalnutPage() {
  const { player } = usePlayer()
  const { items: allEntities } = useEntities()
  const saveData = player.saveData
  const hasSaveData = saveData != null

  const qiRoomEntity = useMemo(() => allEntities?.find(e => e.id === 'map-qinutroom') ?? null, [allEntities])

  const walnutData = useMemo(() => {
    const raw = saveData?.walnutData ?? null
    if (!raw) return null
    return {
      ...raw,
      collectedNutTracker: new Set(Array.isArray(raw.collectedNutTracker) ? raw.collectedNutTracker : []),
      foundBuriedNuts: new Set(Array.isArray(raw.foundBuriedNuts) ? raw.foundBuriedNuts : []),
    }
  }, [saveData])
  const mailReceived = saveData?.mailReceived ?? []
  const totalFound = saveData?.goldenWalnuts ?? null

  const sourcesByArea = useMemo(() => {
    const grouped = {}
    for (const src of WALNUT_SOURCES) {
      if (!grouped[src.area]) grouped[src.area] = []
      grouped[src.area].push(src)
    }
    return grouped
  }, [])

  // Count trackable progress
  const trackableProgress = useMemo(() => {
    if (!hasSaveData || !walnutData) return null
    let found = 0
    let total = 0
    for (const src of WALNUT_SOURCES) {
      const status = resolveSourceStatus(src, walnutData, mailReceived)
      if (status.found != null) {
        found += status.found
        total += status.max
      }
    }
    return { found, total }
  }, [hasSaveData, walnutData, mailReceived])

  const TOTAL_WALNUTS = 130
  const pct = totalFound != null ? Math.min(1, totalFound / TOTAL_WALNUTS) : 0

  return (
    <PagePanel>
      <div className="walnut-page">
        <header className="walnut-header">
          <h1 className="walnut-title">Golden Walnuts</h1>
          <p className="walnut-subtitle">
            Ginger Island currency — 130 total, 129 individually trackable. Collecting 100 unlocks{' '}
            {qiRoomEntity ? <UniversalModalButton item={qiRoomEntity} variant="inline" showIcon /> : "Qi's Walnut Room"}.
          </p>

          {hasSaveData && totalFound != null && (
            <div className="walnut-progress-wrap">
              <div className="walnut-progress-label">
                <span>{totalFound} / {TOTAL_WALNUTS} found</span>
                {totalFound >= 100 && (
                  <span className="walnut-qi-unlocked">
                    {qiRoomEntity ? <UniversalModalButton item={qiRoomEntity} variant="inline" showIcon /> : "Qi's Walnut Room"} unlocked ✓
                  </span>
                )}
              </div>
              <div className="walnut-progress-bar">
                <div
                  className={`walnut-progress-fill ${totalFound >= TOTAL_WALNUTS ? 'walnut-progress-fill--done' : ''}`}
                  style={{ width: `${pct * 100}%` }}
                />
                <div className="walnut-progress-pip walnut-progress-pip--100" style={{ left: `${(100 / TOTAL_WALNUTS) * 100}%` }} title="100 — Qi's Walnut Room" />
              </div>
              {trackableProgress && (
                <p className="walnut-tracking-note">
                  {trackableProgress.found} / {trackableProgress.total} walnuts tracked from save data
                  ({TOTAL_WALNUTS - trackableProgress.total} come from exploration items not stored individually in your save)
                </p>
              )}
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="walnut-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track your walnut progress.
          </button>
        )}

        <div className="walnut-parrot-section">
          <h2 className="walnut-section-title">Parrot Upgrades</h2>
          <p className="walnut-parrot-intro">
            Spend walnuts to unlock island infrastructure. Total cost: <strong>{TOTAL_PARROT_COST} walnuts</strong>.
          </p>
          <div className="walnut-parrot-grid">
            {PARROT_UPGRADES.map(u => (
              <div key={u.label} className="walnut-parrot-card">
                <span className="walnut-parrot-cost">🌰 {u.cost}</span>
                <div>
                  <div className="walnut-parrot-label">{u.label}</div>
                  <div className="walnut-parrot-desc">{u.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="walnut-areas">
          {AREA_ORDER.map(area => sourcesByArea[area] && (
            <AreaSection
              key={area}
              area={area}
              sources={sourcesByArea[area]}
              walnutData={walnutData}
              mailReceived={mailReceived}
              hasSaveData={hasSaveData}
            />
          ))}
        </div>
      </div>
    </PagePanel>
  )
}

export default GoldenWalnutPage

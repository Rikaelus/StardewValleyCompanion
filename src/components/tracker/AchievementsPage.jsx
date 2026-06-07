import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import { useOpenModal } from '../../contexts/ModalContext'
import { computeAchievementProgress } from '../../utils/AchievementProgress'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import './AchievementsPage.css'

const GROUPS = [
  {
    id: 'wealth',
    title: 'Wealth',
    ids: [0, 1, 2, 3, 4],
  },
  {
    id: 'farming',
    title: 'Farming & Shipping',
    ids: [31, 32, 34, 37, 38],
  },
  {
    id: 'cooking',
    title: 'Cooking',
    ids: [15, 16, 17],
  },
  {
    id: 'crafting',
    title: 'Crafting',
    ids: [20, 21, 22],
  },
  {
    id: 'fishing',
    title: 'Fishing',
    ids: [24, 25, 26, 27],
  },
  {
    id: 'museum',
    title: 'Museum',
    ids: [28, 5],
  },
  {
    id: 'social',
    title: 'Social',
    ids: [6, 7, 9, 11, 12, 13],
  },
  {
    id: 'home',
    title: 'Home & Community',
    ids: [18, 19, 29, 30, 35, 36, 39, 40],
  },
  {
    id: 'combat',
    title: 'Combat & Exploration',
    ids: [41, 42, 44],
  },
]

function formatProgress(p) {
  if (p.format === 'gold') {
    return `${p.done.toLocaleString()}g / ${p.total.toLocaleString()}g`
  }
  return `${p.done.toLocaleString()} / ${p.total.toLocaleString()}`
}

function AchievementCard({ achievement, earned, onClick, progressEntry }) {
  const hasCounter = progressEntry && progressEntry.done != null && progressEntry.total != null
  const linkPath = progressEntry?.linkPath
  const cardState = earned === null ? null : earned ? 'earned' : 'needed'

  const desc = achievement.isSecret && !earned && earned !== null
    ? 'Secret achievement'
    : achievement.description

  const meta = hasCounter ? formatProgress(progressEntry) : null

  return (
    <li className="achievement-card-item">
      <UniversalModalButton
        item={achievement}
        variant="card"
        cardState={cardState}
        cardDesc={desc}
        cardMeta={meta}
        gutter={linkPath || true}
        onNavigate={onClick}
        className="achievement-card-btn"
      />
    </li>
  )
}

function AchievementsPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const openModal = useOpenModal()
  const [filter, setFilter] = useState('all')

  const achievementProgress = useMemo(
    () => (loading ? new Map() : computeAchievementProgress(items, progress)),
    [items, loading, progress],
  )

  const { groups, totals } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 } }

    const achievById = {}
    for (const item of items.filter(i => i.type === 'achievement')) {
      achievById[item.achievementId] = item
    }

    const resolvedGroups = GROUPS.map(g => ({
      ...g,
      items: g.ids
        .map(id => achievById[id])
        .filter(Boolean)
        .map(a => ({
          achievement: a,
          earned: progress.hasAchievement(a.achievementId),
        })),
    })).filter(g => g.items.length > 0)

    const allItems = resolvedGroups.flatMap(g => g.items)
    const done = allItems.filter(i => i.earned).length

    return { groups: resolvedGroups, totals: { done, total: allItems.length } }
  }, [items, loading, progress])

  const hasSaveData = progress.hasSaveData

  const tabs = [
    { id: 'all', label: 'All', count: totals.total },
    ...(hasSaveData ? [{ id: 'needed', label: 'Still Needed', count: totals.total - totals.done }] : []),
  ]

  const displayed = hasSaveData && filter === 'needed'
    ? [{ id: 'needed', title: 'Still Needed', items: groups.flatMap(g => g.items).filter(i => !i.earned) }]
    : groups

  return (
    <PagePanel>
      <div className="achievements-page">
        <header className="achievements-header">
          <h1 className="achievements-title">Achievements</h1>
          {hasSaveData && (
            <div className="achievements-score-block">
              <div className="achievements-score-numbers">
                <span className="achievements-score-done">{totals.done}</span>
                <span className="achievements-score-divider">/</span>
                <span className="achievements-score-max">{totals.total}</span>
                <span className="achievements-score-label">earned</span>
              </div>
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="achievements-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track which achievements you've earned.
          </button>
        )}

        <div className="achievements-filter-toggle" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`achievements-filter-btn ${filter === tab.id ? 'achievements-filter-btn--active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className="achievements-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="achievements-groups">
          {displayed.map(group => (
            <section key={group.id} className="achievements-group">
              <header className="achievements-group-header">
                <h2 className="achievements-group-name">{group.title}</h2>
                {hasSaveData && (
                  <span className="achievements-group-score">
                    {group.items.filter(i => i.earned).length} / {group.items.length}
                  </span>
                )}
              </header>
              <ul className="achievements-card-grid">
                {group.items.map(({ achievement, earned }) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    earned={hasSaveData ? earned : null}
                    onClick={openModal}
                    progressEntry={achievementProgress.get(achievement.achievementId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </PagePanel>
  )
}

export default AchievementsPage

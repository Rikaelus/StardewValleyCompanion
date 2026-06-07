import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import PagePanel from '../common/PagePanel'
import UniversalModalButton from '../common/UniversalModalButton'
import { usePageGoals } from '../../hooks/UsePageGoals'
import './SlayerPage.css'
import './CollectionPage.css'

// Quest groups — targets only; count/reward come from monster.slayerQuest in entities.json
const QUEST_GROUPS = [
  { id: 'Slimes',       label: 'Slimes',       targets: ['Green Slime', 'Frost Jelly', 'Sludge', 'Tiger Slime']          },
  { id: 'Shadows',      label: 'Void Spirits', targets: ['Shadow Shaman', 'Shadow Brute', 'Shadow Sniper']               },
  { id: 'Bats',         label: 'Bats',         targets: ['Bat', 'Frost Bat', 'Lava Bat', 'Iridium Bat']                  },
  { id: 'Skeletons',    label: 'Skeletons',    targets: ['Skeleton', 'Skeleton Mage']                                    },
  { id: 'Insects',      label: 'Cave Insects', targets: ['Grub', 'Fly', 'Bug']                                           },
  { id: 'Duggy',        label: 'Duggies',      targets: ['Duggy', 'Magma Duggy']                                         },
  { id: 'DustSpirits',  label: 'Dust Sprites', targets: ['Dust Spirit']                                                  },
  { id: 'Crabs',        label: 'Rock Crabs',   targets: ['Rock Crab', 'Lava Crab', 'Iridium Crab']                       },
  { id: 'Mummies',      label: 'Mummies',      targets: ['Mummy']                                                        },
  { id: 'Dinos',        label: 'Pepper Rex',   targets: ['Pepper Rex']                                                   },
  { id: 'Serpents',     label: 'Serpents',     targets: ['Serpent', 'Royal Serpent']                                     },
  { id: 'FlameSpirits', label: 'Magma Sprites',targets: ['Magma Sprite', 'Magma Sparker']                                },
]

function QuestGroupCard({ group, kills, done }) {
  const tracked = kills != null
  const pct = tracked ? Math.min(1, kills / group.count) : 0
  return (
    <div className={`slayer-card ${done ? 'slayer-card--done' : ''}`}>
      <div className="slayer-card-header">
        <span className="slayer-card-label">{group.label}</span>
        <span className="slayer-card-count">
          {tracked ? `${kills.toLocaleString()} / ${group.count.toLocaleString()}` : `Goal: ${group.count.toLocaleString()}`}
        </span>
      </div>
      <div className="slayer-bar">
        <div
          className={`slayer-bar-fill ${done ? 'slayer-bar-fill--done' : ''}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="slayer-card-members">
        {group.monsters.map(monster => (
          <UniversalModalButton
            key={monster.id}
            item={monster}
            variant="table-inline"
            showIcon
          />
        ))}
      </div>
      <div className="slayer-card-reward">
        <span className="slayer-reward-label">Reward:</span>
        {group.rewardItem && (
          <UniversalModalButton
            item={group.rewardItem}
            variant="table-inline"
            showIcon
          />
        )}
        {group.rewardGold > 0 && (
          <span className="slayer-reward-gold">{group.rewardGold.toLocaleString()}g</span>
        )}
        {!group.rewardItem && !group.rewardGold && (
          <span className="slayer-reward-none">—</span>
        )}
      </div>
    </div>
  )
}

function SlayerPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const pageGoals = usePageGoals()
  const [filter, setFilter] = useState('all')

  const { quests, totals } = useMemo(() => {
    if (loading) return { quests: [], totals: { done: 0, total: 0 } }

    const monsterByName = new Map()
    for (const item of items.filter(i => i.type === 'monster')) {
      if (item.internalName) monsterByName.set(item.internalName, item)
    }

    const itemByGameId = new Map()
    for (const item of items) {
      if (item.gameId) itemByGameId.set(item.gameId, item)
    }

    const quests = QUEST_GROUPS.map(group => {
      const monsters = group.targets.map(t => monsterByName.get(t)).filter(Boolean)
      // Derive count and reward from the first monster that has slayerQuest data
      const questData = monsters.find(m => m.slayerQuest)?.slayerQuest ?? {}
      const count = questData.killCount ?? 0
      const rewardItem = questData.rewardItemGameId ? itemByGameId.get(questData.rewardItemGameId) ?? null : null
      const rewardGold = questData.rewardGold ?? 0
      const kills = group.targets.reduce((sum, t) => sum + progress.getMonsterKills(t), 0)
      const done = count > 0 && kills >= count
      return { ...group, count, kills, done, monsters, rewardItem, rewardGold }
    })

    const done = quests.filter(q => q.done).length
    return { quests, totals: { done, total: quests.length } }
  }, [items, loading, progress])

  const hasSaveData = progress.hasSaveData
  const displayed = filter === 'needed' ? quests.filter(q => !q.done) : quests

  const tabs = [
    { id: 'all', label: 'All Goals', count: totals.total },
    ...(hasSaveData ? [{ id: 'needed', label: 'Still Needed', count: totals.total - totals.done }] : []),
  ]

  return (
    <PagePanel>
      <div className="slayer-page">
        <header className="slayer-header">
          <div className="collection-title-row">
            <h1 className="slayer-title">Monster Eradication</h1>
            {pageGoals.length > 0 && (
              <div className="collection-page-goals">
                {pageGoals.map(g => <UniversalModalButton key={g.id} item={g} variant="inline" />)}
              </div>
            )}
          </div>
          {hasSaveData && (
            <div className="slayer-score-block">
              <div className="slayer-score-numbers">
                <span className="slayer-score-done">{totals.done}</span>
                <span className="slayer-score-divider">/</span>
                <span className="slayer-score-max">{totals.total}</span>
                <span className="slayer-score-label">goals met</span>
              </div>
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="slayer-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track your kill counts toward each goal.
          </button>
        )}

        <div className="slayer-filter-toggle" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`slayer-filter-btn ${filter === tab.id ? 'slayer-filter-btn--active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className="slayer-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="slayer-cards">
          {displayed.map(q => (
            <QuestGroupCard
              key={q.id}
              group={q}
              kills={hasSaveData ? q.kills : null}
              done={hasSaveData && q.done}
            />
          ))}
        </div>
      </div>
    </PagePanel>
  )
}

export default SlayerPage

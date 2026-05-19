import { useMemo } from 'react'
import PagePanel from '../common/PagePanel'
import { useProgress } from '../../hooks/UseProgress'
import upgradeRules from '../../../data/rules/farmhouse-upgrades.json'
import './FarmhousePage.css'

function formatGold(n) {
  return n.toLocaleString() + 'g'
}

function MaterialPill({ gameId, name, count, owned }) {
  const enough = owned != null && owned >= count
  const pillClass = owned == null ? '' : enough ? 'fh-material-pill--met' : 'fh-material-pill--short'
  return (
    <span className={`fh-material-pill ${pillClass}`}>
      <span className="fh-material-name">{name}</span>
      <span className="fh-material-count">
        {owned != null ? `${owned.toLocaleString()} / ${count.toLocaleString()}` : count.toLocaleString()}
      </span>
    </span>
  )
}

function UpgradeCard({ upgrade, status, currentMoney, getOwnedCount, hasSaveData }) {
  const goldMet = hasSaveData ? currentMoney >= upgrade.goldCost : null
  const materialsMet = hasSaveData
    ? upgrade.materials.every(m => getOwnedCount(m.gameId) >= m.count)
    : null
  const allMet = hasSaveData ? (goldMet && materialsMet) : null

  const cardClass = [
    'fh-card',
    status === 'done' ? 'fh-card--done' :
    status === 'available' ? (allMet ? 'fh-card--available' : 'fh-card--unlocked') :
    'fh-card--locked',
  ].join(' ')

  const badge = status === 'done' ? 'Complete'
    : !hasSaveData ? null
    : allMet ? 'Available'
    : status === 'available' ? 'Can\'t Afford'
    : 'Locked'

  const badgeClass = status === 'done' ? 'fh-badge--done'
    : allMet ? 'fh-badge--available'
    : status === 'available' ? 'fh-badge--unaffordable'
    : 'fh-badge--locked'

  return (
    <div className={cardClass}>
      <div className="fh-card-header">
        <h3 className="fh-card-name">{upgrade.name}</h3>
        {badge && <span className={`fh-badge ${badgeClass}`}>{badge}</span>}
      </div>
      <p className="fh-card-desc">{upgrade.description}</p>
      <div className="fh-card-costs">
        {upgrade.goldCost > 0 && (
          <span className={`fh-gold-cost ${hasSaveData ? (goldMet ? 'fh-gold-cost--met' : 'fh-gold-cost--short') : ''}`}>
            {formatGold(upgrade.goldCost)}
          </span>
        )}
        {upgrade.materials.map(m => (
          <MaterialPill
            key={m.gameId}
            gameId={m.gameId}
            name={m.name}
            count={m.count}
            owned={hasSaveData ? getOwnedCount(m.gameId) : null}
          />
        ))}
        {upgrade.daysToComplete > 0 && (
          <span className="fh-days">{upgrade.daysToComplete} days</span>
        )}
      </div>
    </div>
  )
}

function RenovationCard({ renovation, status, currentMoney, hasSaveData }) {
  const goldMet = hasSaveData && renovation.goldCost > 0 ? currentMoney >= renovation.goldCost : true
  const allMet = goldMet

  const cardClass = [
    'fh-card',
    status === 'done' ? 'fh-card--done' :
    status === 'available' ? (allMet ? 'fh-card--available' : 'fh-card--unlocked') :
    'fh-card--locked',
  ].join(' ')

  const badge = status === 'done' ? 'Complete'
    : !hasSaveData ? null
    : status === 'locked' ? 'Locked'
    : allMet ? 'Available'
    : 'Can\'t Afford'

  const badgeClass = status === 'done' ? 'fh-badge--done'
    : status === 'locked' ? 'fh-badge--locked'
    : allMet ? 'fh-badge--available'
    : 'fh-badge--unaffordable'

  return (
    <div className={cardClass}>
      <div className="fh-card-header">
        <h3 className="fh-card-name">{renovation.name}</h3>
        {badge && <span className={`fh-badge ${badgeClass}`}>{badge}</span>}
      </div>
      <p className="fh-card-desc">{renovation.description}</p>
      <div className="fh-card-costs">
        {renovation.goldCost > 0 && (
          <span className={`fh-gold-cost ${hasSaveData ? (goldMet ? 'fh-gold-cost--met' : 'fh-gold-cost--short') : ''}`}>
            {formatGold(renovation.goldCost)}
          </span>
        )}
        {renovation.goldCost === 0 && (
          <span className="fh-gold-free">Free</span>
        )}
        {renovation.note && (
          <span className="fh-reno-note">{renovation.note}</span>
        )}
      </div>
    </div>
  )
}

function FarmhousePage() {
  const progress = useProgress()
  const { hasSaveData, currentMoney, houseUpgradeLevel, getOwnedCount } = progress

  const houseLevel = hasSaveData ? houseUpgradeLevel : null

  const { upgrades, renovations, upgradeStats } = useMemo(() => {
    const resolvedUpgrades = upgradeRules.upgrades.map(u => {
      let status = 'locked'
      if (houseLevel != null) {
        if (houseLevel >= u.grantsUpgradeLevel) status = 'done'
        else if (houseLevel >= u.requiredUpgradeLevel) status = 'available'
      }
      return { ...u, status }
    })

    const renovationsUnlocked = houseLevel != null && houseLevel >= 2
    const resolvedRenovations = upgradeRules.renovations.map(r => {
      let status = 'locked'
      if (renovationsUnlocked) {
        const prereqsMet = !r.requiredMailFlags || r.requiredMailFlags.every(f => progress.hasMailFlag(f))
        if (r.cribKey) {
          // Crib is a special toggle — no mail flag to check
          status = 'available'
        } else if (r.mailFlag && progress.hasMailFlag(r.mailFlag)) {
          status = 'done'
        } else if (prereqsMet) {
          status = 'available'
        } else {
          status = 'locked'
        }
      }
      return { ...r, status }
    })

    const doneCnt = resolvedUpgrades.filter(u => u.status === 'done').length
    const renosDone = resolvedRenovations.filter(r => r.status === 'done').length

    return {
      upgrades: resolvedUpgrades,
      renovations: resolvedRenovations,
      upgradeStats: { upgradesDone: doneCnt, renosDone, renosTotal: resolvedRenovations.filter(r => r.cribKey == null).length },
    }
  }, [houseLevel, progress])

  return (
    <PagePanel>
      <div className="fh-page">
        <header className="fh-header">
          <h1 className="fh-title">Farmhouse</h1>
          {hasSaveData && (
            <div className="fh-score-block">
              <div className="fh-score-row">
                <span className="fh-score-label">Upgrades</span>
                <span className="fh-score-value">
                  {upgradeStats.upgradesDone} / {upgrades.length}
                </span>
              </div>
              <div className="fh-score-row">
                <span className="fh-score-label">Renovations</span>
                <span className="fh-score-value">
                  {upgradeStats.renosDone} / {upgradeStats.renosTotal}
                </span>
              </div>
              <div className="fh-score-row fh-score-row--money">
                <span className="fh-score-label">Current Gold</span>
                <span className="fh-score-value fh-score-gold">{formatGold(currentMoney)}</span>
              </div>
            </div>
          )}
        </header>

        {!hasSaveData && (
          <button
            type="button"
            className="fh-upload-nudge"
            onClick={() => window.dispatchEvent(new Event('open-character-bar'))}
          >
            Upload your save file to track upgrade and renovation progress.
          </button>
        )}

        <section className="fh-section">
          <h2 className="fh-section-title">Upgrades</h2>
          <p className="fh-section-note">Purchased from Robin at the Carpenter Shop. Each takes 3 days to complete.</p>
          <div className="fh-card-list">
            {upgrades.map(u => (
              <UpgradeCard
                key={u.id}
                upgrade={u}
                status={u.status}
                currentMoney={currentMoney}
                getOwnedCount={getOwnedCount}
                hasSaveData={hasSaveData}
              />
            ))}
          </div>
        </section>

        <section className="fh-section">
          <h2 className="fh-section-title">Renovations</h2>
          <p className="fh-section-note">
            Available from Robin after the second house upgrade. Renovations add or modify rooms in the farmhouse.
            {hasSaveData && houseLevel != null && houseLevel < 2 && (
              <span className="fh-section-locked-note"> Requires the second house upgrade to unlock.</span>
            )}
          </p>
          <div className="fh-card-list">
            {renovations.filter(r => r.cribKey == null).map(r => (
              <RenovationCard
                key={r.id}
                renovation={r}
                status={r.status}
                currentMoney={currentMoney}
                hasSaveData={hasSaveData}
              />
            ))}
          </div>
        </section>
      </div>
    </PagePanel>
  )
}

export default FarmhousePage

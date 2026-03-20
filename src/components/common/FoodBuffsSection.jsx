import ModalSection from './ModalSection'

const ATTR_LABELS = {
  FarmingLevel:   'Farming',
  FishingLevel:   'Fishing',
  MiningLevel:    'Mining',
  ForagingLevel:  'Foraging',
  LuckLevel:      'Luck',
  CombatLevel:    'Combat',
  MaxStamina:     'Max Energy',
  Speed:          'Speed',
  Defense:        'Defense',
  Attack:         'Attack',
  MagneticRadius: 'Magnetism',
  Immunity:       'Immunity',
}

// Attribute → icon filename in /assets/buffs/
const ATTR_ICONS = {
  FarmingLevel:   'Farming',
  FishingLevel:   'Fishing',
  MiningLevel:    'Mining',
  ForagingLevel:  'Foraging',
  LuckLevel:      'Luck',
  CombatLevel:    'Combat',
  MaxStamina:     'MaxEnergy',
  Speed:          'Speed',
  Defense:        'Defense',
  Attack:         'Attack',
  MagneticRadius: 'Magnetism',
}

// Named buff → icon filename in /assets/buffs/
const NAMED_BUFF_ICONS = {
  'Tipsy':             'Tipsy',
  'Burnt':             'Burnt',
  'Slimed':            'Slimed',
  'Jinxed':            'Jinxed',
  'Frozen':            'Frozen',
  'Spooked':           'Attack',   // no dedicated wiki icon; Attack debuff
  'Warrior Energy':    'WarriorEnergy',
  "Yoba's Blessing":   'YobasBlessing',
  'Adrenaline Rush':   'AdrenalineRush',
  'Oil of Garlic':     'OilOfGarlic',
  'Monster Musk':      'MonsterMusk',
  'Squid Ink Ravioli': 'SquidInkRavioli',
  'Nauseated':         'Nauseated',
  'Darkness':          'Darkness',
  'Weakness':          'Weakness',
}

export function BuffIcon({ file, alt, size = 16 }) {
  if (!file) return null
  return (
    <img
      src={`/assets/buffs/${file}.png`}
      alt={alt}
      width={size}
      height={size}
      className="buff-icon"
    />
  )
}

export function formatDuration(seconds) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}

function FoodBuffsSection({ entity, findById, onNavigate }) {
  if (!entity?.buffs?.length) return null

  const meaningfulBuffs = entity.buffs.filter(b => b.effects || b.name)
  if (meaningfulBuffs.length === 0) return null

  return (
    <ModalSection id="section-buffs" title="Effects" navLabel="Effects">
      <div className="food-buffs">
        {meaningfulBuffs.map((buff, i) => {
          const namedIcon = buff.name ? NAMED_BUFF_ICONS[buff.name] : null
          const hasEffectChips = buff.effects && Object.values(buff.effects).some(v => v !== 0)
          const buffEntity = buff.buffId && findById ? findById(buff.buffId) : null

          return (
            <div key={i} className={`food-buff-entry${buff.isDebuff ? ' food-buff--debuff' : ''}`}>
              {buff.name && (
                <span className="food-buff-name">
                  {namedIcon && <BuffIcon file={namedIcon} alt={buff.name} size={16} />}
                  {buffEntity && onNavigate ? (
                    <button
                      className="breadcrumb-link"
                      onClick={() => onNavigate(buffEntity)}
                      type="button"
                    >
                      {buff.name}
                    </button>
                  ) : (
                    buff.name
                  )}
                </span>
              )}
              <div className="food-buff-body">
                {hasEffectChips && (
                  <div className="food-buff-effects">
                    {Object.entries(buff.effects)
                      .filter(([, val]) => val !== 0)
                      .map(([attr, val]) => (
                        <span key={attr} className={`food-buff-effect${val < 0 ? ' negative' : ''}`}>
                          <BuffIcon file={ATTR_ICONS[attr]} alt={ATTR_LABELS[attr] || attr} size={14} />
                          <span className="food-buff-attr">{ATTR_LABELS[attr] || attr}</span>
                          <span className="food-buff-val">{val > 0 ? `+${val}` : val}</span>
                        </span>
                      ))}
                  </div>
                )}
                {buff.duration > 0 && (
                  <span className="food-buff-duration">{formatDuration(buff.duration)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ModalSection>
  )
}

export default FoodBuffsSection

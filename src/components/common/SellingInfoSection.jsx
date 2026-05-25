import { useState, useEffect } from 'react'
import ModalSection from './ModalSection'
import ModalNote from './ModalNote'
import UniversalModalButton from './UniversalModalButton'
import QualitySelector from './QualitySelector'
import InfoTooltip from './InfoTooltip'
import { calculateProfessionMultiplier } from './ItemSellPrice'
import { usePlayer } from '../../contexts/PlayerContext'
import { getTrashCanRefund, getProfitColor, formatPrice } from '../../utils/Formatters'

function getSellingLocations(entity, findById) {
  return (entity.sellingLocations || []).map(id => {
    const store = findById(id)
    return store || { id, name: id }
  })
}

// Profession definitions keyed by professionCategory (matches profession-rules.json)
const PROFESSION_DEFS = {
  crop:       [{ key: 'tiller', label: 'Tiller', bonus: '+10%', replaces: null }],
  fishing:    [{ key: 'fisher', label: 'Fisher', bonus: '+25%', replaces: null },
               { key: 'angler', label: 'Angler', bonus: '+50%', replaces: 'Fisher' }],
  artisan:    [{ key: 'artisan', label: 'Artisan', bonus: '+40%', replaces: null }],
  rancher:    [{ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null }],
  tapper:     [{ key: 'tapper', label: 'Tapper', bonus: '+25%', replaces: null }],
  blacksmith: [{ key: 'blacksmith', label: 'Blacksmith', bonus: '+50%', replaces: null }],
  gemologist: [{ key: 'gemologist', label: 'Gemologist', bonus: '+30%', replaces: null }],
}

// Input category → professionCategory for profit analysis (input items affect which professions show)
const INPUT_CATEGORY_PROFESSIONS = {
  '-4': 'fishing',
  '-5': 'rancher', '-6': 'rancher',
  '-75': 'crop', '-79': 'crop',
}

function getAvailableProfessions(entity, artisanItems) {
  const professions = []
  const professionKeys = new Set()

  function addProfession(profCat) {
    const defs = PROFESSION_DEFS[profCat]
    if (!defs) return
    for (const def of defs) {
      if (!professionKeys.has(def.key)) {
        professions.push(def)
        professionKeys.add(def.key)
      }
    }
  }

  // Primary profession from pre-computed field
  if (entity.professionCategory) {
    addProfession(entity.professionCategory)
  }

  // Input-based professions (for items that are processed into artisan goods)
  const machineSource = entity.sources?.find(s => s.type === 'machine')
  const inputCategories = new Set()
  if (machineSource?.inputDetails?.length > 0) {
    machineSource.inputDetails.forEach(i => { if (i.inputGameCategory) inputCategories.add(i.inputGameCategory) })
  } else if (machineSource?.inputGameCategory) {
    inputCategories.add(machineSource.inputGameCategory)
  }

  for (const cat of inputCategories) {
    const profCat = INPUT_CATEGORY_PROFESSIONS[String(cat)]
    if (profCat) addProfession(profCat)
  }

  // Output-based professions (for items that can be turned into artisan goods)
  if (artisanItems.length > 0) {
    for (const artisan of artisanItems) {
      const artisanSrc = artisan.sources?.find(s => s.type === 'machine')
      if (artisanSrc?.inputDetails?.some(d => d.inputId === entity.id)) {
        if (artisan.professionCategory) {
          addProfession(artisan.professionCategory)
        }
      }
    }
  }

  return professions
}

function ProfitAnalysis({ entity, inputDetails, activeProfessions, inputQuality, setInputQuality, showTrashRefund, findById, onNavigate }) {
  if (!inputDetails || inputDetails.length === 0) return null
  if (showTrashRefund) return null

  const baseOutputPrice = entity.prices?.regular || entity.price || 0
  const qualityMultipliers = { regular: 1.0, silver: 1.25, gold: 1.5, iridium: 2.0 }
  const inputMultiplier = qualityMultipliers[inputQuality]
  const outputProfessionMultiplier = calculateProfessionMultiplier(entity, activeProfessions)
  return (
    <div className="profit-section">
      <div className="profit-header">
        <div className="modal-label">Processed From:</div>
        <InfoTooltip text="Shows the cost of each source item at the selected quality vs. the profit from selling this item at each quality tier. Professions affect both source and output prices." />
      </div>

      <div className="profit-source-selector">
        <span className="profit-source-name">Source</span>
        <QualitySelector
          value={inputQuality}
          onChange={setInputQuality}
          name="inputQuality"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {inputDetails.map((input, idx) => {
          const baseInputPrice = input.inputBasePrice
          const inputProfessionMultiplier = calculateProfessionMultiplier({ gameCategory: input.inputGameCategory }, activeProfessions)
          const adjustedInputPrice = Math.floor(baseInputPrice * inputMultiplier * inputProfessionMultiplier)

          const regularOutputPrice = Math.floor(baseOutputPrice * outputProfessionMultiplier)
          const silverOutputPrice = Math.floor(baseOutputPrice * 1.25 * outputProfessionMultiplier)
          const goldOutputPrice = Math.floor(baseOutputPrice * 1.5 * outputProfessionMultiplier)
          const iridiumOutputPrice = Math.floor(baseOutputPrice * 2.0 * outputProfessionMultiplier)

          const regularProfit = adjustedInputPrice > 0 ? Math.round(((regularOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
          const silverProfit = adjustedInputPrice > 0 ? Math.round(((silverOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
          const goldProfit = adjustedInputPrice > 0 ? Math.round(((goldOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
          const iridiumProfit = adjustedInputPrice > 0 ? Math.round(((iridiumOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0

          return (
            <div key={idx} className="processing-row processing-row--input">
              <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                <UniversalModalButton
                  item={findById(input.inputId)}
                  variant="inline"
                  onNavigate={onNavigate}
                />
              </div>

              <div className="price-display" style={{
                color: inputQuality === 'regular' ? '#666' :
                       inputQuality === 'silver' ? '#9e9e9e' :
                       inputQuality === 'gold' ? '#f57c00' : '#9c27b0'
              }}>
                {formatPrice(adjustedInputPrice)}
              </div>

              <div className="quality-tiers">
                <div className="quality-tier">
                  <span className="quality-symbol quality-symbol--regular">●</span>
                  <span style={{ color: getProfitColor(regularProfit) }}>
                    {regularProfit >= 0 ? '+' : ''}{regularProfit}%
                  </span>
                </div>
                <div className="quality-tier">
                  <span className="quality-symbol quality-symbol--silver">◆</span>
                  <span style={{ color: getProfitColor(silverProfit) }}>
                    {silverProfit >= 0 ? '+' : ''}{silverProfit}%
                  </span>
                </div>
                <div className="quality-tier">
                  <span className="quality-symbol quality-symbol--gold">★</span>
                  <span style={{ color: getProfitColor(goldProfit) }}>
                    {goldProfit >= 0 ? '+' : ''}{goldProfit}%
                  </span>
                </div>
                <div className="quality-tier">
                  <span className="quality-symbol quality-symbol--iridium">◆</span>
                  <span style={{ color: getProfitColor(iridiumProfit) }}>
                    {iridiumProfit >= 0 ? '+' : ''}{iridiumProfit}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OutputProfitAnalysis({ entity, artisanItems, activeProfessions, outputInputQuality, setOutputInputQuality, showTrashRefund, onNavigate }) {
  const actualCategory = entity.originalGameCategory !== undefined
    ? entity.originalGameCategory
    : entity.gameCategory

  const genericInputType = (() => {
    if (actualCategory === -79) return 'fruit'
    if (actualCategory === -75) return 'vegetable'
    if (actualCategory === -4 || entity.type === 'fish') return 'fish'
    if (actualCategory === -80) return 'flower'
    if (entity.contextTags?.includes('edible_mushroom')) return 'mushroom'
    return null
  })()

  const outputs = []
  if (artisanItems.length > 0) {
    artisanItems.forEach(artisan => {
      const artisanMachineSource = artisan.sources?.find(s => s.type === 'machine')
      if (!artisanMachineSource) return

      if (artisanMachineSource.inputDetails) {
        artisanMachineSource.inputDetails.forEach(inputDetail => {
          if (inputDetail.inputId === entity.id) {
            outputs.push({
              outputItem: artisan,
              outputBasePrice: inputDetail.outputPrice || artisan.prices?.regular || artisan.price || 0,
              machineId: artisanMachineSource.id,
              outputQuality: inputDetail.outputQuality ?? null,
              outputCount: inputDetail.outputCount ?? null,
            })
          }
        })
        return
      }

      if (artisanMachineSource.inputId === entity.id) {
        outputs.push({
          outputItem: artisan,
          outputBasePrice: artisan.prices?.regular || artisan.price || 0,
          machine: artisanMachineSource.machine,
        })
        return
      }

      if (!artisanMachineSource.inputId && genericInputType && artisanMachineSource.inputType === genericInputType) {
        if (artisan.isGeneric) {
          outputs.push({
            outputItem: artisan,
            outputBasePrice: null,
            machine: artisanMachineSource.machine,
            isGeneric: true,
          })
        }
      }
    })
  }

  if (outputs.length === 0) return null
  if (showTrashRefund) return null

  const inputBasePrice = entity.prices?.regular || entity.price || 0
  const hasQuality = entity.qualityTiers && entity.qualityTiers.length > 1
  const qualityMultipliers = { regular: 1.0, silver: 1.25, gold: 1.5, iridium: 2.0 }
  const inputMultiplier = hasQuality ? qualityMultipliers[outputInputQuality] : 1.0
  const inputProfessionMultiplier = calculateProfessionMultiplier(entity, activeProfessions)
  const adjustedInputPrice = Math.floor(inputBasePrice * inputMultiplier * inputProfessionMultiplier)

  return (
    <div className="profit-section">
      <div className="profit-header">
        <div className="modal-label">Processing Into:</div>
        <InfoTooltip text="Shows the profit from processing this item into other goods. The price shown is this item's sell value at the selected quality. Percentages compare total output value (all items in the batch) vs selling the input raw." />
      </div>

      <div className="profit-source-selector">
        <span className="profit-source-name">{entity.name}</span>
        {hasQuality && (
          <QualitySelector
            value={outputInputQuality}
            onChange={setOutputInputQuality}
            name="outputInputQuality"
          />
        )}
        <span className="price-display" style={{
          color: !hasQuality ? '#666' :
                 outputInputQuality === 'regular' ? '#666' :
                 outputInputQuality === 'silver' ? '#9e9e9e' :
                 outputInputQuality === 'gold' ? '#f57c00' : '#9c27b0'
        }}>
          {formatPrice(adjustedInputPrice)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {outputs.filter(o => !o.isGeneric).map((output, idx, specificOutputs) => {
          const outputProfessionMultiplier = calculateProfessionMultiplier(output.outputItem, activeProfessions)
          const outputHasQuality = output.outputItem.capabilities?.hasQualityTiers !== false && output.outputQuality == null
          const fixedQualityMultiplier = output.outputQuality === 0 ? 1.0
            : output.outputQuality === 1 ? 1.25
            : output.outputQuality === 2 ? 1.5
            : output.outputQuality === 4 ? 2.0
            : null

          const calcProfit = (multiplier) => {
            const price = Math.floor(output.outputBasePrice * multiplier * outputProfessionMultiplier)
            return adjustedInputPrice > 0 ? Math.round(((price - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
          }
          const profitPct = (pct) => `${pct >= 0 ? '+' : ''}${pct}%`
          const fixedQualitySymbol = output.outputQuality === 1 ? '◆' : output.outputQuality === 2 ? '★' : output.outputQuality === 4 ? '◆' : '●'
          const fixedQualityTier = output.outputQuality === 1 ? 'silver' : output.outputQuality === 2 ? 'gold' : output.outputQuality === 4 ? 'iridium' : 'regular'

          return (
            <div key={idx} className="processing-row processing-row--output">
              <span className="processing-arrow">
                {specificOutputs.length === 1 ? '└→' : idx === specificOutputs.length - 1 ? '└→' : '├→'}
              </span>

              <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <UniversalModalButton
                  item={output.outputItem}
                  variant="inline"
                  onNavigate={onNavigate}
                />
                {output.outputCount > 1 && (
                  <span className="output-count">×{output.outputCount}</span>
                )}
              </div>

              <div className="quality-tiers">
                {outputHasQuality ? (
                  [['●', 'regular', 1.0], ['◆', 'silver', 1.25], ['★', 'gold', 1.5], ['◆', 'iridium', 2.0]].map(([sym, tier, mult]) => {
                    const pct = calcProfit(mult)
                    return (
                      <div key={tier} className="quality-tier">
                        <span className={`quality-symbol quality-symbol--${tier}`}>{sym}</span>
                        <span style={{ color: getProfitColor(pct) }}>{profitPct(pct)}</span>
                      </div>
                    )
                  })
                ) : fixedQualityMultiplier != null ? (
                  <div className="quality-tier">
                    <span className={`quality-symbol quality-symbol--${fixedQualityTier}`}>{fixedQualitySymbol}</span>
                    <span style={{ color: getProfitColor(calcProfit(fixedQualityMultiplier)) }}>{profitPct(calcProfit(fixedQualityMultiplier))}</span>
                  </div>
                ) : (
                  <div className="quality-tier">
                    <span className="quality-symbol quality-symbol--regular">●</span>
                    <span style={{ color: getProfitColor(calcProfit(1.0)) }}>{profitPct(calcProfit(1.0))}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ANIMAL_HEARTS = [0, 1, 2, 3, 4, 5]

function AnimalSellingCalculator({ entity }) {
  const [hearts, setHearts] = useState(5)
  const friendship = hearts * 200
  const multiplier = (friendship / 1000) + 0.3
  const price = Math.floor(entity.sellPrice * multiplier)
  const multiplierDisplay = Math.round(multiplier * 100) / 100

  return (
    <ModalSection id="section-calculator" title="Selling Calculator" navLabel="Calculator">
      <div className="profit-section">
        <div className="calculator-box">
          <div className="calculator-controls">
            <span className="modal-label">Friendship:</span>
            <div style={{ display: 'flex', gap: '0.1rem', alignItems: 'center' }}>
              {ANIMAL_HEARTS.map(h => (
                <label key={h} style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={`animal-hearts-${entity.id}`}
                    value={h}
                    checked={hearts === h}
                    onChange={() => setHearts(h)}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    fontSize: h === 0 ? '0.85rem' : '1.1rem',
                    color: h === 0
                      ? (hearts === 0 ? '#e05c5c' : '#ccc')
                      : (h <= hearts ? '#e05c5c' : '#ccc'),
                    userSelect: 'none',
                    lineHeight: 1,
                  }}>
                    {h === 0 ? '○' : '♥'}
                  </span>
                </label>
              ))}
              <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: '0.4rem' }}>
                {hearts} heart{hearts !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="calculator-results">
            <div className="calculator-prices">
              <span style={{ fontWeight: 600 }}>Sell Price:</span>
              <div>
                <span className="sell-price-value">{price.toLocaleString()}g</span>
              </div>
            </div>
            <div className="calculator-formula">
              {entity.sellPrice.toLocaleString()}g × {multiplierDisplay} = {price.toLocaleString()}g
            </div>
          </div>
        </div>
      </div>
    </ModalSection>
  )
}

function SellingInfoSection({ entity, artisanItems, findById, onNavigate }) {
  const { player } = usePlayer()

  const [activeProfessions, setActiveProfessions] = useState({
    tiller: player.professions.tiller || false,
    fisher: player.professions.fisher || false,
    angler: player.professions.angler || false,
    artisan: player.professions.artisan || false,
    rancher: player.professions.rancher || false,
    tapper: player.professions.tapper || false,
    blacksmith: player.professions.blacksmith || false,
    gemologist: player.professions.gemologist || false
  })
  const [trashCanUpgrade, setTrashCanUpgrade] = useState(() => {
    const locs = getSellingLocations(entity, findById)
    return locs.length === 0 ? 'normal' : null
  })
  const [inputQuality, setInputQuality] = useState('regular')
  const [outputInputQuality, setOutputInputQuality] = useState('regular')

  // Reset state when entity or player changes
  useEffect(() => {
    setActiveProfessions({
      tiller: player.professions.tiller || false,
      fisher: player.professions.fisher || false,
      angler: player.professions.angler || false,
      artisan: player.professions.artisan || false,
      rancher: player.professions.rancher || false,
      tapper: player.professions.tapper || false,
      blacksmith: player.professions.blacksmith || false,
      gemologist: player.professions.gemologist || false
    })
    setInputQuality('regular')
    setOutputInputQuality('regular')
    const locs = getSellingLocations(entity, findById)
    setTrashCanUpgrade(locs.length === 0 ? 'normal' : null)
  }, [entity?.id, player.professions])

  if (!entity) return null
  if (entity.isGeneric) return null
  if (entity.type === 'furniture') return null

  if (entity.type === 'animal') {
    if (!entity.sellPrice) return null
    return <AnimalSellingCalculator entity={entity} />
  }

  const basePrice = entity.prices?.regular || entity.price || 0
  if (basePrice === 0) return null

  const type = entity.type || 'unknown'
  const itemHasQuality = entity.hasQuality !== false &&
    ['fish', 'crop', 'forage', 'tree-fruit', 'animal-product', 'food'].includes(type)
  const iridiumOnlyQuality = type === 'food'

  const sellingLocations = getSellingLocations(entity, findById)
  const trashOnly = sellingLocations.length === 0
  const availableProfessions = getAvailableProfessions(entity, artisanItems)

  const multiplier = calculateProfessionMultiplier(entity, activeProfessions)
  const trashCanRefund = getTrashCanRefund(trashCanUpgrade)
  const showTrashRefund = trashCanUpgrade !== null

  return (
    <ModalSection id="section-calculator" title="Selling Calculator" navLabel="Calculator">
      {/* Selling Locations */}
      {sellingLocations.length > 0 ? (
        <div className="sell-locations">
          <span className="modal-label">Sell At:</span>
          <div className="tag-list tag-list-location">
            {sellingLocations.map((loc) => (
              <UniversalModalButton
                key={loc.id}
                item={loc}
                variant="inline"
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ) : (
        <ModalNote>This item cannot be sold at any shop. It can only be disposed of via trash can.</ModalNote>
      )}

      {/* Price Calculator */}
      <div className="profit-section">
        <div className="calculator-box">
          {/* Profession Checkboxes */}
          {availableProfessions.length > 0 && (
            <div className="calculator-controls">
              <span className="modal-label">Professions:</span>
              {availableProfessions.map(prof => (
                <label key={prof.key} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={activeProfessions[prof.key]}
                    onChange={(e) => {
                      const newState = { ...activeProfessions, [prof.key]: e.target.checked }

                      if (e.target.checked) {
                        if (prof.replaces) {
                          const replacesKey = prof.replaces.toLowerCase()
                          newState[replacesKey] = false
                        }
                        availableProfessions.forEach(p => {
                          if (p.replaces === prof.label) {
                            newState[p.key] = false
                          }
                        })
                      }

                      setActiveProfessions(newState)
                    }}
                  />
                  <span className="profession-name">{prof.label}</span>
                  <span className="profession-bonus">{prof.bonus}</span>
                  {prof.replaces && (
                    <span className="profession-replaces">
                      (replaces {prof.replaces})
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}

          {/* Trash Can Upgrade */}
          <div className="calculator-controls calculator-controls--trash">
            <span className="modal-label">Trash Can:</span>
            {[
              { value: 'normal', label: 'Normal' },
              { value: 'copper', label: 'Copper' },
              { value: 'steel', label: 'Steel' },
              { value: 'gold', label: 'Gold' },
              { value: 'iridium', label: 'Iridium' }
            ].map(option => (
              <label key={option.value} className="checkbox-label">
                <input
                  type={trashOnly ? 'radio' : 'checkbox'}
                  name={trashOnly ? `trash-can-${entity.id}` : undefined}
                  checked={trashCanUpgrade === option.value}
                  onChange={() => {
                    if (trashOnly) {
                      setTrashCanUpgrade(option.value)
                    } else {
                      setTrashCanUpgrade(trashCanUpgrade === option.value ? null : option.value)
                    }
                  }}
                />
                <span className="profession-name">{option.label}</span>
              </label>
            ))}
          </div>

          {/* Calculated Price */}
          <div className="calculator-results">
            <div className="calculator-prices">
              <span style={{ fontWeight: 600 }}>
                {showTrashRefund ? 'Trash Refund:' : 'Sell Price:'}
              </span>

              {showTrashRefund ? (
                <>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                    <span className="sell-price-value sell-price-value--trash">
                      {Math.floor(basePrice * trashCanRefund)}g
                    </span>
                  </div>
                  {iridiumOnlyQuality ? (
                    <div>
                      <span className="quality-symbol quality-symbol--sell quality-symbol--iridium">◆</span>
                      <span className="sell-price-value sell-price-value--trash" style={{ color: '#9c27b0' }}>
                        {Math.floor(basePrice * 2.0 * trashCanRefund)}g
                      </span>
                    </div>
                  ) : itemHasQuality && entity.maxQuality !== 0 ? (
                    <>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
                        <span className="sell-price-value sell-price-value--trash" style={{ color: '#9e9e9e' }}>
                          {Math.floor(basePrice * 1.25 * trashCanRefund)}g
                        </span>
                      </div>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--gold">★</span>
                        <span className="sell-price-value sell-price-value--trash" style={{ color: '#f57c00' }}>
                          {Math.floor(basePrice * 1.5 * trashCanRefund)}g
                        </span>
                      </div>
                      <div>
                        <span className="quality-symbol quality-symbol--sell quality-symbol--iridium">◆</span>
                        <span className="sell-price-value sell-price-value--trash" style={{ color: '#9c27b0' }}>
                          {Math.floor(basePrice * 2.0 * trashCanRefund)}g
                        </span>
                      </div>
                    </>
                  ) : entity.isTrapFish ? (
                    <div>
                      <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
                      <span className="sell-price-value sell-price-value--trash" style={{ color: '#9e9e9e' }}>
                        {Math.floor(basePrice * 1.25 * trashCanRefund)}g
                      </span>
                    </div>
                  ) : null}
                </>
              ) : entity.isTrapFish ? (
                <>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                    <span className="sell-price-value">
                      {Math.floor(basePrice * multiplier)}g
                    </span>
                  </div>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
                    <span className="sell-price-value" style={{ color: '#9e9e9e' }}>
                      {Math.floor(basePrice * 1.25 * multiplier)}g
                    </span>
                  </div>
                </>
              ) : iridiumOnlyQuality ? (
                <>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                    <span className="sell-price-value">
                      {Math.floor(basePrice * multiplier)}g
                    </span>
                  </div>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--iridium">◆</span>
                    <span className="sell-price-value" style={{ color: '#9c27b0' }}>
                      {Math.floor(basePrice * 2.0 * multiplier)}g
                    </span>
                  </div>
                </>
              ) : itemHasQuality && entity.maxQuality !== 0 ? (
                <>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                    <span className="sell-price-value">
                      {Math.floor(basePrice * multiplier)}g
                    </span>
                  </div>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
                    <span className="sell-price-value" style={{ color: '#9e9e9e' }}>
                      {Math.floor(basePrice * 1.25 * multiplier)}g
                    </span>
                  </div>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--gold">★</span>
                    <span className="sell-price-value" style={{ color: '#f57c00' }}>
                      {Math.floor(basePrice * 1.5 * multiplier)}g
                    </span>
                  </div>
                  <div>
                    <span className="quality-symbol quality-symbol--sell quality-symbol--iridium">◆</span>
                    <span className="sell-price-value" style={{ color: '#9c27b0' }}>
                      {Math.floor(basePrice * 2.0 * multiplier)}g
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                  <span className="sell-price-value">
                    {Math.floor(basePrice * multiplier)}g
                  </span>
                </div>
              )}
            </div>

            <div className="calculator-formula">
              {showTrashRefund ? (
                <>Base: {basePrice.toLocaleString()}g × {trashCanRefund * 100}%{(itemHasQuality && entity.maxQuality !== 0) ? ' (per quality tier)' : ''}</>
              ) : multiplier > 1 ? (
                <>
                  Base: {basePrice.toLocaleString()}g × {multiplier} (profession)
                  {(itemHasQuality && entity.maxQuality !== 0 && !iridiumOnlyQuality) && ' (per quality tier)'}
                  {iridiumOnlyQuality && ' (Qi\'s Seasoning for iridium)'}
                </>
              ) : (
                <>Base: {basePrice.toLocaleString()}g</>
              )}
            </div>
          </div>

          {entity.maxQuality === 0 && (
            <ModalNote>
              This crop always harvests at normal quality regardless of Farming level or fertilizer.
            </ModalNote>
          )}

          {/* Profit Analysis for Artisan Items (input quality) */}
          {entity.type === 'artisan' && (() => {
            const src = entity.sources?.find(s => s.type === 'machine')
            const inputDetails = src?.inputDetails || (src?.inputId ? [{
              inputId: src.inputId,
              inputName: src.inputName,
              inputGameId: src.inputGameId,
              inputBasePrice: src.inputBasePrice,
              inputGameCategory: src.inputGameCategory
            }] : null)
            if (!inputDetails) return null
            return (
              <ProfitAnalysis
                entity={entity}
                inputDetails={inputDetails}
                activeProfessions={activeProfessions}
                inputQuality={inputQuality}
                setInputQuality={setInputQuality}
                showTrashRefund={showTrashRefund}
                findById={findById}
                onNavigate={onNavigate}
              />
            )
          })()}

          {/* Output Profit Analysis */}
          <OutputProfitAnalysis
            entity={entity}
            artisanItems={artisanItems}
            activeProfessions={activeProfessions}
            outputInputQuality={outputInputQuality}
            setOutputInputQuality={setOutputInputQuality}
            showTrashRefund={showTrashRefund}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </ModalSection>
  )
}

export default SellingInfoSection

import { useState, useEffect } from 'react'
import ModalSection from './ModalSection'
import ModalNote from './ModalNote'
import ModalItemButton from './ModalItemButton'
import QualitySelector from './QualitySelector'
import InfoTooltip from './InfoTooltip'
import { calculateProfessionMultiplier } from './ItemSellPrice'
import { usePlayer } from '../../contexts/PlayerContext'
import { getTrashCanRefund, getProfitColor, formatPrice } from '../../utils/Formatters'

function getSellingLocations(entity, getStore) {
  return (entity.sellingLocations || []).map(id => {
    const store = getStore(id)
    return store?.name || id
  })
}

function getAvailableProfessions(entity, artisanItems) {
  const professions = []
  const professionKeys = new Set()

  const actualCategory = entity.originalGameCategory !== undefined
    ? entity.originalGameCategory
    : entity.gameCategory

  if (actualCategory === -75 || actualCategory === -79) {
    professions.push({ key: 'tiller', label: 'Tiller', bonus: '+10%', replaces: null })
    professionKeys.add('tiller')
  }

  if (entity.type === 'fish' || actualCategory === -4) {
    professions.push(
      { key: 'fisher', label: 'Fisher', bonus: '+25%', replaces: null },
      { key: 'angler', label: 'Angler', bonus: '+50%', replaces: 'Fisher' }
    )
    professionKeys.add('fisher')
    professionKeys.add('angler')
  }

  if (entity.type === 'artisan') {
    const isAnimalProduct = entity.sources?.some(s => s.type === 'animal')
    const isSyrup = entity.contextTags && entity.contextTags.includes('syrup_item')

    if (isSyrup) {
      professions.push({ key: 'tapper', label: 'Tapper', bonus: '+25%', replaces: null })
      professionKeys.add('tapper')
    } else if (isAnimalProduct) {
      professions.push({ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null })
      professionKeys.add('rancher')
    } else {
      professions.push({ key: 'artisan', label: 'Artisan', bonus: '+40%', replaces: null })
      professionKeys.add('artisan')
    }
  }

  if (entity.gameCategory === 'Bars') {
    professions.push({ key: 'blacksmith', label: 'Blacksmith', bonus: '+50%', replaces: null })
    professionKeys.add('blacksmith')
  }

  if (entity.gameCategory === 'Gems') {
    professions.push({ key: 'gemologist', label: 'Gemologist', bonus: '+30%', replaces: null })
    professionKeys.add('gemologist')
  }

  const inputCategories = new Set()
  const machineSource = entity.sources?.find(s => s.type === 'machine')
  if (machineSource?.inputDetails?.length > 0) {
    machineSource.inputDetails.forEach(i => { if (i.inputGameCategory) inputCategories.add(i.inputGameCategory) })
  } else if (machineSource?.inputGameCategory) {
    inputCategories.add(machineSource.inputGameCategory)
  }

  if (inputCategories.size > 0) {
    if (inputCategories.has(-4) && !professionKeys.has('fisher')) {
      professions.push(
        { key: 'fisher', label: 'Fisher', bonus: '+25%', replaces: null },
        { key: 'angler', label: 'Angler', bonus: '+50%', replaces: 'Fisher' }
      )
      professionKeys.add('fisher')
      professionKeys.add('angler')
    }

    if ((inputCategories.has(-5) || inputCategories.has(-6)) && !professionKeys.has('rancher')) {
      professions.push({ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null })
      professionKeys.add('rancher')
    }

    if ((inputCategories.has(-75) || inputCategories.has(-79)) && !professionKeys.has('tiller')) {
      professions.push({ key: 'tiller', label: 'Tiller', bonus: '+10%', replaces: null })
      professionKeys.add('tiller')
    }
  }

  if (artisanItems.length > 0) {
    artisanItems.forEach(artisan => {
      const artisanSrc = artisan.sources?.find(s => s.type === 'machine')
      if (artisanSrc?.inputDetails) {
        artisanSrc.inputDetails.forEach(inputDetail => {
          if (inputDetail.inputId === entity.id) {
            const isAnimalProduct = artisan.source &&
              ['Cow', 'Goat', 'Chicken', 'Duck', 'Sheep', 'Rabbit', 'Pig', 'Fish Pond'].includes(artisan.source)
            const isSyrup = artisan.contextTags && artisan.contextTags.includes('syrup_item')

            if (isSyrup && !professionKeys.has('tapper')) {
              professions.push({ key: 'tapper', label: 'Tapper', bonus: '+25%', replaces: null })
              professionKeys.add('tapper')
            } else if (isAnimalProduct && !professionKeys.has('rancher')) {
              professions.push({ key: 'rancher', label: 'Rancher', bonus: '+20%', replaces: null })
              professionKeys.add('rancher')
            } else if (!isAnimalProduct && !isSyrup && !professionKeys.has('artisan')) {
              professions.push({ key: 'artisan', label: 'Artisan', bonus: '+40%', replaces: null })
              professionKeys.add('artisan')
            }
          }
        })
      }
    })
  }

  return professions
}

function ProfitAnalysis({ entity, inputDetails, activeProfessions, inputQuality, setInputQuality, trashCanUpgrade, findById, onNavigate }) {
  if (!inputDetails || inputDetails.length === 0) return null
  if (trashCanUpgrade !== null) return null

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
                <ModalItemButton
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

function OutputProfitAnalysis({ entity, artisanItems, activeProfessions, outputInputQuality, setOutputInputQuality, trashCanUpgrade, onNavigate }) {
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
              machine: artisanMachineSource.machine,
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
  if (trashCanUpgrade !== null) return null

  const inputBasePrice = entity.prices?.regular || entity.price || 0
  const qualityMultipliers = { regular: 1.0, silver: 1.25, gold: 1.5, iridium: 2.0 }
  const inputMultiplier = qualityMultipliers[outputInputQuality]
  const inputProfessionMultiplier = calculateProfessionMultiplier(entity, activeProfessions)
  const adjustedInputPrice = Math.floor(inputBasePrice * inputMultiplier * inputProfessionMultiplier)

  return (
    <div className="profit-section">
      <div className="profit-header">
        <div className="modal-label">Processing Into:</div>
        <InfoTooltip text="Shows the profit from processing this item into other goods. The price shown is this item's sell value at the selected quality. Percentages show profit at each output quality tier." />
      </div>

      <div className="profit-source-selector">
        <span className="profit-source-name">{entity.name}</span>
        <QualitySelector
          value={outputInputQuality}
          onChange={setOutputInputQuality}
          name="outputInputQuality"
        />
        <span className="price-display" style={{
          color: outputInputQuality === 'regular' ? '#666' :
                 outputInputQuality === 'silver' ? '#9e9e9e' :
                 outputInputQuality === 'gold' ? '#f57c00' : '#9c27b0'
        }}>
          {formatPrice(adjustedInputPrice)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {outputs.filter(o => !o.isGeneric).map((output, idx, specificOutputs) => {
          const outputProfessionMultiplier = calculateProfessionMultiplier(output.outputItem, activeProfessions)

          const regularOutputPrice = Math.floor(output.outputBasePrice * outputProfessionMultiplier)
          const silverOutputPrice = Math.floor(output.outputBasePrice * 1.25 * outputProfessionMultiplier)
          const goldOutputPrice = Math.floor(output.outputBasePrice * 1.5 * outputProfessionMultiplier)
          const iridiumOutputPrice = Math.floor(output.outputBasePrice * 2.0 * outputProfessionMultiplier)

          const regularProfit = adjustedInputPrice > 0 ? Math.round(((regularOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
          const silverProfit = adjustedInputPrice > 0 ? Math.round(((silverOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
          const goldProfit = adjustedInputPrice > 0 ? Math.round(((goldOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0
          const iridiumProfit = adjustedInputPrice > 0 ? Math.round(((iridiumOutputPrice - adjustedInputPrice) / adjustedInputPrice) * 100) : 0

          return (
            <div key={idx} className="processing-row processing-row--output">
              <span className="processing-arrow">
                {specificOutputs.length === 1 ? '└→' : idx === specificOutputs.length - 1 ? '└→' : '├→'}
              </span>

              <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
                <ModalItemButton
                  item={output.outputItem}
                  variant="inline"
                  onNavigate={onNavigate}
                />
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

function SellingInfoSection({ entity, artisanItems, findById, getStore, onNavigate }) {
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
  const [trashCanUpgrade, setTrashCanUpgrade] = useState(null)
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
    setTrashCanUpgrade(null)
  }, [entity?.id, player.professions])

  if (!entity) return null
  if (entity.isGeneric) return null
  if (entity.category === 'furniture') return null

  const basePrice = entity.prices?.regular || entity.price || 0
  if (basePrice === 0) return null

  const type = entity.type || 'unknown'
  const itemHasQuality = entity.hasQuality !== false &&
    ['fish', 'crop', 'forage', 'tree-fruit', 'animal-product'].includes(type)

  const sellingLocations = getSellingLocations(entity, getStore)
  const availableProfessions = getAvailableProfessions(entity, artisanItems)

  const multiplier = calculateProfessionMultiplier(entity, activeProfessions)
  const trashCanRefund = getTrashCanRefund(trashCanUpgrade)

  return (
    <ModalSection id="section-calculator" title="Selling Calculator">
      {/* Selling Locations */}
      {sellingLocations.length > 0 && (
        <div className="sell-locations">
          <span className="modal-label">Sell At:</span>
          <div className="tag-list tag-list-location">
            {sellingLocations.map((loc, i) => (
              <span key={i} className="tag">{loc}</span>
            ))}
          </div>
        </div>
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

          {/* Trash Can Upgrade Checkboxes */}
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
                  type="checkbox"
                  checked={trashCanUpgrade === option.value}
                  onChange={() => setTrashCanUpgrade(trashCanUpgrade === option.value ? null : option.value)}
                />
                <span className="profession-name">{option.label}</span>
              </label>
            ))}
          </div>

          {/* Calculated Price */}
          <div className="calculator-results">
            <div className="calculator-prices">
              <span style={{ fontWeight: 600 }}>
                {trashCanUpgrade !== null ? 'Trash Refund:' : 'Sell Price:'}
              </span>

              {trashCanUpgrade !== null ? (
                <div>
                  <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
                  <span className="sell-price-value sell-price-value--trash">
                    {Math.floor(basePrice * trashCanRefund)}g
                  </span>
                </div>
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
              {trashCanUpgrade !== null ? (
                <>Base: {basePrice}g × {trashCanRefund * 100}% (trash refund)</>
              ) : multiplier > 1 ? (
                <>
                  Base: {basePrice}g × {multiplier} (profession)
                  {(itemHasQuality && entity.maxQuality !== 0) && ' (per quality tier)'}
                </>
              ) : (
                <>Base: {basePrice}g</>
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
                trashCanUpgrade={trashCanUpgrade}
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
            trashCanUpgrade={trashCanUpgrade}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </ModalSection>
  )
}

export default SellingInfoSection

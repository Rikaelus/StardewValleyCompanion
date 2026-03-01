import ModalSection from './ModalSection'
import { ModalGrid, ModalGridItem } from './ModalGrid'
import ModalItemButton from './ModalItemButton'
import SeasonBadges from './SeasonBadges'
import ShopSourceList from './ShopSourceList'
import { formatTime, formatProcessingTime } from '../../utils/Formatters'
import ConditionBadge from './ConditionBadge'

function LocationAvailabilitySection({ entity, findById, findByGameId, getStore, getMachine, onNavigate, eventNames }) {
  if (!entity) return null

  const hasSeasons = entity.seasons && entity.seasons.length > 0
  const hasTimes = entity.times && entity.times.length > 0
  const hasWeather = entity.weather

  const isSeed = entity.type === 'seed'
  const allSources = entity.sources || []
  const shopSources = allSources.filter(s => s.type === 'shop').sort((a, b) => (a.storeName ?? '').localeCompare(b.storeName ?? ''))
  const monsterDropSources = allSources.filter(s => s.type === 'monster-drop')
  const fishPondSources = allSources.filter(s => s.type === 'fish-pond')
  const tillingSources = allSources.filter(s => s.type === 'tilling')
  const craftingSources = allSources.filter(s => s.type === 'crafting')
  const cookingSources = allSources.filter(s => s.type === 'cooking')
  const animalSources = allSources.filter(s => s.type === 'animal')
  const tapperSources = allSources.filter(s => s.type === 'tapper')
  const machineSources = allSources.filter(s => s.type === 'machine').sort((a, b) => (a.machine ?? '').localeCompare(b.machine ?? ''))
  const seedSources = allSources.filter(s => s.type === 'seed')
  const fishSources = allSources.filter(s => s.type === 'fish')
  const forageSources = allSources.filter(s => s.type === 'forage')
  const otherSources = allSources.filter(s => s.type === 'other')
  const mailSources = allSources.filter(s => s.type === 'mail')
  // Sources with no type (freeform description + optional condition — e.g. ??? hat)
  const freeformSources = allSources.filter(s => !s.type && s.description)
  const hasBuyingInfo = shopSources.length > 0
  const hasOtherSources = monsterDropSources.length > 0 || fishPondSources.length > 0 ||
    tillingSources.length > 0 || craftingSources.length > 0 || cookingSources.length > 0 ||
    animalSources.length > 0 || tapperSources.length > 0 || machineSources.length > 0 ||
    seedSources.length > 0 || fishSources.length > 0 || forageSources.length > 0 ||
    otherSources.length > 0 || mailSources.length > 0 || freeformSources.length > 0

  if (!(hasSeasons && !isSeed) && !hasTimes && !hasWeather && !hasBuyingInfo && !hasOtherSources) return null

  return (
    <ModalSection id="section-location" title="Location & Availability">
      {(hasSeasons && !isSeed && !fishSources.length && !forageSources.length ||
        hasTimes || hasWeather || entity.isFlower) && (
        <ModalGrid>
          {hasSeasons && !isSeed && !fishSources.length && !forageSources.length && (
            <ModalGridItem label="Seasons:">
              <SeasonBadges seasons={entity.seasons} />
            </ModalGridItem>
          )}

          {hasTimes && (
            <ModalGridItem
              label="Time:"
              value={entity.times.map(t => `${formatTime(t.start)}-${formatTime(t.end)}`).join(', ')}
            />
          )}

          {hasWeather && (
            <ModalGridItem label="Weather:">
              <span className="value">
                {entity.weather === 'rainy' ? '🌧 Rainy' : entity.weather === 'sunny' ? '☀️ Sunny' : 'Any'}
              </span>
            </ModalGridItem>
          )}

          {entity.isFlower && (
            <ModalGridItem
              label="Type:"
              value="🌸 Flower"
            />
          )}
        </ModalGrid>
      )}

      {shopSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Where to Buy:</span>
          <ShopSourceList
            sources={entity.sources}
            findEntity={findByGameId}
            findEntityById={findById}
            getStore={getStore}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {tillingSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Tilling / Digging:</span>
          <div className="source-list">
            {tillingSources.map((src, i) => (
              <span key={i} className="source-entry">
                <span className="source-name">{src.location}</span>
                <span />
                <span className="source-detail">{Math.round(src.chance * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {fishPondSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Fish Pond:</span>
          <div className="source-list">
            {fishPondSources.map((src, i) => (
              <span key={i} className="source-entry">
                <span className="source-name" style={{ textTransform: 'capitalize' }}>{src.fishTag.replace(/_/g, ' ')} pond</span>
                <span className="source-qualifiers"><span className="source-qualifier">Population: {src.minPopulation}+</span></span>
                <span className="source-detail">{Math.round(src.chance * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {monsterDropSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Monster Drops:</span>
          <div className="source-list">
            {monsterDropSources.map((src, i) => (
              <span key={i} className="source-entry">
                <span className="source-name">{src.monster}</span>
                <span />
                <span className="source-detail">{Math.round(src.chance * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {craftingSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Crafting:</span>
          <div className="source-list crafting-source-list">
            {craftingSources.map((src, i) => (
              <div key={i} className="crafting-source-entry">
                <span className="source-entry">
                  {src.recipeName && src.recipeName !== entity.name
                    ? <span className="source-name">{src.recipeName}</span>
                    : <span />
                  }
                  {src.unlockCondition && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier crafting-unlock">
                        {src.unlockCondition.type === 'skill' && (
                          `${src.unlockCondition.skill[0].toUpperCase()}${src.unlockCondition.skill.slice(1)} ${src.unlockCondition.level}+`
                        )}
                        {src.unlockCondition.type === 'friendship' && (
                          `${src.unlockCondition.hearts}♥ ${src.unlockCondition.npc}`
                        )}
                        {src.unlockCondition.type === 'level' && (
                          `Level ${src.unlockCondition.level}+`
                        )}
                      </span>
                    </span>
                  )}
                  {src.outputCount > 1 && (
                    <span className="source-detail">×{src.outputCount}</span>
                  )}
                </span>
                {src.ingredientDetails?.length > 0 && src.ingredientDetails.map((ing, j) => {
                  const ingItem = ing.id ? findById(ing.id) : null
                  return (
                    <span key={j} className="source-entry">
                      <span className="source-name">
                        {ingItem ? (
                          <ModalItemButton item={ingItem} variant="inline" onNavigate={onNavigate} />
                        ) : (
                          ing.name || `Item #${ing.gameId}`
                        )}
                      </span>
                      <span />
                      <span className="source-detail">×{ing.amount}</span>
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {cookingSources.length > 0 && (
        <div className="source-group">
          {cookingSources.map((src, i) => (
            <div key={i} className="crafting-source-entry">
              <div className="source-group-header">
                <span className="modal-label">Cooking Recipe:</span>
                {src.unlockCondition && (
                  <span className="source-qualifier crafting-unlock">
                    {src.unlockCondition.type === 'skill' && (
                      `Unlocked: ${src.unlockCondition.skill[0].toUpperCase()}${src.unlockCondition.skill.slice(1)} ${src.unlockCondition.level}+`
                    )}
                    {src.unlockCondition.type === 'friendship' && (
                      `Unlocked: ${src.unlockCondition.hearts}♥ ${src.unlockCondition.npc}`
                    )}
                    {src.unlockCondition.type === 'level' && (
                      `Unlocked: Level ${src.unlockCondition.level}+`
                    )}
                  </span>
                )}
              </div>
              <div className="source-list crafting-source-list">
                {src.ingredientDetails?.length > 0 && src.ingredientDetails.map((ing, j) => {
                  const ingItem = ing.id ? findById(ing.id) : null
                  return (
                    <span key={j} className="source-entry">
                      <span className="source-name">
                        {ingItem ? (
                          <ModalItemButton item={ingItem} variant="inline" onNavigate={onNavigate} />
                        ) : (
                          ing.name || `Item #${ing.gameId}`
                        )}
                      </span>
                      <span />
                      <span className="source-detail">×{ing.amount}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {animalSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Produced By:</span>
          <div className="source-list">
            {animalSources.map((src, i) => (
              <span key={i} className="source-entry">
                <span className="source-name">{src.animal || src.animalName}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {tapperSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Produced By:</span>
          <div className="source-list">
            {tapperSources.map((src, i) => (
              <span key={i} className="source-entry">
                <span className="source-name">Tapper on {src.treeName}</span>
                <span />
                <span className="source-detail">{src.daysToHarvest}d</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {machineSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Produced By:</span>
          <div className="source-list">
            {machineSources.map((src, i) => {
              const inputDetail = src.inputDetails?.[0]
              const inputItemId = src.inputId || inputDetail?.inputId
              const inputItem = inputItemId ? findById(inputItemId) : null
              const inputLabel = inputDetail?.inputName && inputItem && inputDetail.inputName !== inputItem.name
                ? inputDetail.inputName : null
              const inputDisplay = inputItem
                ? <ModalItemButton item={inputItem} variant="inline" label={inputLabel} onNavigate={onNavigate} />
                : src.inputName || inputDetail?.inputName || (src.inputType && src.inputType !== 'specific'
                  ? src.inputType.charAt(0).toUpperCase() + src.inputType.slice(1)
                  : null)
              const machineEntity = src.machineId ? getMachine(src.machineId) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {machineEntity ? (
                      <ModalItemButton item={machineEntity} variant="inline" onNavigate={onNavigate} />
                    ) : (
                      src.machine
                    )}
                  </span>
                  {inputDisplay && <span className="source-qualifiers"><span className="source-qualifier">{inputDisplay}</span></span>}
                  {entity.processingTimeMinutes &&
                    <span className="source-detail">{formatProcessingTime(entity.processingTimeMinutes)}</span>
                  }
                </span>
              )
            })}
          </div>
        </div>
      )}

      {seedSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Grown From:</span>
          <div className="source-list">
            {seedSources.map((src, i) => {
              const seedItem = findById(src.seedId) ?? findByGameId(src.seedGameId)
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {seedItem
                      ? <ModalItemButton item={seedItem} variant="inline" onNavigate={onNavigate} />
                      : src.seedName}
                  </span>
                  <span className="source-qualifiers">
                    <span className="source-qualifier">
                      {src.growthDays}d{src.regrowDays ? ` (+${src.regrowDays}d)` : ''}
                    </span>
                    {seedItem?.seasons?.length > 0 && (
                      <SeasonBadges seasons={seedItem.seasons} compact />
                    )}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {fishSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Caught At:</span>
          <div className="source-list">
            {fishSources.map((src, i) => (
              <span key={i} className="source-entry">
                <span className="source-name">{src.location}</span>
                <span className="source-qualifiers">
                  <SeasonBadges seasons={src.seasons ?? ['spring', 'summer', 'fall', 'winter']} compact />
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {forageSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Foraged At:</span>
          <div className="source-list">
            {forageSources.map((src, i) => {
              const seasons = src.seasons ?? (src.season ? [src.season] : ['spring', 'summer', 'fall', 'winter'])
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">{src.location}</span>
                  <span className="source-qualifiers">
                    <SeasonBadges seasons={seasons} compact />
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {mailSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Mail:</span>
          <div className="source-list">
            {mailSources.map((src, i) => {
              const name = src.sender ? `From ${src.sender}` : src.mailKey
              const specialOrderLabel = src.isSpecialOrder ? 'Special Order Reward' : null
              const stringCondition = typeof src.condition === 'string' ? src.condition : null
              const jsonCondition = src.condition && typeof src.condition === 'object' ? src.condition : null
              if (jsonCondition) {
                return (
                  <ConditionBadge key={i} condition={jsonCondition} eventNames={eventNames}>
                    {(badge, clauseElements, open) => (
                      <>
                        <span className="source-entry">
                          <span className="source-name">{name}</span>
                          <span className="source-qualifiers">
                            {specialOrderLabel && <span className="source-qualifier">{specialOrderLabel}</span>}
                            {badge}
                          </span>
                        </span>
                        {open && (
                          <span className="source-entry source-entry--expanded">
                            <span className="source-expanded-cell">{clauseElements}</span>
                          </span>
                        )}
                      </>
                    )}
                  </ConditionBadge>
                )
              }
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">{name}</span>
                  <span className="source-qualifiers">
                    {specialOrderLabel && <span className="source-qualifier">{specialOrderLabel}</span>}
                    {stringCondition && <span className="source-qualifier">{stringCondition}</span>}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {freeformSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">How to Obtain:</span>
          <div className="source-list">
            {freeformSources.map((src, i) => (
              <ConditionBadge key={i} condition={src.condition} conditionItemNames={src.conditionItemNames} eventNames={eventNames}>
                {(badge, clauseElements, open) => (
                  <>
                    <span className="source-entry">
                      <span className="source-name">{src.description}</span>
                      <span className="source-qualifiers">{badge}</span>
                    </span>
                    {open && (
                      <span className="source-entry source-entry--expanded">
                        <span className="source-expanded-cell">{clauseElements}</span>
                      </span>
                    )}
                  </>
                )}
              </ConditionBadge>
            ))}
          </div>
        </div>
      )}

    </ModalSection>
  )
}

export default LocationAvailabilitySection

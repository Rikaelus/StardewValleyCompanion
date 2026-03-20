import ModalSection from './ModalSection'
import { ModalGrid, ModalGridItem } from './ModalGrid'
import ModalItemButton from './ModalItemButton'
import SeasonBadges from './SeasonBadges'
import ShopSourceList from './ShopSourceList'
import { formatTime, formatProcessingTime, computeDropCountDistribution, formatChance } from '../../utils/Formatters'
import ConditionBadge from './ConditionBadge'
import InfoTooltip from './InfoTooltip'

const FISH_TAG_LABELS = {
  'fish_ocean': 'Any Ocean Fish',
  'fish_freshwater': 'Any Freshwater Fish',
  'fish_river': 'Any River Fish',
  'fish_lake': 'Any Lake Fish',
  'fish_legendary': 'Any Legendary Fish',
  'fish_desert': 'Any Desert Fish',
  'fish_semi_rare': 'Any Semi-Rare Fish',
  'fish_carnivorous': 'Any Carnivorous Fish',
  'category_fish': 'Any Fish',
}

function formatFishTag(tag) {
  if (FISH_TAG_LABELS[tag]) return FISH_TAG_LABELS[tag]
  // item_lava_eel → Lava Eel
  return tag.replace(/^item_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatUnlockCondition(condition) {
  if (!condition) return null
  if (condition.type === 'skill') return `${condition.skill[0].toUpperCase()}${condition.skill.slice(1)} level ${condition.level}+`
  if (condition.type === 'friendship') return `${condition.hearts}♥ ${condition.npc}`
  if (condition.type === 'level') return `Mine level ${condition.level}+`
  return null
}

function LocationAvailabilitySection({ entity, findById, findByGameId, onNavigate }) {
  if (!entity) return null

  const hasSeasons = entity.seasons && entity.seasons.length > 0
  const hasTimes = entity.times && entity.times.length > 0
  const hasWeather = entity.weather
  const hasYearParity = entity.yearParity != null

  const isSeed = entity.type === 'seed'
  const allSources = entity.sources || []
  const shopSources = allSources.filter(s => s.type === 'shop').sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
  const monsterDropSources = allSources.filter(s => s.type === 'monster-drop')
  const fishPondSources = allSources.filter(s => s.type === 'fish-pond')
  const tillingSources = allSources.filter(s => s.type === 'tilling')
  const craftingSources = allSources.filter(s => s.type === 'crafting')
  const cookingSources = allSources.filter(s => s.type === 'cooking')
  const animalSources = allSources.filter(s => s.type === 'animal')
  const hatchSources = allSources.filter(s => s.type === 'hatch')
  const pregnancySources = allSources.filter(s => s.type === 'pregnancy')
  const tapperSources = allSources.filter(s => s.type === 'tapper')
  const machineSources = allSources.filter(s => s.type === 'machine').sort((a, b) => (a.machine ?? '').localeCompare(b.machine ?? ''))
  const seedSources = allSources.filter(s => s.type === 'seed')
  const fishSources = allSources.filter(s => s.type === 'fish')
  const forageSources = allSources.filter(s => s.type === 'forage')
  const breakableDropSources = allSources.filter(s => s.type === 'breakable-drop')
  const tailoringSources = allSources.filter(s => s.type === 'tailoring')
  const geodeSources = allSources.filter(s => s.type === 'geode')
  const otherSources = allSources.filter(s => s.type === 'other')
  const mailSources = allSources.filter(s => s.type === 'mail')
  const rewardSources = allSources.filter(s => s.type === 'reward')
  const craneGameSources = allSources.filter(s => s.type === 'crane-game')
  // Sources with no type (freeform description + optional condition — e.g. ??? hat)
  const freeformSources = allSources.filter(s => !s.type && s.description)
  const hasBuyingInfo = shopSources.length > 0
  const hasOtherSources = monsterDropSources.length > 0 || fishPondSources.length > 0 ||
    tillingSources.length > 0 || craftingSources.length > 0 || cookingSources.length > 0 ||
    animalSources.length > 0 || hatchSources.length > 0 || pregnancySources.length > 0 ||
    tapperSources.length > 0 || machineSources.length > 0 ||
    seedSources.length > 0 || fishSources.length > 0 || forageSources.length > 0 ||
    breakableDropSources.length > 0 || tailoringSources.length > 0 || geodeSources.length > 0 ||
    otherSources.length > 0 || mailSources.length > 0 || rewardSources.length > 0 ||
    craneGameSources.length > 0 || freeformSources.length > 0

  if (!(hasSeasons && !isSeed) && !hasTimes && !hasWeather && !hasYearParity && !hasBuyingInfo && !hasOtherSources) return null

  return (
    <ModalSection id="section-location" title="Location & Availability" navLabel="Location & Availability">
      {(hasSeasons && !isSeed && !fishSources.length && !forageSources.length ||
        hasTimes || hasWeather || hasYearParity || entity.isFlower) && (
        <ModalGrid>
          {hasSeasons && !isSeed && !fishSources.length && !forageSources.length && (
            <ModalGridItem label="Seasons:">
              <SeasonBadges seasons={entity.seasons} />
            </ModalGridItem>
          )}

          {hasYearParity && (
            <ModalGridItem
              label="Year:"
              value={entity.yearParity === 'even' ? 'Even years (2, 4, 6…)' : 'Odd years (1, 3, 5…)'}
            />
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
            onNavigate={onNavigate}
          />
        </div>
      )}

      {tillingSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Tilling / Digging:</span>
          <div className="source-list">
            {tillingSources.map((src, i) => {
              const locEntity = src.locationId ? findById(src.locationId) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {locEntity
                      ? <ModalItemButton item={locEntity} variant="inline" onNavigate={onNavigate} />
                      : src.location}
                  </span>
                  <span />
                  <span className="source-detail">{formatChance(src.chance)}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {fishPondSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Fish Pond:</span>
          <div className="source-list">
            {fishPondSources.map((src, i) => {
              const rolls = src.rolls || [{ chance: src.chance, quantity: 1 }]
              const multiRoll = rolls.length > 1
              return (
                <span key={i} className="source-entry">
                  <span className="source-name source-name--indented">{formatFishTag(src.fishTag)} Pond</span>
                  <span className="source-qualifiers"><span className="source-qualifier">Population: {src.minPopulation}+</span></span>
                  <span className="source-detail">
                    {multiRoll ? (
                      <>
                        {rolls.map(({ chance, quantity }, j) => (
                          <span key={j}>{j > 0 ? ' / ' : ''}×{quantity} {formatChance(chance)}</span>
                        ))}
                        {' '}
                        <InfoTooltip text="Each roll is an independent check. Multiple quantities can drop from the same pond on the same day." />
                      </>
                    ) : (
                      <>{rolls[0].quantity > 1 ? `×${rolls[0].quantity} ` : ''}{formatChance(rolls[0].chance)}</>
                    )}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {monsterDropSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Monster Drops:</span>
          <div className="source-list">
            {monsterDropSources.map((src, i) => {
              const monsterEntity = src.monsterId ? findById(src.monsterId) : null
              const multiRoll = src.rolls?.length > 1
              const dist = multiRoll ? computeDropCountDistribution(src.rolls) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {monsterEntity
                      ? <ModalItemButton item={monsterEntity} variant="inline" onNavigate={onNavigate} />
                      : src.monster}
                  </span>
                  <span />
                  <span className="source-detail">
                    {multiRoll ? (
                      <>
                        {dist.map(({ count, chance }, j) => (
                          <span key={count}>{j > 0 ? ' / ' : ''}×{count} {formatChance(chance)}</span>
                        ))}
                        {' '}
                        <InfoTooltip text="Each roll is independent and fires on every kill. Percentages show the chance of receiving exactly that many." />
                      </>
                    ) : (
                      formatChance(src.rolls?.[0] ?? 0)
                    )}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {breakableDropSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Breakable Containers:</span>
          <div className="source-list">
            {breakableDropSources.map((src, i) => {
              const breakableEntity = src.breakableId ? findById(src.breakableId) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {breakableEntity
                      ? <ModalItemButton item={breakableEntity} variant="inline" onNavigate={onNavigate} />
                      : src.breakableId}
                  </span>
                  <span />
                  {src.chance != null && (
                    <span className="source-detail">{formatChance(src.chance)}</span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {craftingSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Crafting:</span>
          <div className="source-list crafting-source-list">
            {craftingSources.map((src, i) => {
              const unlockText = formatUnlockCondition(src.unlockCondition)
              const showRecipeName = src.recipeName && src.recipeName !== entity.name
              return (
                <div key={i} className="crafting-source-entry">
                  <div className="crafting-meta">
                    {showRecipeName && (
                      <span className="crafting-meta-row">
                        <span className="crafting-meta-label">Recipe</span>
                        <span className="crafting-meta-value">{src.recipeName}</span>
                      </span>
                    )}
                    {src.outputCount > 1 && (
                      <span className="crafting-meta-row">
                        <span className="crafting-meta-label">Yield</span>
                        <span className="crafting-meta-value">×{src.outputCount}</span>
                      </span>
                    )}
                    {unlockText && (
                      <span className="crafting-meta-row">
                        <span className="crafting-meta-label">Unlocked</span>
                        <span className="crafting-meta-value">{unlockText}</span>
                      </span>
                    )}
                  </div>
                  {src.ingredientDetails?.length > 0 && (
                    src.ingredientDetails.map((ing, j) => {
                      const ingItem = (ing.id ? findById(ing.id) : null)
                        ?? (ing.gameId != null ? (findByGameId(`(O)${ing.gameId}`) ?? findByGameId(ing.gameId)) : null)
                      return (
                        <span key={j} className="source-entry source-entry--subrow">
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
                    })
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {cookingSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Cooking Recipe:</span>
          <div className="source-list crafting-source-list">
            {cookingSources.map((src, i) => {
              const unlockText = formatUnlockCondition(src.unlockCondition)
              return (
                <div key={i} className="crafting-source-entry">
                  <div className="crafting-meta">
                    {unlockText && (
                      <span className="crafting-meta-row">
                        <span className="crafting-meta-label">Unlocked</span>
                        <span className="crafting-meta-value">{unlockText}</span>
                      </span>
                    )}
                  </div>
                  {src.ingredientDetails?.length > 0 && (
                    src.ingredientDetails.map((ing, j) => {
                      const ingItem = (ing.id ? findById(ing.id) : null)
                        ?? (ing.gameId != null ? (findByGameId(`(O)${ing.gameId}`) ?? findByGameId(ing.gameId)) : null)
                      return (
                        <span key={j} className="source-entry source-entry--subrow">
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
                    })
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tailoringSources.map((src, i) => (
        <div key={i} className="source-group">
          <span className="modal-label">
            {tailoringSources.length > 1 ? `Tailoring (Recipe ${i + 1}):` : 'Tailoring:'}
          </span>
          <div className="source-list">
            {(src.ingredientDetails || []).map((ing, j) => {
              const ingItem = (ing.id ? findById(ing.id) : null)
                ?? (ing.gameId != null ? (findByGameId(ing.gameId) ?? findByGameId(`(O)${ing.gameId}`)) : null)
              const isTag = ingItem?.type === 'tag'
              return (
                <span key={j} className="source-entry">
                  <span className={`source-name${ingItem ? '' : ' source-name--indented'}`}>
                    {ingItem ? (
                      <ModalItemButton item={ingItem} variant="inline" onNavigate={onNavigate} label={isTag ? ingItem.rawTag : undefined} />
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

      {geodeSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Found In:</span>
          <div className="source-list">
            {geodeSources.map((src, i) => {
              const geodeItem = src.geodeGameId ? (findByGameId(`(O)${src.geodeGameId}`) ?? findByGameId(src.geodeGameId)) : null
              return (
                <span key={i} className="source-entry">
                  <span className={`source-name${geodeItem ? '' : ' source-name--indented'}`}>
                    {geodeItem ? (
                      <ModalItemButton item={geodeItem} variant="inline" onNavigate={onNavigate} />
                    ) : (
                      src.geodeName || `Geode #${src.geodeGameId}`
                    )}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {animalSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Produced By:</span>
          <div className="source-list">
            {animalSources.map((src, i) => {
              const animalEntity = src.id ? findById(src.id) : null
              const freq = animalEntity?.daysToProduce === 1 ? 'daily'
                : animalEntity?.daysToProduce > 1 ? `every ${animalEntity.daysToProduce} days`
                : null
              const toolId = animalEntity?.harvestTool?.toLowerCase().replace(/\s+/g, '-')
              const toolEntity = toolId ? findById(toolId) : null
              return (
                <span key={i} className="source-entry">
                  {animalEntity
                    ? <ModalItemButton item={animalEntity} variant="inline" onNavigate={onNavigate} />
                    : <span className="source-name">{src.id}</span>
                  }
                  {(freq || toolEntity) && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier">
                        {freq}
                        {toolEntity && <> with <ModalItemButton item={toolEntity} variant="inline" onNavigate={onNavigate} /></>}
                      </span>
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {hatchSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Hatched From:</span>
          <div className="source-list">
            {hatchSources.flatMap((src, i) => {
              const incubatorEntity = src.id ? findById(src.id) : null
              return (src.inputDetails || []).map((inputDetail, j) => {
                const inputItem = inputDetail.inputGameId ? findByGameId(inputDetail.inputGameId) : null
                const inputDisplay = inputItem
                  ? <ModalItemButton item={inputItem} variant="inline" onNavigate={onNavigate} />
                  : inputDetail.inputName || null
                return (
                  <span key={`${i}-${j}`} className="source-entry">
                    <span className="source-name">
                      {incubatorEntity
                        ? <ModalItemButton item={incubatorEntity} variant="inline" onNavigate={onNavigate} />
                        : src.id}
                    </span>
                    {(inputDisplay || src.processingTimeMinutes) && (
                      <span className="source-qualifiers">
                        <span className="source-qualifier">
                          {inputDisplay}
                          {src.processingTimeMinutes && <> for {formatProcessingTime(src.processingTimeMinutes)}</>}
                        </span>
                      </span>
                    )}
                  </span>
                )
              })
            })}
          </div>
        </div>
      )}

      {pregnancySources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Also Born From:</span>
          <div className="source-list">
            <span className="source-entry">
              <span className="source-name source-name--indented">Pregnant animals of the same species</span>
            </span>
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
              const machineEntity = src.id ? findById(src.id) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {machineEntity ? (
                      <ModalItemButton item={machineEntity} variant="inline" onNavigate={onNavigate} />
                    ) : (
                      src.id
                    )}
                  </span>
                  {(inputDisplay || src.processingTimeMinutes) && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier">
                        {inputDisplay}
                        {src.processingTimeMinutes && <> for {formatProcessingTime(src.processingTimeMinutes)}</>}
                      </span>
                    </span>
                  )}
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
            {fishSources.map((src, i) => {
              const locEntity = src.locationId ? findById(src.locationId) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {locEntity
                      ? <ModalItemButton item={locEntity} variant="inline" onNavigate={onNavigate} />
                      : src.location}
                  </span>
                  <span className="source-qualifiers">
                    <SeasonBadges seasons={src.seasons ?? ['spring', 'summer', 'fall', 'winter']} compact />
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {forageSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Foraged At:</span>
          <div className="source-list">
            {forageSources.map((src, i) => {
              const seasons = src.seasons ?? (src.season ? [src.season] : ['spring', 'summer', 'fall', 'winter'])
              const locEntity = src.locationId ? findById(src.locationId) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {locEntity
                      ? <ModalItemButton item={locEntity} variant="inline" onNavigate={onNavigate} />
                      : src.location}
                  </span>
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
              const senderVillager = src.sender ? findById(src.sender.toLowerCase()) : null
              const senderNode = src.sender
                ? <>{senderVillager
                    ? <><span style={{ marginRight: '0.25em' }}>From</span><ModalItemButton item={senderVillager} variant="inline" onNavigate={onNavigate} /></>
                    : `From ${src.sender}`
                  }</>
                : src.mailKey
              const specialOrderLabel = src.isSpecialOrder ? 'Special Order Reward' : null
              const stringCondition = typeof src.condition === 'string' ? src.condition : null
              const jsonCondition = src.condition && typeof src.condition === 'object' ? src.condition : null
              if (jsonCondition) {
                return (
                  <ConditionBadge key={i} condition={jsonCondition}>
                    {(badge, clauseElements, open) => (
                      <>
                        <span className="source-entry">
                          <span className="source-name source-name--indented">{senderNode}</span>
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
                  <span className="source-name source-name--indented">{senderNode}</span>
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

      {rewardSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Reward From:</span>
          <div className="source-list">
            {rewardSources.map((src, i) => {
              const rewardLocation = src.id ? findById(src.id) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {rewardLocation
                      ? <ModalItemButton item={rewardLocation} variant="inline" onNavigate={onNavigate} label={src.rewardSourceName} />
                      : src.rewardSourceName
                    }
                  </span>
                  {src.condition && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier">{src.condition}</span>
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {craneGameSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">Crane Game:</span>
          <div className="source-list">
            {craneGameSources.map((src, i) => {
              const movieEntity = src.movieId ? findById(src.movieId) : null
              return (
                <span key={i} className="source-entry">
                  <span className="source-name">
                    {movieEntity
                      ? <ModalItemButton item={movieEntity} variant="inline" onNavigate={onNavigate} />
                      : src.movieName}
                  </span>
                  <span className="source-qualifiers">
                    <span className="source-qualifier">{src.yearParity === 'even' ? 'Even years' : 'Odd years'}</span>
                    {src.rarity > 1 && <span className="source-qualifier">Rare</span>}
                  </span>
                  {src.seasons?.length > 0 && (
                    <span className="source-seasons">
                      <SeasonBadges seasons={src.seasons} compact />
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {otherSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">How to Obtain:</span>
          <div className="source-list">
            {otherSources.map((src, i) => (
              <span key={i} className="source-entry">
                <span className="source-name source-name--indented">{src.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {freeformSources.length > 0 && (
        <div className="source-group">
          <span className="modal-label">How to Obtain:</span>
          <div className="source-list">
            {freeformSources.map((src, i) => (
              <ConditionBadge key={i} condition={src.condition} conditionItemNames={src.conditionItemNames}>
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

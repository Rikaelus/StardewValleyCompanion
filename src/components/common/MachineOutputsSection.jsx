import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'
import { formatProcessingTime } from '../../utils/Formatters'

function MachineOutputsSection({ entity, allItems, findById, onNavigate }) {
  const machineId = entity.id
  const outputItems = allItems.filter(item =>
    !item.isGeneric && item.sources?.some(s => s.id === machineId)
  ).sort((a, b) => a.name.localeCompare(b.name))

  const craftingSources = entity.sources?.filter(s => s.type === 'crafting') || []

  return (
    <>
      {outputItems.length > 0 && (
        <ModalSection id="section-machine-outputs" title={`Produces (${outputItems.length})`}>
          <div className="source-list">
            {outputItems.map(item => {
              const src = item.sources?.find(s => s.id === machineId)
              const inputDetail = src?.inputDetails?.[0]
              const inputItemId = src?.inputId || inputDetail?.inputId
              const inputItem = inputItemId ? findById(inputItemId) : null
              const inputLabel = inputDetail?.inputName && inputItem && inputDetail.inputName !== inputItem.name
                ? inputDetail.inputName : null

              // Animal-specific harvest context
              let harvestToolItem = null
              let harvestFrequency = null
              if (entity.category === 'animal') {
                if (entity.harvestTool) {
                  const toolId = entity.harvestTool.toLowerCase().replace(/\s+/g, '-')
                  harvestToolItem = findById(toolId)
                }
                if (entity.daysToProduce === 1) harvestFrequency = 'daily'
                else if (entity.daysToProduce > 1) harvestFrequency = `every ${entity.daysToProduce} days`
              }

              return (
                <span key={item.id} className="source-entry">
                  <ModalItemButton item={item} variant="inline" onNavigate={onNavigate} />
                  {inputItem && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier">
                        from <ModalItemButton item={inputItem} variant="inline" label={inputLabel} onNavigate={onNavigate} />
                      </span>
                    </span>
                  )}
                  {!inputItem && src?.inputType && src.inputType !== 'specific' && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier">from {src.inputType}</span>
                    </span>
                  )}
                  {(harvestFrequency || harvestToolItem) && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier">
                        {harvestFrequency && `harvestable ${harvestFrequency}`}
                        {harvestToolItem && (
                          <> with <ModalItemButton item={harvestToolItem} variant="inline" onNavigate={onNavigate} /></>
                        )}
                      </span>
                    </span>
                  )}
                  {(src?.processingTimeMinutes || item.processingTimeMinutes) && (
                    <span className="source-detail">{formatProcessingTime(src?.processingTimeMinutes || item.processingTimeMinutes)}</span>
                  )}
                </span>
              )
            })}
          </div>
        </ModalSection>
      )}

      {craftingSources.length > 0 && (
        <ModalSection id="section-machine-crafting" title="How to Craft">
          <div className="source-list crafting-source-list">
            {craftingSources.map((src, i) => (
              <div key={i} className="crafting-source-entry">
                <div className="crafting-source-header">
                  {src.unlockCondition && (
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
                  )}
                </div>
                {src.ingredientDetails?.length > 0 && (
                  <div className="crafting-ingredients">
                    {src.ingredientDetails.map((ing, j) => {
                      const ingItem = ing.id ? findById(ing.id) : null
                      return (
                        <span key={j} className="crafting-ingredient">
                          {ingItem ? (
                            <ModalItemButton item={ingItem} variant="inline" onNavigate={onNavigate} />
                          ) : (
                            <span className="source-name">{ing.name || `Item #${ing.gameId}`}</span>
                          )}
                          <span className="crafting-ingredient-amount">×{ing.amount}</span>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ModalSection>
      )}
    </>
  )
}

export default MachineOutputsSection

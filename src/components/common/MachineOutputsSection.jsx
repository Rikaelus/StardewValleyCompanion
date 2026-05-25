import ModalSection from './ModalSection'
import UniversalModalButton from './UniversalModalButton'
import SeasonBadges from './SeasonBadges'
import { formatProcessingTime } from '../../utils/Formatters'

function MachineOutputsSection({ entity, allItems, findById, onNavigate }) {
  const machineId = entity.id
  const isTapper = machineId === 'tapper' || machineId === 'heavy-tapper'
  const isHeavy = machineId === 'heavy-tapper'

  const outputItems = isTapper
    ? allItems.filter(item =>
        !item.isGeneric && item.sources?.some(s => s.type === 'tapper')
      ).sort((a, b) => a.name.localeCompare(b.name))
    : allItems.filter(item =>
        !item.isGeneric && item.sources?.some(s => s.id === machineId && s.type !== 'shop' && s.type !== 'reward' && s.type !== 'item' && s.type !== 'monster')
      ).sort((a, b) => a.name.localeCompare(b.name))

  // Animal-specific harvest context
  let harvestToolItem = null
  let harvestFrequency = null
  if (entity.type === 'animal') {
    if (entity.harvestTool) {
      const toolId = entity.harvestTool.toLowerCase().replace(/\s+/g, '-')
      harvestToolItem = findById(toolId)
    }
    if (entity.daysToProduce === 1) harvestFrequency = 'daily'
    else if (entity.daysToProduce > 1) harvestFrequency = `every ${entity.daysToProduce} days`
  }

  const totalOutputCount = outputItems.length

  return (
    <>
      {outputItems.length > 0 && (
        <ModalSection id="section-machine-outputs" title={`Produces (${totalOutputCount})`} navLabel="Produces">
          <div className="source-list">
            {outputItems.flatMap(item => {
              // Tapper-specific rendering: show tree as qualifier with days
              if (isTapper) {
                const tapSources = item.sources.filter(s => s.type === 'tapper')
                return tapSources.map((src, idx) => {
                  const treeEntity = src.treeId ? findById(`tree-${src.treeId}`) : null
                  const days = isHeavy && src.daysToHarvest
                    ? Math.ceil(src.daysToHarvest / 2)
                    : src.daysToHarvest
                  return (
                    <span key={`${item.id}-${src.treeId}-${idx}`} className="source-entry">
                      <UniversalModalButton item={item} variant="inline" onNavigate={onNavigate} />
                      <span className="source-qualifiers">
                        {src.note && (
                          <span className="source-qualifier source-condition">{src.note}</span>
                        )}
                        {days && (
                          <span className="source-qualifier">{days}d</span>
                        )}
                        <SeasonBadges seasons={src.seasons || ['spring', 'summer', 'fall', 'winter']} compact />
                      </span>
                      {treeEntity && (
                        <span className="source-detail">
                          from <UniversalModalButton item={treeEntity} variant="inline" onNavigate={onNavigate} />
                        </span>
                      )}
                    </span>
                  )
                })
              }

              const src = item.sources?.find(s => s.id === machineId)
              const processingTime = src?.processingTimeMinutes || item.processingTimeMinutes
              const multipleInputs = src?.inputDetails?.length > 1

              // Header row — always rendered, no qualifier when sub-rows follow
              const headerRow = (
                <span key={item.id} className={`source-entry${multipleInputs ? ' source-entry--subrow' : ''}`}>
                  <span className="source-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {multipleInputs && (
                      <span style={{ color: '#333', userSelect: 'none', fontFamily: 'monospace', lineHeight: 1, fontSize: '1.1rem' }}>┌‣</span>
                    )}
                    <UniversalModalButton item={item} variant="inline" onNavigate={onNavigate} />
                  </span>
                  {!multipleInputs && (() => {
                    const inputDetail = src?.inputDetails?.[0]
                    const inputItemId = src?.inputId || inputDetail?.inputId
                    const inputItem = inputItemId ? findById(inputItemId) : null
                    const inputLabel = inputDetail?.inputName && inputItem && inputDetail.inputName !== inputItem.name
                      ? inputDetail.inputName : null
                    const count = inputDetail?.outputCount || src?.outputCount || 1
                    return (<>
                      {inputItem && (
                        <span className="source-qualifiers">
                          <span className="source-qualifier">
                            {count > 1 && <><span className="output-count" style={{ marginRight: '0.2rem' }}>×{count}</span>{' '}</>}
                            from <UniversalModalButton item={inputItem} variant="inline" label={inputLabel} onNavigate={onNavigate} />
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
                              <> with <UniversalModalButton item={harvestToolItem} variant="inline" onNavigate={onNavigate} /></>
                            )}
                          </span>
                        </span>
                      )}
                      {processingTime && (
                        <span className="source-detail">{formatProcessingTime(processingTime)}</span>
                      )}
                    </>)
                  })()}
                </span>
              )

              if (!multipleInputs) return [headerRow]

              // Sub-rows for each input
              const subRows = src.inputDetails.map((detail, idx) => {
                const isLast = idx === src.inputDetails.length - 1
                const inputItem = detail.inputId ? findById(detail.inputId) : null
                const inputLabel = detail.inputName && inputItem && detail.inputName !== inputItem.name
                  ? detail.inputName : null
                const count = detail.outputCount || 1

                return (
                  <span key={`${item.id}-${detail.inputId || idx}`} className="source-entry source-entry--subrow">
                    <span className="source-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ color: '#333', userSelect: 'none', fontFamily: 'monospace', lineHeight: 1, fontSize: '1.1rem' }}>{isLast ? '└──' : '├──'}</span>
                      {count > 1 && <span className="output-count">×{count}</span>}
                      {inputItem
                        ? <UniversalModalButton item={inputItem} variant="inline" label={inputLabel} onNavigate={onNavigate} />
                        : detail.inputName
                      }
                    </span>
                    {processingTime && (
                      <span className="source-detail" style={{ paddingTop: 0, paddingBottom: 0 }}>{formatProcessingTime(processingTime)}</span>
                    )}
                  </span>
                )
              })

              return [headerRow, ...subRows]
            })}
          </div>
        </ModalSection>
      )}

    </>
  )
}

export default MachineOutputsSection

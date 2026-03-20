import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'
import { formatProcessingTime } from '../../utils/Formatters'

function MachineOutputsSection({ entity, allItems, findById, onNavigate }) {
  const machineId = entity.id
  const outputItems = allItems.filter(item =>
    !item.isGeneric && item.sources?.some(s => s.id === machineId && s.type !== 'shop' && s.type !== 'reward')
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

  return (
    <>
      {outputItems.length > 0 && (
        <ModalSection id="section-machine-outputs" title={`Produces (${outputItems.length})`} navLabel="Produces">
          <div className="source-list">
            {outputItems.flatMap(item => {
              const src = item.sources?.find(s => s.id === machineId)
              const processingTime = src?.processingTimeMinutes || item.processingTimeMinutes
              const multipleInputs = src?.inputDetails?.length > 1

              // Header row — always rendered, no qualifier when sub-rows follow
              const headerRow = (
                <span key={item.id} className={`source-entry${multipleInputs ? ' source-entry--subrow' : ''}`}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ModalItemButton item={item} variant="inline" onNavigate={onNavigate} />
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
                    <span className="source-name--indented" style={{ color: '#b8a07a', userSelect: 'none' }}>
                      {isLast ? '└→' : '├→'}
                    </span>
                    <span className="source-qualifiers">
                      <span className="source-qualifier">
                        {count > 1 && <><span className="output-count" style={{ marginRight: '0.2rem' }}>×{count}</span>{' '}</>}
                        from {inputItem
                          ? <ModalItemButton item={inputItem} variant="inline" label={inputLabel} onNavigate={onNavigate} />
                          : detail.inputName
                        }
                      </span>
                    </span>
                    {processingTime && (
                      <span className="source-detail">{formatProcessingTime(processingTime)}</span>
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

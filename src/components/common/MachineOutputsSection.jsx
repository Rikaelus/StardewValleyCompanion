import ModalSection from './ModalSection'
import UniversalModalButton from './UniversalModalButton'
import SeasonBadges from './SeasonBadges'
import { formatProcessingTime, formatChance } from '../../utils/Formatters'

const QUALITY_LABELS = { 2: 'gold', 4: 'iridium' }

// A "render group" is { outputItem, outputQuality, outputCount, outputChance, inputs[], processingTime }
// Built by splitting each multi-input source's inputDetails by outputQuality, then grouping
// output items that share the same (quality-homogeneous) input set.
function buildRenderGroups(outputItems, machineId, findById) {
  // Map from fingerprint → group
  const byFingerprint = new Map()

  for (const item of outputItems) {
    const src = item.sources?.find(s => s.id === machineId)
    if (!src?.inputDetails || src.inputDetails.length < 2) continue

    // Split inputDetails by outputQuality
    const byQuality = new Map()
    for (const detail of src.inputDetails) {
      const q = detail.outputQuality ?? 0
      if (!byQuality.has(q)) byQuality.set(q, [])
      byQuality.get(q).push(detail)
    }

    for (const [quality, details] of byQuality) {
      // Fingerprint: inputs + quality (not outputCount — that can vary and goes on input row)
      const fp = details.map(d => `${d.inputId}:${d.requiredCount ?? 1}`).join('|') + `@q${quality}`

      // Per-input outputCount: put on input row if counts vary within this quality group
      const counts = details.map(d => d.outputCount ?? null)
      const countsVary = counts.some(c => c !== counts[0])
      const uniformCount = !countsVary ? (counts[0] ?? src.outputCount ?? null) : null

      if (!byFingerprint.has(fp)) {
        byFingerprint.set(fp, {
          inputs: details,
          outputQuality: quality,
          uniformCount,
          countsVary,
          processingTime: src.processingTimeMinutes,
          outputChance: src.outputChance ?? null,
          items: [],
        })
      }
      byFingerprint.get(fp).items.push(item)
    }
  }

  return [...byFingerprint.values()]
}

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

  const renderGroups = isTapper ? [] : buildRenderGroups(outputItems, machineId, findById)
  const invertedItemIds = new Set(renderGroups.flatMap(g => g.items.map(i => i.id)))

  const totalOutputCount = outputItems.length

  return (
    <>
      {outputItems.length > 0 && (
        <ModalSection id="section-machine-outputs" title={`Produces (${totalOutputCount})`} navLabel="Produces">
          <div className="source-list">
            {/* Inverted layout: inputs (┌/├) → outputs (├─‣/└─‣) */}
            {renderGroups.flatMap((group, groupIdx) => {
              const { inputs, outputQuality, uniformCount, countsVary, processingTime, outputChance, items } = group
              const qualityLabel = QUALITY_LABELS[outputQuality] ?? null

              const inputRows = inputs.map((detail, idx) => {
                const inputItem = detail.inputId ? findById(detail.inputId) : null
                const inputLabel = detail.inputName && inputItem && detail.inputName !== inputItem.name
                  ? detail.inputName : null
                const inputCount = detail.requiredCount || null
                const perInputQty = countsVary ? (detail.outputCount ?? null) : null
                return (
                  <span key={`inv-input-${groupIdx}-${detail.inputId || idx}`} className="source-entry source-entry--subrow">
                    <span className="source-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      {inputs.length > 1 && <span style={{ color: '#333', userSelect: 'none', fontFamily: 'monospace', lineHeight: 1, fontSize: '1.1rem' }}>{idx === 0 ? '┌' : '├'}</span>}
                      {inputItem
                        ? <UniversalModalButton item={inputItem} variant="inline" label={inputLabel} quantity={inputCount > 1 ? inputCount : null} onNavigate={onNavigate} />
                        : detail.inputName
                      }
                    </span>
                    {perInputQty != null && (
                      <span className="source-qualifiers">
                        <span className="source-qualifier">×{perInputQty}</span>
                      </span>
                    )}
                    {processingTime && idx === 0 && (
                      <span className="source-detail" style={{ paddingTop: 0, paddingBottom: 0 }}>{formatProcessingTime(processingTime)}</span>
                    )}
                  </span>
                )
              })

              const outputRows = items.map((item, idx) => {
                const itemSrc = item.sources?.find(s => s.id === machineId)
                const isLast = idx === items.length - 1
                const qty = uniformCount ?? itemSrc?.outputCount ?? null
                return (
                  <span key={`inv-out-${groupIdx}-${item.id}`} className="source-entry source-entry--subrow">
                    <span className="source-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ color: '#333', userSelect: 'none', fontFamily: 'monospace', lineHeight: 1, fontSize: '1.1rem', paddingLeft: inputs.length === 1 ? '0.3em' : undefined }}>{isLast ? (inputs.length > 1 ? '└─‣' : '└‣') : '├─‣'}</span>
                      <UniversalModalButton item={item} variant="inline" quantity={qty > 1 ? qty : null} onNavigate={onNavigate} />
                    </span>
                    <span className="source-qualifiers">
                      {qualityLabel && <span className="source-qualifier">{qualityLabel}</span>}
                      {outputChance != null && <span className="source-qualifier">{formatChance(outputChance)}</span>}
                    </span>
                  </span>
                )
              })

              return [...inputRows, ...outputRows]
            })}

            {outputItems.flatMap(item => {
              if (invertedItemIds.has(item.id)) return []

              // Tapper-specific rendering
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

              // Single-input output
              const src = item.sources?.find(s => s.id === machineId)
              const processingTime = src?.processingTimeMinutes || item.processingTimeMinutes
              const outputCount = src?.inputDetails?.[0]?.outputCount || src?.outputCount || null
              const requiredCount = src?.inputDetails?.[0]?.requiredCount || null
              const inputDetail = src?.inputDetails?.[0]
              const inputItemId = src?.inputId || inputDetail?.inputId
              const inputItem = inputItemId ? findById(inputItemId) : null
              const inputLabel = inputDetail?.inputName && inputItem && inputDetail.inputName !== inputItem.name
                ? inputDetail.inputName : null

              return [(
                <span key={item.id} className="source-entry">
                  <span className="source-name">
                    <UniversalModalButton item={item} variant="inline" quantity={outputCount > 1 ? outputCount : null} onNavigate={onNavigate} />
                  </span>
                  {inputItem && (
                    <span className="source-qualifiers">
                      <span className="source-qualifier">
                        from <UniversalModalButton item={inputItem} variant="inline" label={inputLabel} quantity={requiredCount > 1 ? requiredCount : null} onNavigate={onNavigate} />
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
                </span>
              )]
            })}
          </div>
        </ModalSection>
      )}
    </>
  )
}

export default MachineOutputsSection

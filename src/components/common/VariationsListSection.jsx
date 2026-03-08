import ModalSection from './ModalSection'
import ModalItemButton from './ModalItemButton'

function VariationsListSection({ entity, artisanItems, findById, onNavigate }) {
  if (!entity?.isGeneric || !entity.variations) return null

  const variationItems = entity.variations
    .map(varId => artisanItems.find(i => i.id === varId))
    .filter(Boolean)

  if (variationItems.length === 0) return null

  return (
    <ModalSection id="section-variations" title={`Variations (${variationItems.length})`}>
      <div className="variations-list">
        {variationItems.map(variation => {
          const varMachineSource = variation.sources?.find(s => s.type === 'machine')
          const machineName = varMachineSource?.id ? (findById(varMachineSource.id)?.name ?? varMachineSource.id) : null
          const source = varMachineSource
            ? `${machineName}: ${varMachineSource.inputName}`
            : null

          return (
            <div key={variation.id} className="variation-row">
              <ModalItemButton
                item={variation}
                variant="inline"
                onNavigate={onNavigate}
              />
              {source && <span className="variation-source">{source}</span>}
              <span className="variation-price">
                {variation.prices?.regular}g
              </span>
            </div>
          )
        })}
      </div>
    </ModalSection>
  )
}

export default VariationsListSection

import ModalSection from './ModalSection'

function AgingInfoSection({ entity }) {
  if (!entity?.canBeAged) return null

  const { agingDaysToIridium, agingDaysPerTier } = entity

  return (
    <ModalSection id="section-aging" title="Cask Aging" navLabel="Cask Aging">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#5c4a32' }}>
          This item can be aged in a cask to improve its quality and value.
        </div>

        {agingDaysPerTier && (
          <div className="aging-grid">
            <span className="quality-symbol quality-symbol--sell quality-symbol--regular">●</span>
            <span style={{ fontSize: '0.875rem' }}>
              <strong>Regular → Silver:</strong> {agingDaysPerTier} days
            </span>

            <span className="quality-symbol quality-symbol--sell quality-symbol--silver">◆</span>
            <span style={{ fontSize: '0.875rem' }}>
              <strong>Silver → Gold:</strong> {agingDaysPerTier} days
            </span>

            <span className="quality-symbol quality-symbol--sell quality-symbol--gold">★</span>
            <span style={{ fontSize: '0.875rem' }}>
              <strong>Gold → Iridium:</strong> {agingDaysPerTier} days
            </span>

            <span className="quality-symbol quality-symbol--sell quality-symbol--iridium">◆</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
              <strong>Total to Iridium:</strong> {agingDaysToIridium} days
            </span>
          </div>
        )}

        {!agingDaysPerTier && (
          <div style={{ fontSize: '0.875rem' }}>
            <strong>Days to Iridium:</strong> {agingDaysToIridium} days
          </div>
        )}
      </div>
    </ModalSection>
  )
}

export default AgingInfoSection

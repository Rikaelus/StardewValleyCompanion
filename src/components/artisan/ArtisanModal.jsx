import { useRef, useEffect, useMemo } from 'react'
import Modal from '../common/Modal'
import ModalHeader from '../common/ModalHeader'
import ModalSection from '../common/ModalSection'
import { ModalGrid, ModalGridItem } from '../common/ModalGrid'
import TagList from '../common/TagList'
import ModalNote from '../common/ModalNote'
import DataTable from '../common/DataTable'
import ModalGiftPreferences from '../common/ModalGiftPreferences'
import ItemSellPrice from '../common/ItemSellPrice'
import './ArtisanModal.css'

function ArtisanModal({ item, isOpen, onClose }) {
  const itemRef = useRef(item)

  // Keep the last item data during closing animation
  useEffect(() => {
    if (item) {
      itemRef.current = item
    }
  }, [item])

  const displayItem = item || itemRef.current

  const formatPrice = (price) => {
    return `${price}g`
  }

  // Define columns for the input value table
  const inputTableColumns = useMemo(() => [
    {
      accessorKey: 'inputName',
      header: 'Item',
      cell: ({ getValue }) => (
        <span style={{ fontWeight: 600, color: '#2d1b00' }}>{getValue()}</span>
      ),
    },
    {
      accessorKey: 'inputBasePrice',
      header: 'Input G',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', color: '#5c4a32' }}>{formatPrice(getValue())}</span>
      ),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'outputPrice',
      header: 'Output G',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', color: '#f57c00', fontWeight: 600 }}>
          {formatPrice(getValue())}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'outputIridiumPrice',
      header: 'Iridium + Artisan',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', color: '#9c27b0', fontWeight: 600 }}>
          {formatPrice(getValue())}
        </span>
      ),
      meta: { align: 'right' },
    },
    {
      accessorKey: 'profitMargin',
      header: 'Profit',
      accessorFn: (row) => {
        return row.outputPrice > 0
          ? Math.round((row.outputPrice - row.inputBasePrice) / row.inputBasePrice * 100)
          : 0
      },
      cell: ({ getValue }) => {
        const margin = getValue()
        const color = margin >= 200 ? '#388e3c' : margin >= 100 ? '#f57c00' : '#616161'
        return (
          <span style={{ color, fontWeight: 600 }}>+{margin}%</span>
        )
      },
      meta: { align: 'center' },
    },
  ], [])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayItem?.name || 'Artisan Good'}>
      {displayItem && <>
        <ModalHeader icon={displayItem.icon} name={displayItem.name} subtitle={displayItem.category}>
          {displayItem.prices && (
            <div className="modal-price">
              <ItemSellPrice item={displayItem} showQualities={true} showProfession={true} />
            </div>
          )}
        </ModalHeader>

        {displayItem.producedBy && (
          <ModalSection title="Production Info">
            <ModalGrid>
              <ModalGridItem
                label="Machine:"
                value={displayItem.producedBy.machine}
              />

              <ModalGridItem
                label="Input Type:"
                value={
                  displayItem.producedBy.inputType === 'specific'
                    ? 'Specific Item'
                    : displayItem.producedBy.inputType.charAt(0).toUpperCase() + displayItem.producedBy.inputType.slice(1)
                }
              />

              {displayItem.processingTimeMinutes && (
                <ModalGridItem
                  label="Processing Time:"
                  value={(() => {
                    const minutes = displayItem.processingTimeMinutes;
                    const hours = minutes / 60;
                    if (hours >= 24) {
                      const days = Math.round(hours / 24 * 10) / 10;
                      return `${days}d`;
                    }
                    const displayHours = Math.round(hours * 10) / 10;
                    return `${displayHours}h`;
                  })()}
                />
              )}

              <ModalGridItem label="Value Formula:">
                <span className="value formula">{displayItem.producedBy.valueFormula}</span>
              </ModalGridItem>
            </ModalGrid>
          </ModalSection>
        )}

        {displayItem.producedBy?.inputDetails && displayItem.producedBy.inputDetails.length > 0 && (
          <ModalSection title="Input Value Table">
            <div className="input-value-table">
              <DataTable
                data={displayItem.producedBy.inputDetails}
                columns={inputTableColumns}
                pinnedColumns={0}
                initialSortBy={[{ id: 'outputPrice', desc: true }]}
                enablePagination={false}
              />
            </div>

            <ModalNote type="info">
              <strong>Note:</strong> Iridium quality with Artisan profession (+40% sell price)
            </ModalNote>
          </ModalSection>
        )}

        {displayItem.bundleDetails && displayItem.bundleDetails.length > 0 && (
          <ModalSection title="Bundles">
            <TagList items={displayItem.bundleDetails} variant="bundle" nameKey="name" />
          </ModalSection>
        )}

        <ModalGiftPreferences
          giftDetails={displayItem.giftDetails}
          sectionClass="modal-section"
          giftsClass="modal-gifts"
        />

        {displayItem.contextTags && displayItem.contextTags.length > 0 && (
          <ModalSection title="Context Tags">
            <TagList items={displayItem.contextTags} variant="context" />
          </ModalSection>
        )}
      </>}
    </Modal>
  )
}

export default ArtisanModal

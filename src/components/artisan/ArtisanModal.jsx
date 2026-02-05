import { useRef, useEffect, useMemo } from 'react'
import Modal from '../common/Modal'
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
      {displayItem && <div className="artisan-modal">
        <div className="artisan-modal-header">
          <img
            src={displayItem.icon}
            alt={displayItem.name}
            className="artisan-modal-icon"
            onError={(e) => {
              // Prevent duplicate fallbacks
              if (e.target.dataset.errorHandled) return
              e.target.dataset.errorHandled = 'true'

              // Fallback to text if image fails to load
              e.target.style.display = 'none'
              const fallback = document.createElement('div')
              fallback.className = 'artisan-modal-icon-fallback'
              fallback.textContent = displayItem.name.slice(0, 2).toUpperCase()
              fallback.title = `${displayItem.name} (icon not found)`
              e.target.parentNode.insertBefore(fallback, e.target)
            }}
          />
          <div className="artisan-modal-title-section">
            <h3>{displayItem.name}</h3>
            <div className="artisan-modal-category">{displayItem.category}</div>
            {displayItem.prices && (
              <div className="artisan-modal-price">
                <ItemSellPrice item={displayItem} showQualities={true} showProfession={true} />
              </div>
            )}
          </div>
        </div>

        {displayItem.producedBy && (
          <div className="artisan-modal-section">
            <h4>Production Info</h4>
            <div className="artisan-modal-grid">
              <div className="artisan-modal-item">
                <span className="label">Machine:</span>
                <span className="value">{displayItem.producedBy.machine}</span>
              </div>

              <div className="artisan-modal-item">
                <span className="label">Input Type:</span>
                <span className="value">
                  {displayItem.producedBy.inputType === 'specific'
                    ? 'Specific Item'
                    : displayItem.producedBy.inputType.charAt(0).toUpperCase() + displayItem.producedBy.inputType.slice(1)
                  }
                </span>
              </div>

              <div className="artisan-modal-item">
                <span className="label">Processing Time:</span>
                <span className="value">
                  {displayItem.producedBy.processingTimeDays} {displayItem.producedBy.processingTimeDays === 1 ? 'day' : 'days'}
                </span>
              </div>

              <div className="artisan-modal-item">
                <span className="label">Value Formula:</span>
                <span className="value formula">{displayItem.producedBy.valueFormula}</span>
              </div>
            </div>
          </div>
        )}

        {displayItem.producedBy?.inputDetails && displayItem.producedBy.inputDetails.length > 0 && (
          <div className="artisan-modal-section">
            <h4>Input Value Table</h4>

            <div className="input-value-table">
              <DataTable
                data={displayItem.producedBy.inputDetails}
                columns={inputTableColumns}
                pinnedColumns={0}
                initialSortBy={[{ id: 'outputPrice', desc: true }]}
                enablePagination={false}
              />
            </div>

            <div className="artisan-modal-note">
              <strong>Note:</strong> Iridium quality with Artisan profession (+40% sell price)
            </div>
          </div>
        )}

        {displayItem.bundleDetails && displayItem.bundleDetails.length > 0 && (
          <div className="artisan-modal-section">
            <h4>Bundles</h4>
            <div className="artisan-modal-bundles">
              {displayItem.bundleDetails.map(bundle => (
                <div key={bundle.id} className="bundle-tag">
                  {bundle.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <ModalGiftPreferences
          giftDetails={displayItem.giftDetails}
          sectionClass="artisan-modal-section"
          giftsClass="artisan-modal-gifts"
        />

        {displayItem.contextTags && displayItem.contextTags.length > 0 && (
          <div className="artisan-modal-section context-tags-section">
            <h4>Context Tags</h4>
            <div className="context-tags">
              {displayItem.contextTags.map((tag, i) => (
                <span key={i} className="context-tag">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>}
    </Modal>
  )
}

export default ArtisanModal

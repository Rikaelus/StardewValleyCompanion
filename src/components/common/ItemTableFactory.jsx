import GiftCell from './GiftCell'
import ModalItemButton from './ModalItemButton'
import SeasonBadges from './SeasonBadges'
import ItemSellPrice, { createPriceSortingFn } from './ItemSellPrice'

/**
 * Factory functions for creating reusable table columns across all item types.
 * Extracted from FishTable and ArtisanTable to eliminate duplication.
 */

/**
 * Creates the icon column (always first column)
 */
export function createIconColumn() {
  return {
    accessorKey: 'icon',
    header: '',
    cell: ({ row }) => (
      <ModalItemButton
        item={row.original}
        iconSize={24}
        stopPropagation={true}
      />
    ),
    enableSorting: false,
  }
}

/**
 * Creates the name column (always second column)
 * @param {Object} options - Configuration options
 * @param {Function} options.cellRenderer - Optional custom cell renderer
 */
export function createNameColumn(options = {}) {
  const defaultRenderer = ({ row }) => <strong>{row.original.name}</strong>

  return {
    accessorKey: 'name',
    header: 'Name',
    cell: options.cellRenderer || defaultRenderer,
  }
}

/**
 * Creates the price column with profession-aware sorting
 * @param {Object} professionsRef - React ref containing player professions
 * @param {Object} options - Configuration options
 * @param {boolean} options.showQualities - Whether to show quality prices (default: true)
 */
export function createPriceColumn(professionsRef, options = {}) {
  const showQualities = options.showQualities !== false

  return {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ row }) => <ItemSellPrice item={row.original} showQualities={showQualities} />,
    sortingFn: (rowA, rowB) => createPriceSortingFn(professionsRef.current)(rowA, rowB),
    meta: { align: 'left' },
  }
}

/**
 * Creates the bundle column showing which bundles an item belongs to
 *
 * RELATIONAL: Uses relationalData to resolve bundle IDs to full bundle objects
 *
 * @param {Object} relationalData - Relational data from useRelationalData() hook
 */
export function createBundleColumn(relationalData) {
  return {
    accessorKey: 'bundles',
    header: 'Bundles',
    cell: ({ getValue, row }) => {
      const bundleIds = getValue() || []
      if (bundleIds.length === 0) return <span style={{ color: '#999' }}>—</span>

      // RELATIONAL: Resolve bundle IDs to full bundle objects
      if (!relationalData || relationalData.loading) {
        return <span style={{ color: '#999' }}>—</span>
      }

      const bundleDetails = bundleIds
        .map(bundleId => relationalData.getBundle(bundleId))
        .filter(Boolean)

      if (bundleDetails.length === 0) return <span style={{ color: '#999' }}>—</span>

      return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {bundleDetails.map(bundle => (
            <span
              key={bundle.id}
              style={{
                background: '#e3f2fd',
                color: '#1976d2',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                whiteSpace: 'nowrap'
              }}
              title={bundle.name}
            >
              {bundle.name}
            </span>
          ))}
        </div>
      )
    },
    sortingFn: (rowA, rowB, columnId) => {
      const aIds = rowA.getValue(columnId) || []
      const bIds = rowB.getValue(columnId) || []

      // Sort by number of bundles first
      if (aIds.length !== bIds.length) return aIds.length - bIds.length
      if (aIds.length === 0) return 0

      // Then alphabetically by first bundle ID
      return aIds[0].localeCompare(bIds[0])
    },
  }
}

/**
 * Creates villager gift preference columns for all villagers
 * This is the exact same pattern used in both FishTable and ArtisanTable
 *
 * RELATIONAL: Uses relationalData to lookup gift preferences instead of embedded giftDetails
 *
 * @param {Array} villagers - Array of villager objects with id, name, icon
 * @param {Object} relationalData - Relational data from useRelationalData() hook
 * @returns {Array} Array of column definitions
 */
export function createVillagerGiftColumns(villagers, relationalData) {
  // Define the gift preference sort order once
  const GIFT_SORT_ORDER = { love: 0, like: 1, neutral: 2, dislike: 3, hate: 4 }

  return villagers.map(villager => ({
    id: `gift-${villager.id}`,
    accessorFn: row => {
      // RELATIONAL: Look up gift preference using relational data
      if (!relationalData?.getGiftPreference) {
        return null
      }
      return relationalData.getGiftPreference(row.id, villager.id)
    },
    header: () => (
      <img
        src={villager.icon}
        alt={villager.name}
        title={villager.name}
        width={24}
        height={24}
      />
    ),
    cell: ({ getValue }) => <GiftCell preference={getValue()} />,
    sortingFn: (rowA, rowB, columnId) => {
      const a = GIFT_SORT_ORDER[rowA.getValue(columnId)] ?? 5
      const b = GIFT_SORT_ORDER[rowB.getValue(columnId)] ?? 5
      return a - b
    },
  }))
}

/**
 * Helper to create a season badges column
 * Used by fish, crops, forage, etc.
 */
export function createSeasonColumn() {
  return {
    accessorKey: 'seasons',
    header: 'Season',
    cell: ({ getValue }) => {
      const seasons = getValue() || []
      return <SeasonBadges seasons={seasons} />
    },
  }
}

/**
 * Season badge CSS that should be injected into components using season columns
 */

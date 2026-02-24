import { useState, useMemo } from 'react'
import DataTable from '../common/DataTable'
import UniversalModal from '../common/UniversalModal'
import { useEntities } from '../../contexts/EntityContext'
import { formatLocationNames } from '../../utils/formatters'
import ModalItemButton from '../common/ModalItemButton'
import {
  createNameColumn,
  createSeasonColumn,
  createPriceColumn,
  createBundleColumn,
  createVillagerGiftColumns
} from '../common/ItemTableFactory.jsx'

function ForageTable({ data, allData }) {
  const { villagers: { all: villagers }, ...relationalData } = useEntities()
  const [selectedForage, setSelectedForage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleRowClick = (forage) => {
    setSelectedForage(forage)
    setIsModalOpen(true)
  }

  const columns = useMemo(() => {
    // Don't build columns until relational data is loaded
    if (relationalData.loading) {
      return []
    }

    const baseColumns = [
      createNameColumn({
        cellRenderer: ({ row }) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <ModalItemButton item={row.original} showIcon={true} showLabel={true} iconSize={24} stopPropagation={true} />
            {row.original.hasLocationNuance && <span className="nuance-indicator" title="Availability varies by location — click for details">*</span>}
          </span>
        )
      }),
      {
        accessorKey: 'locations',
        header: 'Locations',
        cell: ({ row }) => {
          const locations = row.original.locations || []
          if (locations.length === 0) return <span style={{ color: '#999' }}>Unknown</span>
          return formatLocationNames(locations).join(', ')
        },
        enableSorting: false,
      },
      createSeasonColumn(),
      createPriceColumn(),
      createBundleColumn(relationalData),
    ]

    const villagerColumns = createVillagerGiftColumns(villagers, relationalData)

    return [...baseColumns, ...villagerColumns]
  }, [villagers, relationalData])

  // Show loading state while data loads
  if (relationalData.loading || columns.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  }

  const nuancedItems = data.filter(f => f.hasLocationNuance)

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        initialSortBy={[{ id: 'name', desc: false }]}
        itemsPerPage={25}
      />
      {nuancedItems.length > 0 && (
        <div className="nuance-note">
          * Seasons and locations shown are the full range of possibilities. Click on an item marked with * to see exact availability per location.
        </div>
      )}
      <UniversalModal
        entity={selectedForage}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}

export default ForageTable

import { useState, useMemo } from 'react'
import DataTable from '../common/DataTable'
import ItemModal from '../common/ItemModal'
import { useVillagers } from '../../contexts/VillagersContext'
import { formatLocationNames } from '../../utils/formatters'
import {
  createIconColumn,
  createNameColumn,
  createSeasonColumn,
  createPriceColumn,
  createBundleColumn,
  createVillagerGiftColumns
} from '../common/ItemTableFactory.jsx'

function ForageTable({ data }) {
  const { villagers } = useVillagers()
  const [selectedForage, setSelectedForage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleRowClick = (forage) => {
    setSelectedForage(forage)
    setIsModalOpen(true)
  }

  const columns = useMemo(() => {
    const baseColumns = [
      createIconColumn({ onClick: handleRowClick }),
      createNameColumn({ onClick: handleRowClick }),
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
      createBundleColumn(),
    ]

    const villagerColumns = createVillagerGiftColumns(villagers)

    return [...baseColumns, ...villagerColumns]
  }, [villagers])

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        initialSortBy={[{ id: 'name', desc: false }]}
        itemsPerPage={25}
      />
      <ItemModal
        item={selectedForage}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}

export default ForageTable

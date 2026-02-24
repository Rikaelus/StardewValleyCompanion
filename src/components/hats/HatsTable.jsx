import { useMemo, useState } from 'react'
import DataTable from '../common/DataTable'
import UniversalModal from '../common/UniversalModal'
import ShopSourceList from '../common/ShopSourceList'
import {
  createNameColumn,
} from '../common/ItemTableFactory.jsx'

function HatsTable({ data }) {
  const [selectedItem, setSelectedItem] = useState(null)

  const columns = useMemo(() => [
    createNameColumn(),
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => {
        const desc = getValue()
        return desc || <span className="cell-muted">—</span>
      },
      enableSorting: false,
    },
    {
      accessorKey: 'sources',
      header: 'Where to Get',
      cell: ({ getValue }) => <ShopSourceList sources={getValue()} compact />,
      enableSorting: false,
    },
  ], [])

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        initialSortBy={[{ id: 'name', desc: false }]}
        itemsPerPage={50}
        onRowClick={(item) => setSelectedItem(item)}
      />
      <UniversalModal
        entity={selectedItem}
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
      />
    </>
  )
}

export default HatsTable

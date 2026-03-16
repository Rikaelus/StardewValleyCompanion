import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useItemData } from '../../hooks/useData'
import PagePanel from '../common/PagePanel'
import FurnitureTable from './FurnitureTable'

function FurniturePage() {
  const { data, loading, error } = useItemData('furniture')
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
  })

  useEffect(() => {
    const params = new URLSearchParams(searchParams)

    if (filters.search) {
      params.set('search', filters.search)
    } else {
      params.delete('search')
    }

    if (filters.type) {
      params.set('type', filters.type)
    } else {
      params.delete('type')
    }

    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams, searchParams])

  const filterOptions = useMemo(() => {
    if (!data.items) return {}
    const types = [...new Set(data.items.map(f => f.subtype).filter(Boolean))].sort()
    return { types }
  }, [data.items])

  const filteredData = useMemo(() => {
    if (!data.items) return []

    return data.items.filter(item => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!item.name.toLowerCase().includes(q)) return false
      }

      if (filters.type && item.subtype !== filters.type) return false

      return true
    })
  }, [data.items, filters])

  if (loading) {
    return (
      <PagePanel title="Furniture">
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </PagePanel>
    )
  }

  if (error) {
    return (
      <PagePanel title="Furniture">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          Error loading furniture: {error.message}
        </div>
      </PagePanel>
    )
  }

  return (
    <div className="furniture-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Furniture</h2>
        </PagePanel.Header>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Furniture name..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">All Types</option>
              {filterOptions.types?.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <button
            className="clear-filters"
            onClick={() => setFilters({ search: '', type: '' })}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      <FurnitureTable data={filteredData} />
    </div>
  )
}

export default FurniturePage

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useItemData } from '../../hooks/useData'
import PagePanel from '../common/PagePanel'
import HatsTable from './HatsTable'

function HatsPage() {
  const { data, loading, error } = useItemData('hats')
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
  })

  useEffect(() => {
    const params = new URLSearchParams(searchParams)

    if (filters.search) {
      params.set('search', filters.search)
    } else {
      params.delete('search')
    }

    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams, searchParams])

  const filteredData = useMemo(() => {
    if (!data.items) return []

    return data.items.filter(item => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!item.name.toLowerCase().includes(q) &&
            !item.description?.toLowerCase().includes(q)) return false
      }

      return true
    })
  }, [data.items, filters])

  if (loading) {
    return (
      <PagePanel title="Hats">
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </PagePanel>
    )
  }

  if (error) {
    return (
      <PagePanel title="Hats">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          Error loading hats: {error.message}
        </div>
      </PagePanel>
    )
  }

  return (
    <div className="hats-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Hats</h2>
        </PagePanel.Header>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Hat name or description..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <button
            className="clear-filters"
            onClick={() => setFilters({ search: '' })}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      <HatsTable data={filteredData} />
    </div>
  )
}

export default HatsPage

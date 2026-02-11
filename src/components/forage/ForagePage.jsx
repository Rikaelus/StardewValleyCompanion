import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useItemData } from '../../hooks/useData'
import PagePanel from '../common/PagePanel'
import ForageTable from './ForageTable'
import SpecialCases from '../common/SpecialCases'
import './ForagePage.css'

function ForagePage() {
  const { data, loading, error } = useItemData('forage')
  const [searchParams, setSearchParams] = useSearchParams()

  // Get state from URL
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    seasons: searchParams.get('seasons')?.split(',').filter(Boolean) || [],
    location: searchParams.get('location') || '',
    bundle: searchParams.get('bundle') || '',
  })

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams) // Preserve existing params (sort, page)

    // Update filter params
    if (filters.search) {
      params.set('search', filters.search)
    } else {
      params.delete('search')
    }

    if (filters.seasons?.length > 0) {
      params.set('seasons', filters.seasons.join(','))
    } else {
      params.delete('seasons')
    }

    if (filters.location) {
      params.set('location', filters.location)
    } else {
      params.delete('location')
    }

    if (filters.bundle) {
      params.set('bundle', filters.bundle)
    } else {
      params.delete('bundle')
    }

    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams, searchParams])

  const filterOptions = useMemo(() => {
    if (!data.items) return {}

    // Extract unique locations from forage data
    const locations = [...new Set(data.items.flatMap(f => f.locations || []))].sort()

    // Extract unique bundles from forage bundleDetails
    const bundleMap = new Map()
    data.items.forEach(forage => {
      forage.bundleDetails?.forEach(bundle => {
        if (!bundleMap.has(bundle.id)) {
          bundleMap.set(bundle.id, bundle)
        }
      })
    })
    const bundles = Array.from(bundleMap.values())

    return {
      locations,
      bundles,
    }
  }, [data.items])

  const filteredData = useMemo(() => {
    if (!data.items) return []

    return data.items.filter(item => {
      // Search filter
      if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }

      // Season filter
      if (filters.seasons.length > 0) {
        const itemSeasons = item.seasons || []
        if (!filters.seasons.some(season => itemSeasons.includes(season))) {
          return false
        }
      }

      // Location filter
      if (filters.location) {
        const itemLocations = item.locations || []
        if (!itemLocations.includes(filters.location)) {
          return false
        }
      }

      // Bundle filter
      if (filters.bundle) {
        const inBundle = item.bundleDetails?.some(b => b.id === filters.bundle)
        if (!inBundle) {
          return false
        }
      }

      return true
    })
  }, [data.items, filters])

  if (loading) {
    return (
      <PagePanel title="Foraged Items">
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      </PagePanel>
    )
  }

  if (error) {
    return (
      <PagePanel title="Foraged Items">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          Error loading forage data: {error.message}
        </div>
      </PagePanel>
    )
  }

  return (
    <div className="forage-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Foraged Items</h2>
        </PagePanel.Header>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Forage name..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Season</label>
            <div className="checkbox-group">
              {['Spring', 'Summer', 'Fall', 'Winter'].map(season => (
                <label key={season} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={(filters.seasons || []).includes(season)}
                    onChange={() => {
                      const current = filters.seasons || []
                      const updated = current.includes(season)
                        ? current.filter(s => s !== season)
                        : [...current, season]
                      setFilters({ ...filters, seasons: updated })
                    }}
                  />
                  {season}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Location</label>
            <select
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            >
              <option value="">All Locations</option>
              {filterOptions.locations?.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Bundle</label>
            <select
              value={filters.bundle}
              onChange={(e) => setFilters({ ...filters, bundle: e.target.value })}
            >
              <option value="">All Items</option>
              {filterOptions.bundles?.map(bundle => (
                <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
              ))}
            </select>
          </div>

          <button
            className="clear-filters"
            onClick={() => setFilters({ search: '', seasons: [], location: '', bundle: '' })}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      <ForageTable data={filteredData} />
      <SpecialCases items={data.items || []} />
    </div>
  )
}

export default ForagePage

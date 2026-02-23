import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFishData } from '../../hooks/useData'
import { useDebounce } from '../../hooks/useDebounce'
import PagePanel from '../common/PagePanel'
import FishTable from './FishTable'
import './FishPage.css'

function FishPage() {
  const { data, loading, error } = useFishData()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get state from URL
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    seasons: searchParams.get('seasons')?.split(',').filter(Boolean) || [],
    weather: searchParams.get('weather') || '',
    location: searchParams.get('location') || '',
    bundle: searchParams.get('bundle') || '',
  })

  // Debounce the search filter to avoid excessive re-renders while typing
  const debouncedSearch = useDebounce(filters.search, 300)

  // Update URL when filters change (use debounced search for URL to avoid spamming history)
  useEffect(() => {
    const params = new URLSearchParams(searchParams) // Preserve existing params (sort, page)

    // Update filter params
    if (debouncedSearch) {
      params.set('search', debouncedSearch)
    } else {
      params.delete('search')
    }

    if (filters.seasons?.length > 0) {
      params.set('seasons', filters.seasons.join(','))
    } else {
      params.delete('seasons')
    }

    if (filters.weather) {
      params.set('weather', filters.weather)
    } else {
      params.delete('weather')
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
  }, [debouncedSearch, filters.seasons, filters.weather, filters.location, filters.bundle, setSearchParams])

  const filterOptions = useMemo(() => {
    if (!data.fish) return {}

    // Extract unique locations from fish data
    const locations = [...new Set(data.fish.flatMap(f => f.locations || []))].sort()

    // Extract unique bundles from fish bundleDetails
    const bundleMap = new Map()
    data.fish.forEach(fish => {
      fish.bundleDetails?.forEach(bundle => {
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
  }, [data])

  const filteredFish = useMemo(() => {
    if (!data.fish) return []

    return data.fish.filter(fish => {
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase()
        if (!fish.name.toLowerCase().includes(search)) return false
      }

      if (filters.seasons?.length > 0) {
        // Check if fish is available in ALL selected seasons (case-insensitive)
        const fishSeasons = fish.seasons?.map(s => s.toLowerCase()) || []
        if (!filters.seasons.every(s => fishSeasons.includes(s.toLowerCase()))) return false
      }

      if (filters.weather) {
        // Check weather match (case-insensitive, handle 'both' as matches everything)
        const fishWeather = fish.weather?.toLowerCase()
        const filterWeather = filters.weather.toLowerCase()
        // Map 'rain' to 'rainy' for comparison
        const normalizedFilter = filterWeather === 'rain' ? 'rainy' : filterWeather
        if (fishWeather !== normalizedFilter && fishWeather !== 'both') return false
      }

      if (filters.location) {
        if (!fish.locations?.includes(filters.location)) return false
      }

      if (filters.bundle) {
        const fishBundleIds = fish.bundleDetails?.map(b => b.id) || []
        if (filters.bundle === '__none__') {
          if (fishBundleIds.length > 0) return false
        } else if (filters.bundle === '__any__') {
          if (fishBundleIds.length === 0) return false
        } else {
          if (!fishBundleIds.includes(filters.bundle)) return false
        }
      }

      return true
    })
  }, [data.fish, debouncedSearch, filters.seasons, filters.weather, filters.location, filters.bundle])

  if (loading) {
    return <div className="fish-page"></div>
  }

  if (error) {
    return <div className="fish-page"><p className="error">Error: {error}</p></div>
  }

  return (
    <div className="fish-page">
      <PagePanel>
        <PagePanel.Header>
          <h2>Fish</h2>
        </PagePanel.Header>

        <PagePanel.Controls>
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              placeholder="Fish name..."
              value={filters.search || ''}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
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
            <label className="filter-label">Weather</label>
            <select
              value={filters.weather || ''}
              onChange={e => setFilters({ ...filters, weather: e.target.value })}
            >
              <option value="">All Weather</option>
              <option value="Sunny">Sunny</option>
              <option value="Rain">Rain</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Location</label>
            <select
              value={filters.location || ''}
              onChange={e => setFilters({ ...filters, location: e.target.value })}
            >
              <option value="">All Locations</option>
              {filterOptions.locations?.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>

          {filterOptions.bundles && (
            <div className="filter-group">
              <label className="filter-label">Bundle</label>
              <select
                value={filters.bundle || ''}
                onChange={e => setFilters({ ...filters, bundle: e.target.value })}
              >
                <option value="">All Fish</option>
                <option value="__any__">Any Bundle</option>
                <option value="__none__">No Bundle</option>
                {filterOptions.bundles.map(bundle => (
                  <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            className="clear-filters"
            onClick={() => setFilters({ search: '', seasons: [], weather: '', location: '', bundle: '' })}
          >
            Clear Filters
          </button>
        </PagePanel.Controls>
      </PagePanel>

      <FishTable
        fish={filteredFish}
        allFish={data.fish || []}
      />
    </div>
  )
}

export default FishPage

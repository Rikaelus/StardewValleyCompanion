import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFishData } from '../../hooks/useData'
import PagePanel from '../common/PagePanel'
import FishTable from './FishTable'
import SpecialCases from './SpecialCases'
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

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.seasons?.length > 0) params.set('seasons', filters.seasons.join(','))
    if (filters.weather) params.set('weather', filters.weather)
    if (filters.location) params.set('location', filters.location)
    if (filters.bundle) params.set('bundle', filters.bundle)

    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  const filterOptions = useMemo(() => {
    if (!data.fish) return {}

    // Extract unique locations from fish data
    const locations = [...new Set(data.fish.flatMap(f => f.location || []))].sort()

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
      if (filters.search) {
        const search = filters.search.toLowerCase()
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
        if (!fish.location?.includes(filters.location)) return false
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
  }, [data.fish, filters])

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
          <h2>Fish Guide</h2>
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
        villagers={data.villagers || []}
      />
      <SpecialCases fish={data.fish || []} />
    </div>
  )
}

export default FishPage

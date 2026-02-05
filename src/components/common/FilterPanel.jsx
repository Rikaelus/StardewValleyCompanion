import './FilterPanel.css'

function FilterPanel({
  filters,
  onFilterChange,
  options,
  title = 'Guide',
  searchPlaceholder = 'Search...',
  showSeasons = false,
  showWeather = false,
  showLocation = false,
  customFilters = []
}) {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const handleMultiSelect = (key, value) => {
    const current = filters[key] || []
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onFilterChange({ ...filters, [key]: updated })
  }

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h2>{title}</h2>
      </div>
      <div className="filter-controls">
        <div className="filter-group">
        <label className="filter-label">Search</label>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={filters.search || ''}
          onChange={e => handleChange('search', e.target.value)}
        />
      </div>

      {showSeasons && (
        <div className="filter-group">
          <label className="filter-label">Season</label>
          <div className="checkbox-group">
            {['Spring', 'Summer', 'Fall', 'Winter'].map(season => (
              <label key={season} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={(filters.seasons || []).includes(season)}
                  onChange={() => handleMultiSelect('seasons', season)}
                />
                {season}
              </label>
            ))}
          </div>
        </div>
      )}

      {showWeather && (
        <div className="filter-group">
          <label className="filter-label">Weather</label>
          <select
            value={filters.weather || ''}
            onChange={e => handleChange('weather', e.target.value)}
          >
            <option value="">All Weather</option>
            <option value="Sunny">Sunny</option>
            <option value="Rain">Rain</option>
          </select>
        </div>
      )}

      {showLocation && (
        <div className="filter-group">
          <label className="filter-label">Location</label>
          <select
            value={filters.location || ''}
            onChange={e => handleChange('location', e.target.value)}
          >
            <option value="">All Locations</option>
            {options.locations?.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      )}

      {customFilters.includes('machine') && options.machines && (
        <div className="filter-group">
          <label className="filter-label">Machine</label>
          <select
            value={filters.machine || ''}
            onChange={e => handleChange('machine', e.target.value)}
          >
            <option value="">All Machines</option>
            {options.machines.map(machine => (
              <option key={machine} value={machine}>{machine}</option>
            ))}
          </select>
        </div>
      )}

      {customFilters.includes('inputType') && options.inputTypes && (
        <div className="filter-group">
          <label className="filter-label">Input Type</label>
          <select
            value={filters.inputType || ''}
            onChange={e => handleChange('inputType', e.target.value)}
          >
            <option value="">All Types</option>
            {options.inputTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-group">
        <label className="filter-label">Bundle</label>
        <select
          value={filters.bundle || ''}
          onChange={e => handleChange('bundle', e.target.value)}
        >
          <option value="">All Fish</option>
          <option value="__any__">Any Bundle</option>
          <option value="__none__">No Bundle</option>
          {options.bundles?.map(bundle => (
            <option key={bundle.id} value={bundle.id}>{bundle.name}</option>
          ))}
        </select>
      </div>

        <button
          className="clear-filters"
          onClick={() => onFilterChange({})}
        >
          Clear Filters
        </button>
      </div>
    </div>
  )
}

export default FilterPanel

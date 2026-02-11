import './SeasonBadges.css'

/**
 * Display season availability badges for an item
 * Shows all 4 seasons with active/inactive state
 *
 * @param {Object} props
 * @param {Array<string>} props.seasons - Array of season names (e.g., ['spring', 'summer'])
 * @param {boolean} props.compact - Show abbreviated season names (Sp, Su, Fa, Wi) instead of full
 */
function SeasonBadges({ seasons = [], compact = false }) {
  const allSeasons = [
    { name: 'Spring', key: 'spring', short: 'Sp' },
    { name: 'Summer', key: 'summer', short: 'Su' },
    { name: 'Fall', key: 'fall', short: 'Fa' },
    { name: 'Winter', key: 'winter', short: 'Wi' }
  ]

  // Normalize seasons to lowercase for comparison
  const normalizedSeasons = seasons.map(s => s.toLowerCase())

  return (
    <span className="season-badges">
      {allSeasons.map(season => {
        const isActive = normalizedSeasons.includes(season.key)
        return (
          <span
            key={season.key}
            className={`season-badge season-${season.key} ${isActive ? 'active' : 'inactive'}`}
            title={isActive ? season.name : `Not available in ${season.name}`}
          >
            {compact ? season.short : season.name.slice(0, 2)}
          </span>
        )
      })}
    </span>
  )
}

export default SeasonBadges

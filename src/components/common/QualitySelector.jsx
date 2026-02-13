/**
 * QualitySelector - Radio button group for selecting item quality tier
 * Used for calculating quality-based prices and profit margins
 */
function QualitySelector({ value, onChange, name = 'quality' }) {
  const qualities = [
    { value: 'regular', label: '●', color: '#666' },
    { value: 'silver', label: '◆', color: '#9e9e9e' },
    { value: 'gold', label: '★', color: '#f57c00' },
    { value: 'iridium', label: '◆', color: '#9c27b0' }
  ]

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      {qualities.map(quality => (
        <label
          key={quality.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            cursor: 'pointer'
          }}
        >
          <input
            type="radio"
            name={name}
            value={quality.value}
            checked={value === quality.value}
            onChange={(e) => onChange(e.target.value)}
            style={{ cursor: 'pointer' }}
          />
          <span
            style={{
              fontSize: '0.875rem',
              color: quality.color,
              fontWeight: 600,
              position: 'relative',
              // Adjust vertical alignment for different symbols
              top: quality.value === 'regular' || quality.value === 'gold' ? '-2px' : '0'
            }}
          >
            {quality.label}
          </span>
        </label>
      ))}
    </div>
  )
}

export default QualitySelector

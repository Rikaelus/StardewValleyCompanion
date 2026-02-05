import './GiftCell.css'

const GIFT_CONFIG = {
  love: { symbol: '♥', label: 'Love' },
  like: { symbol: '+', label: 'Like' },
  neutral: { symbol: '•', label: 'Neutral' },
  dislike: { symbol: '-', label: 'Dislike' },
  hate: { symbol: '✕', label: 'Hate' }
}

function GiftCell({ preference }) {
  const config = GIFT_CONFIG[preference] || GIFT_CONFIG.neutral

  return (
    <span
      className={`gift-cell gift-${preference}`}
      title={config.label}
    >
      {config.symbol}
    </span>
  )
}

export default GiftCell

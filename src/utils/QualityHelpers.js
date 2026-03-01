/**
 * Get quality name from numeric quality value (0=regular, 1=silver, 2=gold, 4=iridium)
 */
export function getQualityName(quality) {
  switch (quality) {
    case 0: return ''
    case 1: return 'Silver or better'
    case 2: return 'Gold or better'
    case 4: return 'Iridium'
    default: return ''
  }
}

/**
 * Get quality symbol from numeric quality value
 */
export function getQualitySymbol(quality) {
  switch (quality) {
    case 0: return '●'
    case 1: return '◆'
    case 2: return '★'
    case 4: return '◆'
    default: return '●'
  }
}

/**
 * Get quality color from numeric quality value
 */
export function getQualityColor(quality) {
  switch (quality) {
    case 0: return '#666'
    case 1: return '#9e9e9e'
    case 2: return '#f57c00'
    case 4: return '#9c27b0'
    default: return '#666'
  }
}

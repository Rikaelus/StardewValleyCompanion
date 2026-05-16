import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './SeasonBadges.css'

/**
 * Display season availability badges for an item
 * Shows all 4 seasons with active/inactive state, plus optional Greenhouse / Ginger Island badges.
 * Each badge is clickable to show a tooltip popup.
 *
 * @param {Object} props
 * @param {Array<string>} props.seasons - Array of season names (e.g., ['spring', 'summer'])
 * @param {boolean} props.compact - Show abbreviated season names (Sp, Su, Fa, Wi) instead of full
 * @param {boolean} props.greenhouse - Show a Greenhouse badge (always active)
 * @param {boolean} props.gingerIsland - Show a Ginger Island badge (always active)
 */
function SeasonBadges({ seasons = [], compact = false, greenhouse = false, gingerIsland = false }) {
  const allSeasons = [
    { name: 'Spring', key: 'spring', short: 'Sp' },
    { name: 'Summer', key: 'summer', short: 'Su' },
    { name: 'Fall', key: 'fall', short: 'Fa' },
    { name: 'Winter', key: 'winter', short: 'Wi' }
  ]

  const normalizedSeasons = seasons.map(s => s.toLowerCase())

  const badges = allSeasons.map(season => {
    const isActive = normalizedSeasons.includes(season.key)
    return {
      key: season.key,
      className: `season-badge season-${season.key} ${isActive ? 'active' : 'inactive'}`,
      label: compact ? season.short : season.name.slice(0, 2),
      tooltip: isActive
        ? `Available in ${season.name} in Stardew Valley`
        : `Not available in ${season.name} in Stardew Valley`,
    }
  })

  if (greenhouse) {
    badges.push({
      key: 'greenhouse',
      className: 'season-badge season-greenhouse active',
      label: 'GH',
      tooltip: 'Available year-round in the Greenhouse',
    })
  }
  if (gingerIsland) {
    badges.push({
      key: 'island',
      className: 'season-badge season-island active',
      label: 'GI',
      tooltip: 'Available year-round on Ginger Island',
    })
  }

  return (
    <span className="season-badges">
      {badges.map(b => (
        <SeasonBadge key={b.key} className={b.className} label={b.label} tooltip={b.tooltip} />
      ))}
    </span>
  )
}

function SeasonBadge({ className, label, tooltip }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef(null)
  const popupRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popupEl = popupRef.current
    const popupWidth = popupEl ? popupEl.offsetWidth : 200

    let left = rect.left + rect.width / 2 - popupWidth / 2
    if (left < 8) left = 8
    if (left + popupWidth > window.innerWidth - 8) left = window.innerWidth - 8 - popupWidth

    setPosition({
      top: rect.top + window.scrollY - 8,
      left: left + window.scrollX,
    })
  }, [])

  useLayoutEffect(() => {
    if (isOpen) updatePosition()
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (popupRef.current?.contains(e.target)) return
      setIsOpen(false)
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        title={tooltip}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        style={{ cursor: 'pointer' }}
      >
        {label}
      </span>
      {isOpen && createPortal(
        <span
          ref={popupRef}
          className="info-tooltip-popup"
          style={{ top: position.top, left: position.left }}
        >
          {tooltip}
        </span>,
        document.body
      )}
    </>
  )
}

export default SeasonBadges

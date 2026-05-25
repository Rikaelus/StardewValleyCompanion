import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { TRACKER_MENU_GROUPS } from './trackerMenuData'
import { useTrackerCompletion } from '../../hooks/UseTrackerCompletion'
import './TrackerMenu.css'

function TrackerMenu({ isOpen, onClose }) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const panelRef = useRef(null)
  const location = useLocation()
  const completion = useTrackerCompletion()

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setIsClosing(false)
    } else if (shouldRender) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) onClose()
  }, [location.pathname])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || isClosing) return
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (e.target.closest('.header-btn-tracker')) return
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, isClosing, onClose])

  if (!shouldRender) return null

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className={`tracker-menu ${isClosing ? 'tracker-menu--closing' : ''}`} ref={panelRef}>
      <div className="tracker-menu-content">
        {TRACKER_MENU_GROUPS.map(group => (
          <div key={group.domain} className="tracker-menu-group">
            <h3 className="tracker-menu-group-heading">{group.domain}</h3>
            <ul className="tracker-menu-group-items">
              {group.items.map(item => {
                const counts = completion.get(item.path)
                const pct = counts
                  ? counts.total > 0 ? Math.floor((counts.done / counts.total) * 100) : 0
                  : null

                return (
                  <li key={item.label}>
                    {item.disabled ? (
                      <span className="tracker-menu-item tracker-menu-item--disabled">
                        {item.label}
                      </span>
                    ) : (
                      <Link
                        to={item.path}
                        className={`tracker-menu-item ${isActive(item.path) ? 'tracker-menu-item--active' : ''}`}
                        onClick={onClose}
                      >
                        {item.label}
                        {pct !== null && (
                          <span className={`tracker-menu-pct ${pct === 100 ? 'tracker-menu-pct--done' : ''}`}>
                            {pct}%
                          </span>
                        )}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TrackerMenu

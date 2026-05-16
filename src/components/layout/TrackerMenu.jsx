import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { TRACKER_MENU_ITEMS } from './trackerMenuData'
import './TrackerMenu.css'

function TrackerMenu({ isOpen, onClose }) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const panelRef = useRef(null)
  const location = useLocation()

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
      <ul className="tracker-menu-items">
        {TRACKER_MENU_ITEMS.map(item => (
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
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TrackerMenu

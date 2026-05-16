import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MEGA_MENU_GROUPS } from './megaMenuData'
import './MegaMenu.css'

function MegaMenu({ isOpen, onClose }) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const panelRef = useRef(null)
  const location = useLocation()

  // Handle open/close transitions
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

  // Close on route change
  useEffect(() => {
    if (isOpen) onClose()
  }, [location.pathname])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Close on click outside
  useEffect(() => {
    if (!isOpen || isClosing) return
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        // Don't close if clicking the Browse button itself (parent handles toggle)
        if (e.target.closest('.header-btn-browse')) return
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, isClosing, onClose])

  if (!shouldRender) return null

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <div className={`mega-menu ${isClosing ? 'mega-menu--closing' : ''}`} ref={panelRef}>
      <div className="mega-menu-content">
        {MEGA_MENU_GROUPS.map(group => (
          <div key={group.domain} className="mega-menu-group">
            <h3 className="mega-menu-group-heading">{group.domain}</h3>
            <ul className="mega-menu-group-items">
              {group.items.map(item => (
                <li key={item.label}>
                  {item.disabled ? (
                    <span className="mega-menu-item mega-menu-item--disabled">
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      to={item.path}
                      className={`mega-menu-item ${isActive(item.path) ? 'mega-menu-item--active' : ''}`}
                      onClick={onClose}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MegaMenu

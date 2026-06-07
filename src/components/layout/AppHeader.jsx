import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../../contexts/PlayerContext'
import './AppHeader.css'

function AppHeader({ onSearchOpen, onToggleMegaMenu, onToggleTrackerMenu, onToggleCharacterBar, megaMenuOpen, trackerMenuOpen, characterBarOpen }) {
  const { player } = usePlayer()
  const headerRef = useRef(null)
  const [navOpen, setNavOpen] = useState(false)
  const hamburgerRef = useRef(null)
  const [dropdownPos, setDropdownPos] = useState({ left: 0, top: 0 })

  useEffect(() => {
    const update = () => {
      if (headerRef.current) {
        const bottom = headerRef.current.getBoundingClientRect().bottom
        document.documentElement.style.setProperty('--header-bottom', `${bottom}px`)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (headerRef.current) ro.observe(headerRef.current)
    return () => ro.disconnect()
  }, [])

  // Close nav dropdown on outside click; reposition or close on resize while open
  useEffect(() => {
    if (!navOpen) return
    const handleResize = () => {
      if (window.innerWidth > 1050) {
        setNavOpen(false)
        return
      }
      if (hamburgerRef.current) {
        const r = hamburgerRef.current.getBoundingClientRect()
        setDropdownPos({ left: r.left, top: r.bottom })
      }
    }
    const handleClick = (e) => {
      if (!e.target.closest('.header-nav-menu')) setNavOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('resize', handleResize)
    }
  }, [navOpen])

  const handleNavItem = (action) => {
    setNavOpen(false)
    action()
  }

  return (
    <header className="app-header" ref={headerRef}>
      <div className="header-content">
        <Link to="/" className="header-branding">
          <img src="/assets/branding/stardew_logo.png" alt="Stardew Valley" className="header-logo header-logo--full" />
          <span className="header-companion">COMPANION</span>
          <span className="header-branding-short">SVC</span>
        </Link>

        <div className="header-actions">
          {/* Full nav — hidden on narrow screens */}
          <Link to="/" className="header-btn header-btn-home header-nav-wide">Home</Link>
          <Link to="/world" className="header-btn header-btn-world header-nav-wide">World</Link>
          <button
            className={`header-btn header-btn-browse header-nav-wide ${megaMenuOpen ? 'header-btn--active' : ''}`}
            onClick={onToggleMegaMenu}
            type="button"
          >Browse</button>
          <button
            className={`header-btn header-btn-tracker header-nav-wide ${trackerMenuOpen ? 'header-btn--active' : ''}`}
            onClick={onToggleTrackerMenu}
            type="button"
          >Tracker</button>
          <Link to="/todo" className="header-btn header-btn-todo header-nav-wide">To-Do</Link>

          {/* Hamburger — shown on narrow screens */}
          <div className="header-nav-menu">
            <button
              ref={hamburgerRef}
              className={`header-btn header-nav-hamburger ${navOpen ? 'header-btn--active' : ''}`}
              onClick={() => {
                if (!navOpen && hamburgerRef.current) {
                  const r = hamburgerRef.current.getBoundingClientRect()
                  setDropdownPos({ left: r.left, top: r.bottom })
                }
                setNavOpen(v => !v)
              }}
              type="button"
              aria-label="Navigation menu"
            >
              <i className="fa-solid fa-bars" />
            </button>
            {navOpen && (
              <div className="header-nav-dropdown" style={{ left: dropdownPos.left, top: dropdownPos.top }}>
                <Link to="/" className="header-nav-item" onClick={() => setNavOpen(false)}>Home</Link>
                <Link to="/world" className="header-nav-item" onClick={() => setNavOpen(false)}>World</Link>
                <button className={`header-nav-item ${megaMenuOpen ? 'header-nav-item--active' : ''}`} onClick={() => handleNavItem(onToggleMegaMenu)} type="button">Browse</button>
                <button className={`header-nav-item ${trackerMenuOpen ? 'header-nav-item--active' : ''}`} onClick={() => handleNavItem(onToggleTrackerMenu)} type="button">Tracker</button>
                <Link to="/todo" className="header-nav-item" onClick={() => setNavOpen(false)}>To-Do</Link>
              </div>
            )}
          </div>

          <button
            className="header-btn header-btn-search"
            onClick={onSearchOpen}
            aria-label="Search items (Ctrl+K)"
            title="Search items (Ctrl+K)"
            type="button"
          >
            <i className="fa-solid fa-magnifying-glass" />
          </button>

          <button
            className={`header-btn header-btn-character ${characterBarOpen ? 'header-btn--active' : ''}`}
            onClick={onToggleCharacterBar}
            type="button"
            title="Character settings"
          >
            <i className="fa-solid fa-user" />
            {player.name ? (
              <span className="header-character-info">
                <span className="header-character-name">{player.name}</span>
                {player.saveData?.date && (
                  <span className="header-character-date">
                    {player.saveData.date.season.charAt(0).toUpperCase() + player.saveData.date.season.slice(1)} {player.saveData.date.day}, Year {player.saveData.date.year}
                  </span>
                )}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  )
}

export default AppHeader

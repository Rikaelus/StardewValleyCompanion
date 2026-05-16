import { Link } from 'react-router-dom'
import { usePlayer } from '../../contexts/PlayerContext'
import './AppHeader.css'

function AppHeader({ onSearchOpen, onToggleMegaMenu, onToggleTrackerMenu, onToggleCharacterBar, megaMenuOpen, trackerMenuOpen, characterBarOpen }) {
  const { player } = usePlayer()

  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="header-branding">
          <img src="/assets/branding/stardew_logo.png" alt="Stardew Valley" className="header-logo" />
          <span className="header-companion">COMPANION</span>
        </Link>

        <div className="header-actions">
          <Link to="/" className="header-btn header-btn-home">
            Home
          </Link>

          <button
            className={`header-btn header-btn-browse ${megaMenuOpen ? 'header-btn--active' : ''}`}
            onClick={onToggleMegaMenu}
            type="button"
          >
            Browse
          </button>

          <button
            className={`header-btn header-btn-tracker ${trackerMenuOpen ? 'header-btn--active' : ''}`}
            onClick={onToggleTrackerMenu}
            type="button"
          >
            Tracker
          </button>

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
            {player.name && <span className="header-character-name">{player.name}</span>}
          </button>
        </div>
      </div>
    </header>
  )
}

export default AppHeader

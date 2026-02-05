import { useState, useEffect, useRef } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import './CharacterBar.css'

function CharacterBar() {
  const { player, setPlayer, setProfession } = usePlayer()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const containerRef = useRef(null)

  const closeDropdown = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsExpanded(false)
      setIsClosing(false)
    }, 220) // Slightly longer than 200ms animation to prevent flicker
  }

  const toggleDropdown = () => {
    if (isExpanded) {
      closeDropdown()
    } else {
      setIsExpanded(true)
    }
  }

  const handleNameChange = (e) => {
    setPlayer({ name: e.target.value })
  }

  const handleFarmNameChange = (e) => {
    setPlayer({ farmName: e.target.value })
  }

  const toggleProfession = (profession) => {
    const newValue = !player.professions[profession]

    // Handle profession dependencies
    if (profession === 'angler' && newValue) {
      // Angler requires Fisher, so enable Fisher too
      setProfession('fisher', true)
    } else if (profession === 'fisher' && !newValue) {
      // If disabling Fisher, must disable Angler too
      setProfession('angler', false)
    }

    setProfession(profession, newValue)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isExpanded || isClosing) return

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded, isClosing])

  return (
    <div className="character-bar" ref={containerRef}>
      <button
        className="character-bar-toggle"
        onClick={toggleDropdown}
        aria-expanded={isExpanded}
      >
        <div className="character-bar-summary">
          <span className="character-icon">👤</span>
          <div className="character-info">
            <span className="character-name">
              {player.name || 'Set Character Info'}
            </span>
            {player.farmName && (
              <span className="farm-name">{player.farmName} Farm</span>
            )}
          </div>
        </div>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className={`character-details ${isClosing ? 'closing' : ''}`}>
          <div className="character-section">
            <h3>Character Information</h3>
            <div className="character-fields">
              <div className="field">
                <label>Character Name</label>
                <input
                  type="text"
                  value={player.name}
                  onChange={handleNameChange}
                  placeholder="Enter your character name..."
                />
              </div>
              <div className="field">
                <label>Farm Name</label>
                <input
                  type="text"
                  value={player.farmName}
                  onChange={handleFarmNameChange}
                  placeholder="Enter your farm name..."
                />
              </div>
            </div>
          </div>

          <div className="character-section">
            <h3>Professions (Price Modifiers)</h3>

            <div className="profession-category">
              <h4>Farming</h4>
              <div className="professions-grid">
                <label className="profession-checkbox">
                  <input
                    type="checkbox"
                    checked={player.professions.rancher}
                    onChange={() => toggleProfession('rancher')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Rancher</span>
                    <span className="profession-bonus">Animal products worth 20% more</span>
                  </div>
                </label>

                <label className="profession-checkbox">
                  <input
                    type="checkbox"
                    checked={player.professions.artisan}
                    onChange={() => toggleProfession('artisan')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Artisan</span>
                    <span className="profession-bonus">Artisan goods worth 40% more</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="profession-category">
              <h4>Fishing</h4>
              <div className="professions-grid">
                <label className="profession-checkbox">
                  <input
                    type="checkbox"
                    checked={player.professions.fisher}
                    onChange={() => toggleProfession('fisher')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Fisher</span>
                    <span className="profession-bonus">Fish worth 25% more</span>
                  </div>
                </label>

                <label className="profession-checkbox">
                  <input
                    type="checkbox"
                    checked={player.professions.angler}
                    onChange={() => toggleProfession('angler')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Angler</span>
                    <span className="profession-bonus">Fish worth 50% more (requires Fisher, replaces bonus)</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="profession-category">
              <h4>Mining</h4>
              <div className="professions-grid">
                <label className="profession-checkbox">
                  <input
                    type="checkbox"
                    checked={player.professions.blacksmith}
                    onChange={() => toggleProfession('blacksmith')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Blacksmith</span>
                    <span className="profession-bonus">Bars worth 50% more</span>
                  </div>
                </label>

                <label className="profession-checkbox">
                  <input
                    type="checkbox"
                    checked={player.professions.gemologist}
                    onChange={() => toggleProfession('gemologist')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Gemologist</span>
                    <span className="profession-bonus">Gems worth 30% more</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CharacterBar

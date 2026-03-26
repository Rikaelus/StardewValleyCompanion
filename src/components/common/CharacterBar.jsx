import { useState, useEffect, useRef } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import { parseSaveFile } from '../../utils/SaveFileParser'
import './CharacterBar.css'

const SEASON_LABELS = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' }

function ImportSection() {
  const { player, importSaveData, clearSaveData } = usePlayer()
  const fileInputRef = useRef(null)
  const [importState, setImportState] = useState('idle') // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('')

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportState('loading')
    setErrorMessage('')

    try {
      const text = await file.text()
      const parsed = parseSaveFile(text)
      importSaveData(parsed)
      setImportState('idle')
    } catch (err) {
      setImportState('error')
      setErrorMessage(err.message || 'Failed to parse save file.')
    }

    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const saveData = player.saveData

  if (saveData) {
    const fishCount = Object.keys(saveData.fishCaught || {}).length
    const friendCount = Object.keys(saveData.friendships || {}).length
    const season = SEASON_LABELS[saveData.date?.season] || saveData.date?.season
    const dateStr = `Year ${saveData.date?.year}, ${season} ${saveData.date?.day}`
    const hasBundles = saveData.source === 'SaveGame'

    return (
      <div className="character-section import-section">
        <h3>Save File Import</h3>
        <div className="import-summary">
          <div className="import-summary-line">{dateStr}</div>
          <div className="import-summary-details">
            {Object.entries(saveData.skills || {}).map(([skill, level]) => (
              <span key={skill} className="import-stat">
                {skill.charAt(0).toUpperCase() + skill.slice(1)} {level}
              </span>
            ))}
          </div>
          <div className="import-summary-details">
            <span className="import-stat">{fishCount} fish caught</span>
            <span className="import-stat">{friendCount} friendships</span>
            {hasBundles && <span className="import-stat">Bundles imported</span>}
          </div>
          <div className="import-meta">
            Imported from {saveData.source === 'SaveGame' ? 'full save' : 'SaveGameInfo'}
          </div>
        </div>
        <div className="import-actions">
          <button
            className="import-btn import-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Re-import
          </button>
          <button
            className="import-btn import-btn-clear"
            onClick={clearSaveData}
          >
            Clear Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="import-file-input"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="character-section import-section">
      <h3>Save File Import</h3>
      <p className="import-description">
        Upload your save file to auto-fill character info, professions, and track progress.
      </p>
      <div className="import-actions">
        <button
          className="import-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={importState === 'loading'}
        >
          {importState === 'loading' ? 'Parsing...' : 'Choose Save File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="import-file-input"
          onChange={handleFileSelect}
        />
      </div>
      {importState === 'error' && (
        <div className="import-error">{errorMessage}</div>
      )}
      <p className="import-privacy">
        Your save file is processed locally and never uploaded.
      </p>
    </div>
  )
}

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
          <ImportSection />

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
            <h3>Memberships & Affiliations</h3>
            <div className="professions-grid">
              <label className="profession-checkbox">
                <input
                  type="checkbox"
                  checked={player.jojaMember}
                  onChange={() => setPlayer({ jojaMember: !player.jojaMember })}
                />
                <div className="profession-info">
                  <span className="profession-name">Joja Member</span>
                  <span className="profession-bonus">JojaMart prices are 20% lower</span>
                </div>
              </label>
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
                    checked={player.professions.tiller}
                    onChange={() => toggleProfession('tiller')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Tiller</span>
                    <span className="profession-bonus">Crops worth 10% more</span>
                  </div>
                </label>

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
              <h4>Foraging</h4>
              <div className="professions-grid">
                <label className="profession-checkbox">
                  <input
                    type="checkbox"
                    checked={player.professions.tapper}
                    onChange={() => toggleProfession('tapper')}
                  />
                  <div className="profession-info">
                    <span className="profession-name">Tapper</span>
                    <span className="profession-bonus">Syrups worth 25% more</span>
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

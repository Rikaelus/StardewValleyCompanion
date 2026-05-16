import { useState, useEffect, useRef } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import { parseSaveFile } from '../../utils/SaveFileParser'
import './CharacterBar.css'

const SEASON_LABELS = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' }

// Full skill tree: each skill has two level-5 choices, each branching into two level-10 choices
const PROF_ICON = (name) => `/assets/icons/professions/${name}.png`
const SKILL_ICON = (name) => `/assets/icons/skills/${name}SkillIcon.png`

const SKILL_TREES = [
  { skill: 'Farming', icon: SKILL_ICON('Farming'), branches: [
    { key: 'rancher', label: 'Rancher', icon: PROF_ICON('Rancher'), desc: 'Animal products worth 20% more', children: [
      { key: 'coopmaster', label: 'Coopmaster', icon: PROF_ICON('Coopmaster'), desc: 'Befriend coop animals faster, incubation halved' },
      { key: 'shepherd', label: 'Shepherd', icon: PROF_ICON('Shepherd'), desc: 'Befriend barn animals faster, sheep produce faster' },
    ]},
    { key: 'tiller', label: 'Tiller', icon: PROF_ICON('Tiller'), desc: 'Crops worth 10% more', children: [
      { key: 'artisan', label: 'Artisan', icon: PROF_ICON('Artisan'), desc: 'Artisan goods worth 40% more' },
      { key: 'agriculturist', label: 'Agriculturist', icon: PROF_ICON('Agriculturist'), desc: 'Crops grow 10% faster' },
    ]},
  ]},
  { skill: 'Fishing', icon: SKILL_ICON('Fishing'), branches: [
    { key: 'fisher', label: 'Fisher', icon: PROF_ICON('Fisher'), desc: 'Fish worth 25% more', children: [
      { key: 'angler', label: 'Angler', icon: PROF_ICON('Angler'), desc: 'Fish worth 50% more' },
      { key: 'pirate', label: 'Pirate', icon: PROF_ICON('Pirate'), desc: 'Chance to find treasure doubled' },
    ]},
    { key: 'trapper', label: 'Trapper', icon: PROF_ICON('Trapper'), desc: 'Resources needed to craft crab pots reduced', children: [
      { key: 'mariner', label: 'Mariner', icon: PROF_ICON('Mariner'), desc: 'Crab pots no longer produce junk' },
      { key: 'luremaster', label: 'Luremaster', icon: PROF_ICON('Luremaster'), desc: 'Crab pots no longer require bait' },
    ]},
  ]},
  { skill: 'Foraging', icon: SKILL_ICON('Foraging'), branches: [
    { key: 'forester', label: 'Forester', icon: PROF_ICON('Forester'), desc: '25% more wood from trees', children: [
      { key: 'lumberjack', label: 'Lumberjack', icon: PROF_ICON('Lumberjack'), desc: 'All trees have a chance to drop hardwood' },
      { key: 'tapper', label: 'Tapper', icon: PROF_ICON('Tapper'), desc: 'Syrups worth 25% more' },
    ]},
    { key: 'gatherer', label: 'Gatherer', icon: PROF_ICON('Gatherer'), desc: 'Chance for double harvest of forage', children: [
      { key: 'botanist', label: 'Botanist', icon: PROF_ICON('Botanist'), desc: 'Forage is always highest quality' },
      { key: 'tracker', label: 'Tracker', icon: PROF_ICON('Tracker'), desc: 'Location of forageable items revealed' },
    ]},
  ]},
  { skill: 'Mining', icon: SKILL_ICON('Mining'), branches: [
    { key: 'miner', label: 'Miner', icon: PROF_ICON('Miner'), desc: '+1 ore per vein', children: [
      { key: 'blacksmith', label: 'Blacksmith', icon: PROF_ICON('Blacksmith'), desc: 'Bars worth 50% more' },
      { key: 'prospector', label: 'Prospector', icon: PROF_ICON('Prospector'), desc: 'Chance to find coal doubled' },
    ]},
    { key: 'geologist', label: 'Geologist', icon: PROF_ICON('Geologist'), desc: 'Chance for gems to appear in pairs', children: [
      { key: 'excavator', label: 'Excavator', icon: PROF_ICON('Excavator'), desc: 'Geode find chance doubled' },
      { key: 'gemologist', label: 'Gemologist', icon: PROF_ICON('Gemologist'), desc: 'Gems worth 30% more' },
    ]},
  ]},
  { skill: 'Combat', icon: SKILL_ICON('Combat'), branches: [
    { key: 'fighter', label: 'Fighter', icon: PROF_ICON('Fighter'), desc: '+10% damage, +15 HP', children: [
      { key: 'brute', label: 'Brute', icon: PROF_ICON('Brute'), desc: '+15% damage' },
      { key: 'defender', label: 'Defender', icon: PROF_ICON('Defender'), desc: '+25 HP' },
    ]},
    { key: 'scout', label: 'Scout', icon: PROF_ICON('Scout'), desc: '+50% crit chance', children: [
      { key: 'acrobat', label: 'Acrobat', icon: PROF_ICON('Acrobat'), desc: 'Cooldown on special moves halved' },
      { key: 'desperado', label: 'Desperado', icon: PROF_ICON('Desperado'), desc: 'Critical strikes are deadlier' },
    ]},
  ]},
]

function ImportSection() {
  const { player, importSaveData, clearSaveData } = usePlayer()
  const fileInputRef = useRef(null)
  const [importState, setImportState] = useState('idle') // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = async (file) => {
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
  }

  const handleFileSelect = (e) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const saveData = player.saveData

  if (saveData) {
    const fishCount = Object.keys(saveData.fishCaught || {}).length
    const friendCount = Object.keys(saveData.friendships || {}).length
    const season = SEASON_LABELS[saveData.date?.season] || saveData.date?.season
    const dateStr = `Year ${saveData.date?.year}, ${season} ${saveData.date?.day}`
    const hasBundles = saveData.source === 'SaveGame'

    return (
      <div className="character-section import-section import-section--loaded">
        <h3>Save Upload</h3>
        <div
          className={`import-dropzone import-dropzone--loaded ${isDragOver ? 'import-dropzone--active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="import-dropzone-icon-col">
            <i className="fa-solid fa-file-arrow-up" />
          </div>
          <div className="import-loaded-content">
            <div className="import-loaded-layout">
              <div className="import-identity">
                <div className="import-identity-name">
                  {player.name}{player.farmName ? ` — ${player.farmName} Farm` : ''}
                </div>
                <div className="import-date">{dateStr}</div>
              </div>
              <div className="import-skills">
                {Object.entries(saveData.skills || {}).map(([skill, level]) => (
                  <div key={skill} className="import-skill">
                    <span className="import-skill-label">{skill.charAt(0).toUpperCase() + skill.slice(1)}</span>
                    <span className="import-skill-level">{level}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="import-stats-row">
              <span className="import-stat">{fishCount} fish caught</span>
              <span className="import-stat">{friendCount} friendships</span>
              {hasBundles && <span className="import-stat">Bundles imported</span>}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="import-file-input"
            onChange={handleFileSelect}
          />
        </div>
        <div className="import-footer">
          <div className="import-actions">
            <button
              className="import-btn import-btn-clear"
              onClick={clearSaveData}
            >
              Clear Character Data
            </button>
          </div>
          <span className="import-meta">
            From {saveData.source === 'SaveGame' ? 'full save' : 'SaveGameInfo'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="character-section import-section">
      <h3>Save Upload</h3>
      <p className="import-section-desc">Upload your save file to set character info, professions, and unlock progress tracking for fish, bundles, collections, and more.</p>
      <div
        className={`import-dropzone ${isDragOver ? 'import-dropzone--active' : ''} ${importState === 'loading' ? 'import-dropzone--loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => importState !== 'loading' && fileInputRef.current?.click()}
      >
        <div className="import-dropzone-icon-col">
          <i className={`fa-solid ${importState === 'loading' ? 'fa-spinner fa-spin' : 'fa-file-arrow-up'}`} />
        </div>
        <div className="import-dropzone-content">
          <span className="import-dropzone-text">
            {importState === 'loading'
              ? 'Parsing save file...'
              : 'Drop save file here or click to browse'}
          </span>
          <span className="import-dropzone-hint">
            Processed locally — never uploaded
          </span>
          <span className="import-dropzone-hint">
            Upload the full save file — named like <b>CharName_123456789</b> (no extension).
          </span>
          <span className="import-dropzone-hint">
            <b>Windows:</b> %AppData%/StardewValley/Saves &nbsp;
            <b>Mac/Linux:</b> ~/.config/StardewValley/Saves
          </span>
        </div>
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
    </div>
  )
}

function CharacterBar({ isOpen, onClose }) {
  const { player, setProfession, setPlayer } = usePlayer()
  const [shouldRender, setShouldRender] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [activeTab, setActiveTab] = useState('professions')
  const containerRef = useRef(null)

  // Handle open/close with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setIsClosing(false)
    } else if (shouldRender) {
      setIsClosing(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsClosing(false)
      }, 220)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const hasSaveData = !!player.saveData

  const toggleProfession = (key) => {
    if (hasSaveData) return

    const newValue = !player.professions[key]

    for (const { branches } of SKILL_TREES) {
      const [branchA, branchB] = branches

      // Is it a level-5 profession?
      for (const branch of branches) {
        if (branch.key !== key) continue
        const sibling = branch === branchA ? branchB : branchA

        if (newValue) {
          // Deactivate the other level-5 branch and all its children
          setProfession(sibling.key, false)
          for (const child of sibling.children) {
            setProfession(child.key, false)
          }
        } else {
          // Deactivate this branch's children
          for (const child of branch.children) {
            setProfession(child.key, false)
          }
        }
        setProfession(key, newValue)
        return
      }

      // Is it a level-10 profession?
      for (const branch of branches) {
        for (const child of branch.children) {
          if (child.key !== key) continue
          const siblingChild = branch.children.find(c => c.key !== key)

          if (newValue) {
            // Activate parent branch, deactivate sibling branch + its children
            const sibling = branch === branchA ? branchB : branchA
            setProfession(branch.key, true)
            setProfession(sibling.key, false)
            for (const sc of sibling.children) {
              setProfession(sc.key, false)
            }
            // Deactivate the other level-10 under same parent
            if (siblingChild) setProfession(siblingChild.key, false)
          }
          setProfession(key, newValue)
          return
        }
      }
    }
  }

  useEffect(() => {
    if (!isOpen || isClosing) return

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        if (event.target.closest('.header-btn-character')) return
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, isClosing, onClose])

  if (!shouldRender) return null

  return (
    <div className="character-bar" ref={containerRef}>
      <div className={`character-details ${isClosing ? 'closing' : ''}`}>
        <button className="character-close-btn" onClick={onClose} type="button" aria-label="Close">×</button>
        <ImportSection />

          <div className="character-tabs">
            <div className="character-tab-bar">
              <button
                className={`character-tab ${activeTab === 'professions' ? 'character-tab--active' : ''}`}
                onClick={() => setActiveTab('professions')}
                type="button"
              >Professions</button>
              <button
                className={`character-tab ${activeTab === 'other' ? 'character-tab--active' : ''}`}
                onClick={() => setActiveTab('other')}
                type="button"
              >Other</button>
            </div>

            <div className="character-tab-content">
              {activeTab === 'professions' && (
                <div className="skill-trees">
                  {hasSaveData && (
                    <p className="tab-save-notice">Selections reflect your uploaded save file.</p>
                  )}
                  {SKILL_TREES.map(({ skill, icon, branches }) => {
                    const skillLevel = player.saveData?.skills?.[skill.toLowerCase()] ?? 0
                    const maxLevel = 10
                    return (
                    <div key={skill} className="skill-tree">
                      <h4 className="skill-tree-header">
                        <img src={icon} alt="" className="skill-tree-icon" />
                        {skill}
                        {player.saveData?.skills && (
                        <span className="skill-level-stars">
                          {Array.from({ length: maxLevel }, (_, i) => (
                            <span key={i} className={`skill-star ${i < skillLevel ? 'skill-star--filled' : ''}`}>★</span>
                          ))}
                          <span className="skill-level-num">{skillLevel}/10</span>
                        </span>
                        )}
                      </h4>
                      <div className="skill-tree-branches">
                        {branches.map((branch, branchIdx) => {
                          const branchActive = player.professions[branch.key]
                          const siblingBranch = branches[1 - branchIdx]
                          const siblingActive = player.professions[siblingBranch.key]
                          const branchLocked = siblingActive && !branchActive
                          return (
                            <div key={branch.key} className={`skill-branch ${branchLocked ? 'skill-branch--locked' : ''}`}>
                              <label className={`profession-node profession-node--lv5 ${branchActive ? 'profession-node--active' : ''} ${hasSaveData ? 'profession-node--readonly' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={branchActive}
                                  onChange={() => toggleProfession(branch.key)}
                                  disabled={hasSaveData}
                                />
                                <img src={branch.icon} alt="" className="profession-node-icon profession-node-icon--lv5" />
                                <div className="profession-node-info">
                                  <span className="profession-node-name">{branch.label}</span>
                                  <span className="profession-node-desc">{branch.desc}</span>
                                </div>
                              </label>
                              <div className={`skill-branch-children ${branchActive ? '' : 'skill-branch-children--disabled'}`}>
                                {branch.children.map((child, childIdx) => {
                                  const childActive = player.professions[child.key]
                                  const siblingChild = branch.children[1 - childIdx]
                                  const siblingChildActive = player.professions[siblingChild.key]
                                  const childLocked = siblingChildActive && !childActive
                                  return (
                                    <label key={child.key} className={`profession-node profession-node--lv10 ${childActive ? 'profession-node--active' : ''} ${childLocked ? 'profession-node--locked' : ''} ${hasSaveData ? 'profession-node--readonly' : ''}`}>
                                      <input
                                        type="checkbox"
                                        checked={childActive}
                                        onChange={() => toggleProfession(child.key)}
                                        disabled={hasSaveData || !branchActive}
                                      />
                                      <img src={child.icon} alt="" className="profession-node-icon profession-node-icon--lv10" />
                                      <div className="profession-node-info">
                                        <span className="profession-node-name">{child.label}</span>
                                        <span className="profession-node-desc">{child.desc}</span>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}

              {activeTab === 'other' && (
                <div className="character-other-tab">
                  {hasSaveData && (
                    <p className="tab-save-notice">Selections reflect your uploaded save file.</p>
                  )}
                  <h4 className="character-other-heading">Memberships</h4>
                  <div className="professions-grid">
                    <label className={`profession-checkbox ${hasSaveData ? 'profession-checkbox--readonly' : ''}`}>
                      <input
                        type="checkbox"
                        checked={player.jojaMember}
                        onChange={() => !hasSaveData && setPlayer({ jojaMember: !player.jojaMember })}
                        disabled={hasSaveData}
                      />
                      <div className="profession-info">
                        <span className="profession-name">Joja Member</span>
                        <span className="profession-bonus">JojaMart prices are 20% lower</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}

export default CharacterBar


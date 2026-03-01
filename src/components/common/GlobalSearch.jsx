import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import { createPortal } from 'react-dom'
import { useEntities } from '../../contexts/EntityContext'
import { useModalStack } from '../../contexts/ModalContext'
import { useDebounce } from '../../hooks/useDebounce'
import UniversalModal from './UniversalModal'
import './GlobalSearch.css'

const TYPE_LABELS = {
  'fish': 'Fish',
  'artisan': 'Artisan',
  'forage': 'Forage',
  'fruit': 'Fruit',
  'vegetable': 'Vegetable',
  'flower': 'Flower',
  'seed': 'Seed',
  'mineral': 'Mineral',
  'metal-bar': 'Metal Bar',
  'monster-loot': 'Monster Loot',
  'resource': 'Resource',
  'big-craftable': 'Big Craftable',
  'animal-product': 'Animal Product',
  'tree-fruit': 'Tree Fruit',
  'hat': 'Hat',
  'store': 'Shop',
  'buff': 'Buff',
  'event': 'Event',
  'villager': 'Villager',
}

function GlobalSearch({ isOpen, onClose }) {
  const searchId = useId()
  const { items, stores } = useEntities()
  const { pushModal, popModal, getModalIndex, isTopModal } = useModalStack()

  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [selectedItem, setSelectedItem] = useState(null)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  const inputRef = useRef(null)
  const resultsRef = useRef(null)

  const debouncedQuery = useDebounce(query, 150)

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setHighlightedIndex(0)
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
  }, [isOpen, shouldRender])

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && shouldRender) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen, shouldRender])

  // Register in modal stack
  useEffect(() => {
    if (isOpen) {
      pushModal(searchId)
      return () => popModal(searchId)
    }
  }, [isOpen, searchId, pushModal, popModal])

  // Escape to close (only if top modal and no item modal is open)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && isTopModal(searchId) && !itemModalOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, searchId, isTopModal, itemModalOpen])

  // Compute filtered results
  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return []

    const storeList = Object.values(stores || {})
    const searchable = [...items, ...storeList]

    const filtered = searchable.filter(item => {
      if (item.isGeneric || item.isHidden) return false
      if (item.name?.toLowerCase().includes(q)) return true
      const label = TYPE_LABELS[item.type || item.entityType]
      return label?.toLowerCase().includes(q)
    })

    // Sort: name prefix > name substring > category match, then alphabetically within each tier
    filtered.sort((a, b) => {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      const aNameMatch = aName.includes(q)
      const bNameMatch = bName.includes(q)
      const aPrefix = aName.startsWith(q)
      const bPrefix = bName.startsWith(q)
      const aTier = aPrefix ? 0 : aNameMatch ? 1 : 2
      const bTier = bPrefix ? 0 : bNameMatch ? 1 : 2
      if (aTier !== bTier) return aTier - bTier
      return aName.localeCompare(bName)
    })

    return filtered
  }, [debouncedQuery, items])

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [results])

  // Scroll highlighted item into view
  useEffect(() => {
    if (resultsRef.current) {
      const rows = resultsRef.current.querySelectorAll('.search-result-row')
      rows[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  const openItem = useCallback((item) => {
    setSelectedItem(item)
    setItemModalOpen(true)
    onClose()
  }, [onClose])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[highlightedIndex]) {
      e.preventDefault()
      openItem(results[highlightedIndex])
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && isTopModal(searchId)) {
      onClose()
    }
  }

  const stackIndex = getModalIndex(searchId)
  const zIndex = 1000 + stackIndex * 10

  return (
    <>
      {shouldRender && createPortal(
        <div
          className={`search-overlay${isClosing ? ' closing' : ''}`}
          onClick={handleOverlayClick}
          style={{ zIndex }}
        >
          <div className={`search-box${isClosing ? ' closing' : ''}`}>
            <div className="search-input-row">
              <span className="search-icon">&#128269;</span>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                placeholder="Search items..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  className="search-clear"
                  onClick={() => { setQuery(''); inputRef.current?.focus() }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            {results.length > 0 && (
              <ul className="search-results" ref={resultsRef} role="listbox">
                {results.map((item, idx) => {
                  const iconPath = item.icon
                    ? (item.icon.startsWith('/') ? item.icon : `/${item.icon}`)
                    : null
                  const categoryLabel = TYPE_LABELS[item.type || item.entityType] || ''

                  return (
                    <li
                      key={item.id}
                      className={`search-result-row${idx === highlightedIndex ? ' highlighted' : ''}`}
                      role="option"
                      aria-selected={idx === highlightedIndex}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => openItem(item)}
                    >
                      <div className="search-result-icon">
                        {iconPath
                          ? <img src={iconPath} alt="" width={24} height={24} />
                          : <span className="search-result-icon-placeholder" />
                        }
                      </div>
                      <span className="search-result-name">{item.name}</span>
                      {categoryLabel && (
                        <span className="search-result-category">{categoryLabel}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {debouncedQuery.trim() && results.length === 0 && (
              <div className="search-empty">No items found for &ldquo;{debouncedQuery.trim()}&rdquo;</div>
            )}
          </div>
        </div>,
        document.body
      )}

      {selectedItem && (
        <UniversalModal
          entity={selectedItem}
          isOpen={itemModalOpen}
          onClose={() => {
            setItemModalOpen(false)
            setSelectedItem(null)
          }}
        />
      )}
    </>
  )
}

export default GlobalSearch

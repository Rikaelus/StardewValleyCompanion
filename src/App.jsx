import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, memo } from 'react'
import FishPage from './components/fish/FishPage'
import ArtisanPage from './components/artisan/ArtisanPage'
import ForagePage from './components/forage/ForagePage'
import CropsPage from './components/crops/CropsPage'
import SeedsPage from './components/seeds/SeedsPage'
import FurniturePage from './components/furniture/FurniturePage'
import HatsPage from './components/hats/HatsPage'
import Footer from './components/layout/Footer'
import CharacterBar from './components/common/CharacterBar'
import GlobalSearch from './components/common/GlobalSearch'
import UniversalModal from './components/common/UniversalModal'
import { ModalProvider, useModal } from './contexts/ModalContext'
import { PlayerProvider } from './contexts/PlayerContext'
import { EntityProvider } from './contexts/EntityContext'

const NAV_ITEMS = [
  {
    label: 'Farming',
    children: [
      { label: 'Crops', path: '/crops' },
      { label: 'Seeds', path: '/seeds' },
      { label: 'Trees', disabled: true },
      { label: 'Tree Fruit', disabled: true },
      { label: 'Artisan Goods', path: '/artisan' },
    ]
  },
  {
    label: 'Fishing',
    children: [
      { label: 'Fish', path: '/fish' },
      { label: 'Bait', disabled: true },
      { label: 'Tackle', disabled: true },
    ]
  },
  { label: 'Foraging', path: '/forage' },
  {
    label: 'Clothing & Décor',
    children: [
      { label: 'Hats', path: '/hats' },
      { label: 'Furniture', path: '/furniture' },
    ]
  },
  { label: 'Bundles', path: '/bundles' },
  { label: 'Villagers', path: '/villagers' },
]

function Navigation({ onSearchOpen }) {
  const location = useLocation()
  const [openDropdown, setOpenDropdown] = useState(null)
  const navRef = useRef(null)

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const isDropdownActive = (children) => {
    return children.some(child => child.path && isActive(child.path))
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-branding">
          <img src="/assets/branding/stardew_logo.png" alt="Stardew Valley" className="header-logo" />
          <span className="header-companion">COMPANION</span>
        </div>
        <nav ref={navRef} className="header-nav-wrapper">
          <ul className="header-nav">
            {NAV_ITEMS.map((item) => {
              if (item.children) {
                const active = isDropdownActive(item.children)
                const isOpen = openDropdown === item.label
                return (
                  <li key={item.label} className="nav-dropdown">
                    <button
                      className={`nav-dropdown-trigger${active ? ' active' : ''}${isOpen ? ' open' : ''}`}
                      onClick={() => setOpenDropdown(isOpen ? null : item.label)}
                    >
                      {item.label}
                    </button>
                    {isOpen && (
                      <ul className="nav-dropdown-menu">
                        {item.children.map((child) => (
                          <li key={child.label}>
                            {child.disabled ? (
                              <span className="nav-dropdown-disabled">{child.label}</span>
                            ) : (
                              <Link
                                to={child.path}
                                className={isActive(child.path) ? 'active' : ''}
                                onClick={() => setOpenDropdown(null)}
                              >
                                {child.label}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              }
              return (
                <li key={item.label}>
                  <Link to={item.path} className={isActive(item.path) ? 'active' : ''}>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
          <button
            className="search-trigger"
            onClick={onSearchOpen}
            aria-label="Search items (Ctrl+K)"
            title="Search items (Ctrl+K)"
          >
            &#128269;
          </button>
        </nav>
      </div>
    </header>
  )
}

const MainContent = memo(function MainContent() {
  const location = useLocation()

  return (
    <div className="page-content">
      <div className="animated-content" key={location.pathname}>
        <div className="main-padding">
          <main>
            <Routes>
              <Route path="/" element={<FishPage />} />
              <Route path="/fish" element={<FishPage />} />
              <Route path="/artisan/*" element={<ArtisanPage />} />
              <Route path="/forage" element={<ForagePage />} />
              <Route path="/crops" element={<CropsPage />} />
              <Route path="/seeds" element={<SeedsPage />} />
              <Route path="/furniture" element={<FurniturePage />} />
              <Route path="/hats" element={<HatsPage />} />
            </Routes>
          </main>
        </div>
        <Footer />
      </div>
    </div>
  )
})

function AppShell({ searchOpen, setSearchOpen }) {
  const { activeEntity, openModal, closeModal } = useModal()

  return (
    <div className="app">
      <Navigation onSearchOpen={() => setSearchOpen(true)} />
      <CharacterBar />
      <MainContent />
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <UniversalModal
        entity={activeEntity}
        isOpen={activeEntity !== null}
        onClose={closeModal}
      />
    </div>
  )
}

function App() {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <HashRouter>
      <EntityProvider>
        <PlayerProvider>
          <ModalProvider>
            <AppShell searchOpen={searchOpen} setSearchOpen={setSearchOpen} />
          </ModalProvider>
        </PlayerProvider>
      </EntityProvider>
    </HashRouter>
  )
}

export default App

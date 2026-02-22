import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import FishPage from './components/fish/FishPage'
import ArtisanPage from './components/artisan/ArtisanPage'
import ForagePage from './components/forage/ForagePage'
import CropsPage from './components/crops/CropsPage'
import SeedsPage from './components/seeds/SeedsPage'
import Footer from './components/layout/Footer'
import CharacterBar from './components/common/CharacterBar'
import { ModalProvider } from './contexts/ModalContext'
import { PlayerProvider } from './contexts/PlayerContext'
import { VillagersProvider } from './contexts/VillagersContext'

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
  { label: 'Bundles', path: '/bundles' },
  { label: 'Villagers', path: '/villagers' },
]

function Navigation() {
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
        <nav ref={navRef}>
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
        </nav>
      </div>
    </header>
  )
}

function MainContent() {
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
            </Routes>
          </main>
        </div>
        <Footer />
      </div>
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <VillagersProvider>
        <PlayerProvider>
          <ModalProvider>
            <div className="app">
              <Navigation />
              <CharacterBar />
              <MainContent />
            </div>
          </ModalProvider>
        </PlayerProvider>
      </VillagersProvider>
    </HashRouter>
  )
}

export default App

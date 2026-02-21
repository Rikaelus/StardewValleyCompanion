import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import FishPage from './components/fish/FishPage'
import ArtisanPage from './components/artisan/ArtisanPage'
import ForagePage from './components/forage/ForagePage'
import CropsPage from './components/crops/CropsPage'
import Footer from './components/layout/Footer'
import CharacterBar from './components/common/CharacterBar'
import { ModalProvider } from './contexts/ModalContext'
import { PlayerProvider } from './contexts/PlayerContext'
import { VillagersProvider } from './contexts/VillagersContext'

function Navigation() {
  const location = useLocation()

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-branding">
          <img src="/assets/branding/stardew_logo.png" alt="Stardew Valley" className="header-logo" />
          <span className="header-companion">COMPANION</span>
        </div>
        <nav>
          <ul className="header-nav">
            <li>
              <Link to="/fish" className={isActive('/fish') ? 'active' : ''}>
                Fish
              </Link>
            </li>
            <li>
              <Link to="/artisan" className={isActive('/artisan') ? 'active' : ''}>
                Artisan Goods
              </Link>
            </li>
            <li>
              <Link to="/forage" className={isActive('/forage') ? 'active' : ''}>
                Forage
              </Link>
            </li>
            <li>
              <Link to="/crops" className={isActive('/crops') ? 'active' : ''}>
                Crops
              </Link>
            </li>
            <li><Link to="/villagers">Villagers</Link></li>
            <li><Link to="/bundles">Bundles</Link></li>
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

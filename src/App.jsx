import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect, memo } from 'react'
import HomePage from './components/home/HomePage'
import EntityListPage from './components/common/EntityListPage'
import ShrinePage from './components/tracker/ShrinePage'
import MuseumPage from './components/tracker/MuseumPage'
import CookingPage from './components/tracker/CookingPage'
import CraftingPage from './components/tracker/CraftingPage'
import FishingPage from './components/tracker/FishingPage'
import ShippingPage from './components/tracker/ShippingPage'
import FullShipmentPage from './components/tracker/FullShipmentPage'
import SlayerPage from './components/tracker/SlayerPage'
import RarecrowPage from './components/tracker/RarecrowPage'
import AchievementsPage from './components/tracker/AchievementsPage'
import SecretNotesPage from './components/tracker/SecretNotesPage'
import BundlesPage from './components/tracker/BundlesPage'
import FarmhousePage from './components/tracker/FarmhousePage'
import RaccoonPage from './components/tracker/RaccoonPage'
import WellReadPage from './components/tracker/WellReadPage'
import GoldenWalnutPage from './components/tracker/GoldenWalnutPage'
import Footer from './components/layout/Footer'
import AppHeader from './components/layout/AppHeader'
import MegaMenu from './components/layout/MegaMenu'
import TrackerMenu from './components/layout/TrackerMenu'
import CharacterBar from './components/common/CharacterBar'
import GlobalSearch from './components/common/GlobalSearch'
import UniversalModal from './components/common/UniversalModal'
import { ModalProvider, useModal } from './contexts/ModalContext'
import { PlayerProvider } from './contexts/PlayerContext'
import { EntityProvider } from './contexts/EntityContext'

const MainContent = memo(function MainContent() {
  const location = useLocation()

  return (
    <div className="page-content">
      <div className="animated-content" key={location.pathname}>
        <div className="main-padding">
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/tracker/bundles" element={<BundlesPage />} />
              <Route path="/tracker/shrine" element={<ShrinePage />} />
              <Route path="/tracker/museum" element={<MuseumPage />} />
              <Route path="/tracker/cooking" element={<CookingPage />} />
              <Route path="/tracker/crafting" element={<CraftingPage />} />
              <Route path="/tracker/fishing" element={<FishingPage />} />
              <Route path="/tracker/shipping" element={<ShippingPage />} />
              <Route path="/tracker/full-shipment" element={<FullShipmentPage />} />
              <Route path="/tracker/slayer" element={<SlayerPage />} />
              <Route path="/tracker/rarecrows" element={<RarecrowPage />} />
              <Route path="/tracker/achievements" element={<AchievementsPage />} />
              <Route path="/tracker/secret-notes" element={<SecretNotesPage />} />
              <Route path="/tracker/farmhouse" element={<FarmhousePage />} />
              <Route path="/tracker/raccoon-shop" element={<RaccoonPage />} />
              <Route path="/tracker/well-read" element={<WellReadPage />} />
              <Route path="/tracker/golden-walnuts" element={<GoldenWalnutPage />} />
              <Route path="/fish" element={<EntityListPage pageType="fish" />} />
              <Route path="/artisan/*" element={<EntityListPage pageType="artisan" />} />
              <Route path="/forage" element={<EntityListPage pageType="forage" />} />
              <Route path="/crops" element={<EntityListPage pageType="crops" />} />
              <Route path="/seeds" element={<EntityListPage pageType="seeds" />} />
              <Route path="/furniture" element={<EntityListPage pageType="furniture" />} />
              <Route path="/hats" element={<EntityListPage pageType="hats" />} />
              <Route path="/animal-products" element={<EntityListPage pageType="animal-products" />} />
              <Route path="/tree-fruits" element={<EntityListPage pageType="tree-fruits" />} />
              <Route path="/trees" element={<EntityListPage pageType="trees" />} />
              <Route path="/bait" element={<EntityListPage pageType="bait" />} />
              <Route path="/tackle" element={<EntityListPage pageType="tackle" />} />
              <Route path="/minerals" element={<EntityListPage pageType="minerals" />} />
              <Route path="/resources" element={<EntityListPage pageType="resources" />} />
              <Route path="/monsters" element={<EntityListPage pageType="monsters" />} />
              <Route path="/weapons" element={<EntityListPage pageType="weapons" />} />
              <Route path="/boots" element={<EntityListPage pageType="boots" />} />
              <Route path="/rings" element={<EntityListPage pageType="rings" />} />
              <Route path="/artifacts" element={<EntityListPage pageType="artifacts" />} />
              <Route path="/breakables" element={<EntityListPage pageType="breakables" />} />
              <Route path="/geodes" element={<EntityListPage pageType="geodes" />} />
              <Route path="/clothing" element={<EntityListPage pageType="clothing" />} />
              <Route path="/villagers" element={<EntityListPage pageType="villagers" />} />
              <Route path="/buildings" element={<EntityListPage pageType="buildings" />} />
              <Route path="/food" element={<EntityListPage pageType="food" />} />
              <Route path="/cooking" element={<EntityListPage pageType="cooking" />} />
              <Route path="/crafting" element={<EntityListPage pageType="crafting" />} />
              <Route path="/trinkets" element={<EntityListPage pageType="trinket" />} />
              <Route path="/books" element={<EntityListPage pageType="book" />} />
              <Route path="/powers" element={<EntityListPage pageType="power" />} />
              <Route path="/concessions" element={<EntityListPage pageType="concession" />} />
              <Route path="/bundles" element={<EntityListPage pageType="bundle" />} />
            </Routes>
          </main>
        </div>
        <Footer />
      </div>
    </div>
  )
})

function AppShell({ searchOpen, setSearchOpen }) {
  const { activeEntity, closeModal } = useModal()
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [trackerMenuOpen, setTrackerMenuOpen] = useState(false)
  const [characterBarOpen, setCharacterBarOpen] = useState(false)

  const openCharacterBar = () => {
    setCharacterBarOpen(true)
    setMegaMenuOpen(false)
    setTrackerMenuOpen(false)
  }

  const toggleMegaMenu = () => {
    setMegaMenuOpen(prev => !prev)
    setTrackerMenuOpen(false)
    setCharacterBarOpen(false)
  }

  const toggleTrackerMenu = () => {
    setTrackerMenuOpen(prev => !prev)
    setMegaMenuOpen(false)
    setCharacterBarOpen(false)
  }

  const toggleCharacterBar = () => {
    setCharacterBarOpen(prev => !prev)
    setMegaMenuOpen(false)
    setTrackerMenuOpen(false)
  }

  useEffect(() => {
    const handler = () => openCharacterBar()
    window.addEventListener('open-character-bar', handler)
    return () => window.removeEventListener('open-character-bar', handler)
  }, [])

  return (
    <div className="app">
      <AppHeader
        onSearchOpen={() => setSearchOpen(true)}
        onToggleMegaMenu={toggleMegaMenu}
        onToggleTrackerMenu={toggleTrackerMenu}
        onToggleCharacterBar={toggleCharacterBar}
        megaMenuOpen={megaMenuOpen}
        trackerMenuOpen={trackerMenuOpen}
        characterBarOpen={characterBarOpen}
      />
      <div className="app-body">
        <MegaMenu
          isOpen={megaMenuOpen}
          onClose={() => setMegaMenuOpen(false)}
        />
        <TrackerMenu
          isOpen={trackerMenuOpen}
          onClose={() => setTrackerMenuOpen(false)}
        />
        <CharacterBar
          isOpen={characterBarOpen}
          onClose={() => setCharacterBarOpen(false)}
        />
        <MainContent />
      </div>
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

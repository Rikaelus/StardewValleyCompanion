import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useState, useEffect, memo } from 'react'
import HomePage from './components/home/HomePage'
import EntityListPage from './components/common/EntityListPage'
import ShrinePage from './components/tracker/ShrinePage'
import MuseumPage from './components/tracker/MuseumPage'
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
              <Route path="/tracker/shrine" element={<ShrinePage />} />
              <Route path="/tracker/museum" element={<MuseumPage />} />
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

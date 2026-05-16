import { Link } from 'react-router-dom'
import PagePanel from '../common/PagePanel'
import './HomePage.css'

const QUICK_LINKS = [
  { label: 'Fish', path: '/fish', icon: '/assets/objects/Pufferfish.png', desc: 'All fish with locations, seasons, and catch conditions' },
  { label: 'Crops', path: '/crops', icon: '/assets/objects/Cauliflower.png', desc: 'Crop growth times, seasons, and profitability' },
  { label: 'Seeds', path: '/seeds', icon: '/assets/objects/ParsnipSeeds.png', desc: 'Seed sources and what they produce' },
  { label: 'Artisan Goods', path: '/artisan', icon: '/assets/objects/Wine.png', desc: 'Machine processing, aging, and artisan prices' },
  { label: 'Forage', path: '/forage', icon: '/assets/objects/Leek.png', desc: 'Seasonal forage locations and uses' },
  { label: 'Furniture', path: '/furniture', icon: '/assets/objects/OakChair.png', desc: 'All furniture items and where to find them' },
  { label: 'Hats', path: '/hats', icon: '/assets/objects/StrawHat.png', desc: 'Hats and how to obtain them' },
]

function HomePage() {
  return (
    <PagePanel>
      <div className="home-page">
        <div className="home-hero">
          <h1 className="home-title">Stardew Valley Companion</h1>
          <p className="home-subtitle">
            Browse game data, track your progress, and plan your farm. Upload your save file to unlock personalized progress tracking.
          </p>
        </div>

        <div className="home-section">
          <h2 className="home-section-heading">Browse</h2>
          <div className="home-quick-links">
            {QUICK_LINKS.map(link => (
              <Link key={link.path} to={link.path} className="home-link-card">
                <img src={link.icon} alt="" className="home-link-icon" />
                <div className="home-link-info">
                  <span className="home-link-label">{link.label}</span>
                  <span className="home-link-desc">{link.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="home-footer-note">
          <p>
            Stardew Valley and all game assets are property of{' '}
            <a href="https://www.stardewvalley.net/" target="_blank" rel="noopener noreferrer">ConcernedApe</a>.
            This is an unofficial fan project. Game data sourced from the{' '}
            <a href="https://stardewvalleywiki.com/" target="_blank" rel="noopener noreferrer">Stardew Valley Wiki</a>.
          </p>
        </div>
      </div>
    </PagePanel>
  )
}

export default HomePage

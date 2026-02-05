import './Footer.css'

function Footer() {
  return (
    <footer className="app-footer">
      <p>
        Stardew Valley and all game assets are property of{' '}
        <a href="https://www.stardewvalley.net/" target="_blank" rel="noopener noreferrer">
          ConcernedApe
        </a>.
        This is an unofficial fan project and is not affiliated with or endorsed by ConcernedApe.
      </p>
      <p>
        Game data sourced from the{' '}
        <a href="https://stardewvalleywiki.com/" target="_blank" rel="noopener noreferrer">
          Stardew Valley Wiki
        </a>.
      </p>
    </footer>
  )
}

export default Footer

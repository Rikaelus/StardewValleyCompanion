import './PagePanel.css'

function PagePanel({ children }) {
  return (
    <div className="page-panel">
      {children}
    </div>
  )
}

function Header({ children }) {
  return (
    <div className="page-panel-header-section">
      <div className="page-panel-header">
        {children}
      </div>
    </div>
  )
}

function TabsSection({ children }) {
  return (
    <div className="page-panel-tabs-section">
      {children}
    </div>
  )
}

function Controls({ children }) {
  return (
    <div className="page-panel-controls-section">
      <div className="page-panel-controls">
        {children}
      </div>
    </div>
  )
}

PagePanel.Header = Header
PagePanel.Tabs = TabsSection
PagePanel.Controls = Controls

export default PagePanel

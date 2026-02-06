import './ModalGrid.css'

/**
 * Reusable grid layout for label-value pairs in modals
 *
 * Usage:
 *   <ModalGrid>
 *     <ModalGridItem label="Difficulty:" value="50" />
 *     <ModalGridItem label="Min Level:" value="5" valueStyle={{ color: '#1976d2' }} />
 *   </ModalGrid>
 */
function ModalGrid({ children, className = '' }) {
  return (
    <div className={`modal-grid ${className}`}>
      {children}
    </div>
  )
}

/**
 * Individual grid item with label and value
 *
 * Usage:
 *   <ModalGridItem label="Difficulty:" value="50" />
 *   <ModalGridItem label="Size:" value="12-36 inches" />
 *   <ModalGridItem label="Level:">
 *     <span style={{ color: 'blue' }}>5</span>
 *   </ModalGridItem>
 */
function ModalGridItem({ label, value, children, labelStyle = {}, valueStyle = {}, className = '' }) {
  return (
    <div className={`modal-grid-item ${className}`}>
      <span className="label" style={labelStyle}>{label}</span>
      {children ? children : <span className="value" style={valueStyle}>{value}</span>}
    </div>
  )
}

export { ModalGrid, ModalGridItem }
export default ModalGrid

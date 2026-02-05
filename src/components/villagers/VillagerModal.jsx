import { useRef, useEffect } from 'react'
import Modal from '../common/Modal'
import './VillagerModal.css'

function VillagerModal({ villager, isOpen, onClose }) {
  const villagerRef = useRef(villager)

  // Keep the last villager data during closing animation
  useEffect(() => {
    if (villager) {
      villagerRef.current = villager
    }
  }, [villager])

  const displayVillager = villager || villagerRef.current

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayVillager?.name || 'Villager'}>
      {displayVillager && <div className="villager-modal">
        <div className="villager-modal-header">
          <img src={displayVillager.icon} alt={displayVillager.name} className="villager-modal-icon" />
          <div className="villager-modal-title-section">
            <h3>{displayVillager.name}</h3>
            <p className="villager-placeholder">Villager details coming soon...</p>
          </div>
        </div>

        <div className="villager-modal-section">
          <p>This is a placeholder modal to demonstrate cascading modals.</p>
          <p>In the future, this could show:</p>
          <ul>
            <li>Birthday & favorite gifts</li>
            <li>Schedule & location</li>
            <li>Heart events</li>
            <li>Gift preferences for all items</li>
          </ul>
        </div>
      </div>}
    </Modal>
  )
}

export default VillagerModal

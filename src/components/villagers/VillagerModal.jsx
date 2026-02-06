import { useRef, useEffect } from 'react'
import Modal from '../common/Modal'
import ModalHeader from '../common/ModalHeader'
import ModalSection from '../common/ModalSection'
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
      {displayVillager && <>
        <ModalHeader icon={displayVillager.icon} name={displayVillager.name}>
          <p className="villager-placeholder">Villager details coming soon...</p>
        </ModalHeader>

        <ModalSection>
          <p>This is a placeholder modal to demonstrate cascading modals.</p>
          <p>In the future, this could show:</p>
          <ul>
            <li>Birthday & favorite gifts</li>
            <li>Schedule & location</li>
            <li>Heart events</li>
            <li>Gift preferences for all items</li>
          </ul>
        </ModalSection>
      </>}
    </Modal>
  )
}

export default VillagerModal

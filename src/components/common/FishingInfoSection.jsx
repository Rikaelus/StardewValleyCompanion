import ModalSection from './ModalSection'
import { ModalGrid, ModalGridItem } from './ModalGrid'
import ModalNote from './ModalNote'
import { getDifficultyColor } from '../../utils/Formatters'

function FishingInfoSection({ entity }) {
  if (!entity || entity.type !== 'fish') return null

  if (entity.isTrapFish) {
    return (
      <ModalSection id="section-fishing" title="Fishing Info" navLabel="Fishing Info">
        <ModalGrid>
          <ModalGridItem
            label="Method:"
            value="Crab Pot"
          />
        </ModalGrid>
        <ModalNote>
          Crab pots must be baited and checked daily. Works 24/7 in all seasons and weather.
        </ModalNote>
      </ModalSection>
    )
  }

  return (
    <ModalSection id="section-fishing" title="Fishing Info" navLabel="Fishing Info">
      <ModalGrid>
        <ModalGridItem label="Difficulty:">
          <span className="value difficulty" style={{ color: getDifficultyColor(entity.difficulty) }}>
            {entity.difficulty}
          </span>
        </ModalGridItem>

        <ModalGridItem
          label="Behavior:"
          value={entity.behaviorType ? entity.behaviorType.charAt(0).toUpperCase() + entity.behaviorType.slice(1) : 'Unknown'}
        />

        {entity.minFishingLevel && (
          <ModalGridItem label="Min Fishing Level:">
            <span className="value" style={{ color: '#1976d2', fontWeight: 'bold' }}>
              {entity.minFishingLevel}
            </span>
          </ModalGridItem>
        )}

        <ModalGridItem
          label="Size Range:"
          value={`${entity.minSize}-${entity.maxSize} inches`}
        />
      </ModalGrid>
    </ModalSection>
  )
}

export default FishingInfoSection

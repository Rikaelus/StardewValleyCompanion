import ModalSection from './ModalSection'
import UniversalModalButton from './UniversalModalButton'
import { useEntities } from '../../contexts/EntityContext'
import './TagList.css'

function ContextTagsSection({ entity, onNavigate }) {
  if (!entity?.contextTags || entity.contextTags.length === 0) return null

  const { findById } = useEntities()

  return (
    <ModalSection title="Context Tags">
      <div className="tag-list tag-list-context">
        {entity.contextTags.map((tag, i) => {
          const tagEntity = findById('tag-' + tag.replace(/_/g, '-'))
          if (tagEntity && onNavigate) {
            return (
              <span key={i} className="tag tag--clickable">
                <UniversalModalButton item={tagEntity} variant="inline" onNavigate={onNavigate} />
              </span>
            )
          }
          return <span key={i} className="tag">{tag}</span>
        })}
      </div>
    </ModalSection>
  )
}

export default ContextTagsSection

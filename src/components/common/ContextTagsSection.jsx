import ModalSection from './ModalSection'
import TagList from './TagList'

function ContextTagsSection({ entity }) {
  if (!entity?.contextTags || entity.contextTags.length === 0) return null

  return (
    <ModalSection title="Context Tags">
      <TagList items={entity.contextTags} variant="context" />
    </ModalSection>
  )
}

export default ContextTagsSection

import UniversalModalButton from './UniversalModalButton'
import { useEntities } from '../../contexts/EntityContext'

/**
 * Renders a list of recipe entries (usedInRecipes) with the output item linked
 * and otherIngredients shown as "+ Ingredient" qualifiers.
 *
 * Automatically filters out ingredients that the subject entity satisfies:
 * - Direct ID match (subject is literally that ingredient)
 * - Tag match (subject's contextTags include the tag entity's raw tag)
 *
 * Props:
 *   recipes  - array of { recipeId, recipeName, type, amount, otherIngredients? }
 *   subject  - the entity whose modal is being viewed
 *   onNavigate - breadcrumb-aware navigation callback
 */
function RecipeEntryList({ recipes, subject, onNavigate }) {
  const { findById } = useEntities()

  const subjectTags = new Set(subject?.contextTags || [])

  return recipes.map((r, i) => {
    const recipeItem = findById(r.recipeId)
    // Filter out ingredients the subject satisfies (by direct ID or tag membership)
    const others = (r.otherIngredients || []).filter(ing => {
      if (ing.id === subject?.id) return false
      // If this ingredient is a tag entity, check if the subject has that tag
      const ingEntity = findById(ing.id)
      if (ingEntity?.type === 'tag' && ingEntity.rawTag && subjectTags.has(ingEntity.rawTag)) return false
      return true
    })
    return (
      <span key={i} className="source-entry">
        <span className="source-name">
          {recipeItem
            ? <UniversalModalButton item={recipeItem} variant="inline" onNavigate={onNavigate} quantity={r.amount} />
            : r.recipeName}
        </span>
        <span className="source-qualifiers">
          {others.map((ing, j) => {
            const ingItem = findById(ing.id)
            return (
              <span key={j} className="source-qualifier source-qualifier--ingredient">
                with {ingItem
                  ? <UniversalModalButton item={ingItem} variant="inline" onNavigate={onNavigate} quantity={ing.amount} />
                  : <>{ing.name}{ing.amount > 1 ? ` ×${ing.amount}` : ''}</>
                }
              </span>
            )
          })}
        </span>
      </span>
    )
  })
}

export default RecipeEntryList

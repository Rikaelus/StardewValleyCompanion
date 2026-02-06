# Modal Component Guide

A collection of reusable components for building consistent modal UIs across the app.

## Components

### ModalHeader

Displays an icon and title with automatic fallback handling.

```jsx
import ModalHeader from '../common/ModalHeader'

<ModalHeader
  icon={item.icon}
  name={item.name}
  subtitle="Optional subtitle"
>
  {/* Optional children appear below title/subtitle */}
  <div className="extra-info">
    <ItemSellPrice item={item} />
  </div>
</ModalHeader>
```

**Features:**
- Automatic icon fallback (shows first 2 letters if image fails)
- 64x64 icon size
- Optional subtitle
- Children rendered below title section

---

### ModalSection

Section container with optional title.

```jsx
import ModalSection from '../common/ModalSection'

<ModalSection title="Fishing Info">
  <div>Content here</div>
</ModalSection>

<ModalSection title="Location & Time" className="custom-class">
  <ModalGrid>...</ModalGrid>
</ModalSection>
```

**Features:**
- Automatic bottom margin between sections
- Title with underline styling
- Optional className for customization

---

### ModalGrid & ModalGridItem

Responsive grid layout for label-value pairs.

```jsx
import { ModalGrid, ModalGridItem } from '../common/ModalGrid'

<ModalGrid>
  {/* Simple usage */}
  <ModalGridItem label="Difficulty:" value="50" />

  {/* With custom styling */}
  <ModalGridItem
    label="Min Level:"
    value="5"
    valueStyle={{ color: '#1976d2', fontWeight: 'bold' }}
  />

  {/* With children for complex content */}
  <ModalGridItem label="Weather:">
    <span className="value">
      {weather === 'rainy' ? '🌧 Rainy' : '☀️ Sunny'}
    </span>
  </ModalGridItem>
</ModalGrid>
```

**Features:**
- Responsive grid (auto-fit, min 200px columns)
- Label-value alignment
- Support for custom styling or JSX children

---

### TagList

Display lists of tags/badges with different visual styles.

```jsx
import TagList from '../common/TagList'

{/* For locations */}
<TagList items={fish.location} variant="location" />

{/* For bundles */}
<TagList items={fish.bundleDetails} variant="bundle" nameKey="name" />

{/* For context tags */}
<TagList items={fish.contextTags} variant="context" />

{/* For seasons (with special coloring) */}
<TagList items={['Spring', 'Summer']} variant="season" />
```

**Variants:**
- `location` - Green tags for locations
- `bundle` - Orange tags for bundles
- `context` - Gray tags for context tags
- `season` - Colorful tags (spring=green, summer=yellow, fall=orange, winter=blue)
- `default` - Neutral beige tags

**Props:**
- `items` - Array of strings or objects
- `variant` - Visual style (see above)
- `nameKey` - If items are objects, which property to display (e.g., "name")
- `emptyText` - Text to show when array is empty (default: "None")

---

## Complete Example: Refactored Modal

See `FishModal.refactored.jsx` for a complete example showing all components in use.

### Before (Manual Structure):
```jsx
<div className="fish-modal-header">
  <img src={fish.icon} alt={fish.name} onError={...} />
  <div className="fish-modal-title-section">
    <h3>{fish.name}</h3>
    {/* ... */}
  </div>
</div>

<div className="fish-modal-section">
  <h4>Fishing Info</h4>
  <div className="fish-modal-grid">
    <div className="fish-modal-item">
      <span className="label">Difficulty:</span>
      <span className="value">{fish.difficulty}</span>
    </div>
    {/* ... more items */}
  </div>
</div>
```

### After (Reusable Components):
```jsx
<ModalHeader icon={fish.icon} name={fish.name}>
  <ItemSellPrice item={fish} />
</ModalHeader>

<ModalSection title="Fishing Info">
  <ModalGrid>
    <ModalGridItem label="Difficulty:" value={fish.difficulty} />
    {/* ... more items */}
  </ModalGrid>
</ModalSection>
```

## Benefits

1. **Consistency** - All modals use the same visual styles
2. **Maintainability** - Update styling in one place
3. **Less Code** - Reusable components reduce boilerplate
4. **Accessibility** - Built-in error handling and fallbacks
5. **Flexibility** - Composable components for different layouts

## Migration Guide

To migrate an existing modal:

1. Replace manual header structure with `<ModalHeader>`
2. Wrap sections with `<ModalSection>`
3. Replace grid divs with `<ModalGrid>` and `<ModalGridItem>`
4. Replace tag lists with `<TagList variant="..."`
5. Remove modal-specific CSS that duplicates common styles
6. Test icon fallback by temporarily breaking icon URL

## Future Enhancements

Potential additions:
- `ModalNote` - For special notes/warnings with icons
- `ModalTabs` - For tabbed content in modals
- `ModalRecipe` - For recipe/crafting displays
- `ModalTimeline` - For schedules/events

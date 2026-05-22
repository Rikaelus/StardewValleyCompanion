import { useMemo, useState } from 'react'
import { useEntities } from '../../contexts/EntityContext'
import { useProgress } from '../../hooks/UseProgress'
import CollectionPage from './CollectionPage'

function WellReadPage() {
  const { items, loading } = useEntities()
  const progress = useProgress()
  const [filter, setFilter] = useState('all')

  const { groups, totals } = useMemo(() => {
    if (loading) return { groups: [], totals: { done: 0, total: 0 } }

    const books = items.filter(i => i.type === 'book')
    books.sort((a, b) => a.name.localeCompare(b.name))

    const groupItems = books.map(book => {
      const read = progress.isBookRead(book.gameId)
      return {
        entity: book,
        state: read ? 'complete' : 'missing',
        tileTitle: read ? `${book.name} — Read` : `${book.name} — Not yet read`,
      }
    })

    const done = groupItems.filter(i => i.state === 'complete').length

    return {
      groups: [{ id: 'books', title: 'Books', items: groupItems }],
      totals: { done, total: groupItems.length, label: 'read' },
    }
  }, [items, loading, progress])

  const milestones = [
    { label: `${totals.total} — Well-read`, reached: totals.done >= totals.total },
  ]

  return (
    <CollectionPage
      title="Well-read"
      groups={groups}
      totals={totals}
      milestones={milestones}
      legend={[
        { state: 'complete', label: 'Read' },
        { state: 'missing', label: 'Not yet read' },
      ]}
      activeFilter={filter}
      onFilter={setFilter}
      hasSaveData={progress.hasSaveData}
      noSaveMessage="Upload your save file to track which books you've read."
    />
  )
}

export default WellReadPage

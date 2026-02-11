import ModalItemButton from './ModalItemButton'

function SpecialCases({ items }) {
  const specialItems = items.filter(item => item.notes)

  if (specialItems.length === 0) return null

  return (
    <div className="special-cases">
      <h3>Special Cases</h3>
      <div className="special-cases-list">
        {specialItems.map(item => (
          <div key={item.id} className="special-case-item">
            <div className="special-case-header">
              <ModalItemButton
                item={item}
                showIcon={true}
                showLabel={true}
                iconSize={24}
              />
            </div>
            <div className="special-case-notes">
              {item.notes.map((note, idx) => (
                <div key={idx} className="special-case-note-line">
                  <strong>{note.locations.join(', ')}:</strong> {note.seasons}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .special-cases {
          margin-top: 2rem;
          background: #fdfbf7;
          border-radius: 8px;
          box-shadow:
            0 4px 6px rgba(0,0,0,0.1),
            inset 0 0 0 3px #8b6f47,
            inset 0 0 0 4px #f4e4c1;
          border: 2px solid #5c4a32;
          padding: 1.5rem;
        }
        .special-cases h3 {
          margin: 0 0 1rem 0;
          font-size: 18px;
          color: #5c4a32;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 2px solid #8b6f47;
          padding-bottom: 0.5rem;
        }
        .special-cases-list {
          display: grid;
          gap: 1rem;
        }
        .special-case-item {
          border-left: 4px solid #8b6f47;
          padding-left: 1rem;
          background: rgba(255,248,231,0.5);
          padding: 0.75rem 1rem;
          border-radius: 4px;
        }
        .special-case-header {
          margin-bottom: 0.5rem;
        }
        .special-case-header .item-button {
          background: rgba(255,255,255,0.5);
        }
        .special-case-header .item-button:hover {
          background: rgba(227,242,253,0.8);
        }
        .special-case-header .item-button-label {
          font-weight: bold;
          color: #2d1b00;
        }
        .special-case-notes {
          font-size: 14px;
          color: #5c4a32;
          line-height: 1.8;
        }
        .special-case-note-line {
          margin-bottom: 0.25rem;
        }
        .special-case-note-line:last-child {
          margin-bottom: 0;
        }
        .special-case-note-line strong {
          color: #2d1b00;
        }
      `}</style>
    </div>
  )
}

export default SpecialCases

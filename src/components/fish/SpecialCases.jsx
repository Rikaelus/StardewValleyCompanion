function SpecialCases({ fish }) {
  const specialFish = fish.filter(f => f.notes)

  if (specialFish.length === 0) return null

  return (
    <div className="special-cases">
      <h3>Special Cases</h3>
      <div className="special-cases-list">
        {specialFish.map(f => (
          <div key={f.id} className="special-case-item">
            <div className="special-case-header">
              <img src={f.icon} alt={f.name} width={24} height={24} />
              <strong>{f.name}</strong>
            </div>
            <div className="special-case-note">{f.notes}</div>
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
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
          color: #2d1b00;
        }
        .special-case-note {
          font-size: 14px;
          color: #5c4a32;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

export default SpecialCases

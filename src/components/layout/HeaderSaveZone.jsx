import { useSaveFileImport } from '../../hooks/UseSaveFileImport'
import './HeaderSaveZone.css'

function HeaderSaveZone() {
  const {
    fileInputRef, importState, isDragOver,
    handleFileSelect, handleDrop, handleDragOver, handleDragLeave,
  } = useSaveFileImport({
    onError: () => window.dispatchEvent(new Event('open-character-bar')),
  })

  return (
    <div
      className={`header-save-zone ${isDragOver ? 'header-save-zone--over' : ''} ${importState === 'loading' ? 'header-save-zone--loading' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => importState !== 'loading' && fileInputRef.current?.click()}
      title="Drop save file to import"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
    >
      {importState === 'loading' ? (
        <>
          <i className="fa-solid fa-spinner fa-spin header-save-zone-icon" />
          <span className="header-save-zone-label">Importing…</span>
        </>
      ) : (
        <>
          <span className="header-save-zone-title">Upload Save</span>
          <span className="header-save-zone-label">Click or Drop Here</span>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  )
}

export default HeaderSaveZone

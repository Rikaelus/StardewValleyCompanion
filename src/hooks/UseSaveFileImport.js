import { useState, useRef } from 'react'
import { usePlayer } from '../contexts/PlayerContext'
import { parseSaveFile } from '../utils/SaveFileParser'

export function useSaveFileImport({ onError } = {}) {
  const { importSaveData } = usePlayer()
  const fileInputRef = useRef(null)
  const [importState, setImportState] = useState('idle') // idle | loading | error
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setImportState('loading')
    setErrorMessage('')
    try {
      const text = await file.text()
      const parsed = parseSaveFile(text)
      importSaveData(parsed)
      setImportState('idle')
    } catch (err) {
      const msg = err.message || 'Failed to parse save file.'
      setImportState('error')
      setErrorMessage(msg)
      onError?.(msg)
    }
  }

  const handleFileSelect = (e) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  return {
    fileInputRef,
    importState,
    errorMessage,
    isDragOver,
    handleFile,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  }
}

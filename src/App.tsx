import { useEffect, useRef, useState } from 'react'
import { AppShell } from './components/shell/AppShell'
import { DocumentStage } from './components/viewer/DocumentStage'
import { useToolStore } from './state/toolStore'
import { useViewerStore, ZOOM_STEP } from './state/viewerStore'

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const openFile = useViewerStore((state) => state.openFile)
  const status = useViewerStore((state) => state.status)
  const fileName = useViewerStore((state) => state.fileName)
  const currentPage = useViewerStore((state) => state.currentPage)
  const pageCount = useViewerStore((state) => state.pageCount)
  const goToPage = useViewerStore((state) => state.goToPage)
  const zoomBy = useViewerStore((state) => state.zoomBy)
  const setActualSize = useViewerStore((state) => state.setActualSize)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  useEffect(() => {
    document.title = fileName ? `${fileName} — Bazure` : 'Bazure'
  }, [fileName])

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]') !== null
      )
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isTypingTarget(event.target)) {
        useToolStore.getState().setPlace(null)
      }
      if (isTypingTarget(event.target) || status !== 'ready') return
      const command = event.metaKey || event.ctrlKey

      if (command && (event.key === '=' || event.key === '+')) {
        event.preventDefault()
        zoomBy(ZOOM_STEP)
        return
      }
      if (command && event.key === '-') {
        event.preventDefault()
        zoomBy(1 / ZOOM_STEP)
        return
      }
      if (command && event.key === '0') {
        event.preventDefault()
        setActualSize()
        return
      }
      if (command || event.altKey) return

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        goToPage(currentPage - 1)
      } else if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === 'PageDown'
      ) {
        event.preventDefault()
        goToPage(currentPage + 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        goToPage(1)
      } else if (event.key === 'End') {
        event.preventDefault()
        goToPage(pageCount)
      }
    }

    function onWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey) || status !== 'ready') return
      event.preventDefault()
      zoomBy(event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('wheel', onWheel)
    }
  }, [status, currentPage, pageCount, goToPage, zoomBy, setActualSize])

  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes('Files')
    }

    function onDragEnter(event: DragEvent) {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current += 1
      setDragging(true)
    }

    function onDragOver(event: DragEvent) {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    function onDragLeave(event: DragEvent) {
      if (!hasFiles(event)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }

    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file) void openFile(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [openFile])

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <>
      <input
        id="bazure-file"
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void openFile(file)
        }}
      />
      <AppShell dragging={dragging}>
        <DocumentStage dragging={dragging} onOpen={openPicker} />
      </AppShell>
    </>
  )
}

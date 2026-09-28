import { useEffect, useRef, useState } from 'react'
import { AppShell } from './components/shell/AppShell'
import { DocumentStage } from './components/viewer/DocumentStage'
import {
  cut,
  deleteSelected,
  duplicate,
  openPicker as openFilePicker,
  paste,
  print,
  redo,
  save,
  saveAs,
  toggleFullScreen,
  undo,
} from './lib/commands'
import { useMarkupStore } from './state/markupStore'
import { anyTabDirty, useTabStore } from './state/tabStore'
import { useToolStore } from './state/toolStore'
import { useViewerStore, ZOOM_STEP } from './state/viewerStore'

function reportError(error: unknown) {
  window.alert(error instanceof Error ? error.message : 'That action failed.')
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const openFiles = useTabStore((state) => state.openFiles)
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
      const typing = isTypingTarget(event.target)
      const command = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (event.key === 'Escape' && !typing) {
        useToolStore.getState().setPlace(null)
        useMarkupStore.getState().select(null)
      }
      if (typing) return

      if (command && key === 'o') {
        event.preventDefault()
        openFilePicker()
        return
      }
      if (command && key === 'l') {
        event.preventDefault()
        toggleFullScreen()
        return
      }
      if (status !== 'ready') return

      if (command && key === 's') {
        event.preventDefault()
        void (event.shiftKey ? saveAs() : save()).catch(reportError)
        return
      }
      if (command && key === 'p') {
        event.preventDefault()
        void print().catch(reportError)
        return
      }
      if (command && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (command && key === 'y') {
        event.preventDefault()
        redo()
        return
      }
      // Only take over copy/cut/paste when a markup is involved; otherwise the browser copies page text.
      if (command && key === 'c') {
        if (useMarkupStore.getState().copySelected()) event.preventDefault()
        return
      }
      if (command && key === 'x') {
        if (cut()) event.preventDefault()
        return
      }
      if (command && key === 'v') {
        if (paste()) event.preventDefault()
        return
      }
      if (command && key === 'd') {
        event.preventDefault()
        duplicate()
        return
      }

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

      if ((event.key === 'Delete' || event.key === 'Backspace') && deleteSelected()) {
        event.preventDefault()
        return
      }

      const step = event.shiftKey ? 0.01 : 0.002
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const delta = nudge[event.key]
      if (delta && useMarkupStore.getState().nudgeSelected(delta[0], delta[1])) {
        event.preventDefault()
        return
      }

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
      const files = [...(event.dataTransfer?.files ?? [])]
      if (files.length > 0) void openFiles(files)
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
  }, [openFiles])

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!anyTabDirty()) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

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
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          if (files.length > 0) void openFiles(files)
        }}
      />
      <AppShell dragging={dragging}>
        <DocumentStage dragging={dragging} onOpen={openPicker} />
      </AppShell>
    </>
  )
}

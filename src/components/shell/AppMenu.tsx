import { useEffect, useRef, useState } from 'react'
import {
  closeActiveTab,
  copy,
  cut,
  deleteSelected,
  duplicate,
  openPicker,
  openTool,
  paste,
  print,
  redo,
  save,
  saveAs,
  toggleFullScreen,
  undo,
} from '../../lib/commands'
import { useMarkupStore } from '../../state/markupStore'
import { useTabStore } from '../../state/tabStore'
import { applyTheme, currentTheme, type ThemeName } from '../../lib/theme'
import { useViewerStore, ZOOM_STEP } from '../../state/viewerStore'

type MenuEntry =
  | { kind: 'item'; label: string; shortcut?: string; disabled?: boolean; run: () => unknown }
  | { kind: 'separator' }

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

export function AppMenu() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeName>(() => currentTheme())
  const rootRef = useRef<HTMLDivElement>(null)
  const ready = useViewerStore((state) => state.status === 'ready')
  const readingMode = useViewerStore((state) => state.readingMode)
  const hasSelection = useMarkupStore((state) => state.selectedId !== null)
  const canUndo = useMarkupStore((state) => state.past.length > 0)
  const canRedo = useMarkupStore((state) => state.future.length > 0)
  const hasClipboard = useMarkupStore((state) => state.clipboard !== null)
  const tabCount = useTabStore((state) => state.tabs.length)
  const closeAll = useTabStore((state) => state.closeAll)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const viewer = useViewerStore.getState()
  const entries: MenuEntry[] = [
    { kind: 'item', label: 'Open…', shortcut: `${mod}O`, run: openPicker },
    { kind: 'item', label: 'Create PDF…', run: () => openTool('create') },
    { kind: 'separator' },
    { kind: 'item', label: 'Save', shortcut: `${mod}S`, disabled: !ready, run: save },
    { kind: 'item', label: 'Save as…', shortcut: `${mod}Shift+S`, disabled: !ready, run: saveAs },
    { kind: 'item', label: 'Print…', shortcut: `${mod}P`, disabled: !ready, run: print },
    { kind: 'separator' },
    { kind: 'item', label: 'Undo', shortcut: `${mod}Z`, disabled: !canUndo, run: undo },
    { kind: 'item', label: 'Redo', shortcut: `${mod}Y`, disabled: !canRedo, run: redo },
    { kind: 'separator' },
    { kind: 'item', label: 'Cut', shortcut: `${mod}X`, disabled: !hasSelection, run: cut },
    { kind: 'item', label: 'Copy', shortcut: `${mod}C`, disabled: !ready, run: copy },
    { kind: 'item', label: 'Paste', shortcut: `${mod}V`, disabled: !ready || !hasClipboard, run: paste },
    { kind: 'item', label: 'Duplicate', shortcut: `${mod}D`, disabled: !hasSelection, run: duplicate },
    { kind: 'item', label: 'Delete', shortcut: 'Del', disabled: !hasSelection, run: deleteSelected },
    { kind: 'separator' },
    { kind: 'item', label: 'Zoom in', shortcut: `${mod}+`, disabled: !ready, run: () => viewer.zoomBy(ZOOM_STEP) },
    { kind: 'item', label: 'Zoom out', shortcut: `${mod}-`, disabled: !ready, run: () => viewer.zoomBy(1 / ZOOM_STEP) },
    { kind: 'item', label: 'Actual size', shortcut: `${mod}0`, disabled: !ready, run: viewer.setActualSize },
    { kind: 'item', label: 'Fit page', disabled: !ready, run: () => viewer.setZoomMode('fit-page') },
    { kind: 'item', label: 'Fit width', disabled: !ready, run: () => viewer.setZoomMode('fit-width') },
    {
      kind: 'item',
      label: readingMode === 'continuous' ? 'Single page view' : 'Continuous scrolling',
      disabled: !ready,
      run: () => viewer.setReadingMode(readingMode === 'continuous' ? 'single' : 'continuous'),
    },
    { kind: 'item', label: 'Full screen', shortcut: `${mod}L`, run: toggleFullScreen },
    {
      kind: 'item',
      label: theme === 'dark' ? 'Use light mode' : 'Use dark mode',
      run: () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        setTheme(next)
      },
    },
    { kind: 'separator' },
    { kind: 'item', label: 'Close tab', disabled: tabCount === 0, run: closeActiveTab },
    { kind: 'item', label: 'Close all tabs', disabled: tabCount === 0, run: closeAll },
  ]

  return (
    <div className="app-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? 'tool-btn icon is-active' : 'tool-btn icon'}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 5h12M3 9h12M3 13h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="app-menu-list" role="menu">
          {entries.map((entry, index) =>
            entry.kind === 'separator' ? (
              <div key={`sep-${index}`} className="app-menu-sep" role="separator" />
            ) : (
              <button
                key={entry.label}
                type="button"
                role="menuitem"
                className="app-menu-item"
                disabled={entry.disabled}
                onClick={() => {
                  setOpen(false)
                  Promise.resolve()
                    .then(entry.run)
                    .catch((error: unknown) => {
                      window.alert(error instanceof Error ? error.message : 'That action failed.')
                    })
                }}
              >
                <span>{entry.label}</span>
                {entry.shortcut ? <kbd>{entry.shortcut}</kbd> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}

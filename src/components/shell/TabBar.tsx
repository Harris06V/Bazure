import { useDragReorder } from '../../hooks/useDragReorder'
import { openPicker } from '../../lib/commands'
import { useMarkupStore } from '../../state/markupStore'
import { useTabStore } from '../../state/tabStore'
import { useViewerStore } from '../../state/viewerStore'

export function TabBar() {
  const tabs = useTabStore((state) => state.tabs)
  const activeId = useTabStore((state) => state.activeId)
  const switchTo = useTabStore((state) => state.switchTo)
  const close = useTabStore((state) => state.close)
  const reorder = useTabStore((state) => state.reorder)
  const activeName = useViewerStore((state) => state.fileName)
  const activeModified = useViewerStore((state) => state.modified)
  const activeMarkupDirty = useMarkupStore((state) => state.items !== state.savedItems)
  const drag = useDragReorder(tabs, (next) => reorder(next.map((tab) => tab.id)), 'x')

  if (tabs.length === 0) return null

  function shift(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= tabs.length) return
    const ids = tabs.map((tab) => tab.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder(ids)
  }

  return (
    <div className="tab-bar" role="tablist" aria-label="Open documents" {...drag.containerProps}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId
        const name = isActive ? (activeName ?? tab.name) : tab.name
        const dirty = isActive ? activeModified || activeMarkupDirty : tab.dirty
        const marker = drag.markerFor(index)
        return (
          <div
            key={tab.id}
            className={[
              'doc-tab',
              isActive ? 'is-active' : '',
              drag.draggingId === tab.id ? 'is-dragging' : '',
              marker ? `drop-${marker}` : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            title={`${name} — drag to reorder, Ctrl+Shift+←/→ to move`}
            {...drag.itemProps(tab.id)}
            onClick={() => void switchTo(tab.id)}
            onAuxClick={(event) => {
              if (event.button === 1) void close(tab.id)
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowLeft') {
                event.preventDefault()
                shift(index, -1)
              } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'ArrowRight') {
                event.preventDefault()
                shift(index, 1)
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                void switchTo(tab.id)
              }
            }}
          >
            <span className="doc-tab-name">{name}</span>
            {dirty ? <span className="doc-tab-dirty" aria-label="Unsaved changes" /> : null}
            <button
              type="button"
              className="doc-tab-close"
              aria-label={`Close ${name}`}
              data-no-drag
              onClick={(event) => {
                event.stopPropagation()
                void close(tab.id)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
      <button type="button" className="doc-tab-add" aria-label="Open another PDF" title="Open" onClick={openPicker}>
        +
      </button>
    </div>
  )
}

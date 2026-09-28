import { openPicker } from '../../lib/commands'
import { useMarkupStore } from '../../state/markupStore'
import { useTabStore } from '../../state/tabStore'
import { useViewerStore } from '../../state/viewerStore'

export function TabBar() {
  const tabs = useTabStore((state) => state.tabs)
  const activeId = useTabStore((state) => state.activeId)
  const switchTo = useTabStore((state) => state.switchTo)
  const close = useTabStore((state) => state.close)
  const activeName = useViewerStore((state) => state.fileName)
  const activeModified = useViewerStore((state) => state.modified)
  const activeMarkupDirty = useMarkupStore((state) => state.items !== state.savedItems)

  if (tabs.length === 0) return null

  return (
    <div className="tab-bar" role="tablist" aria-label="Open documents">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        const name = isActive ? (activeName ?? tab.name) : tab.name
        const dirty = isActive ? activeModified || activeMarkupDirty : tab.dirty
        return (
          <div
            key={tab.id}
            className={isActive ? 'doc-tab is-active' : 'doc-tab'}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            title={name}
            onClick={() => void switchTo(tab.id)}
            onAuxClick={(event) => {
              if (event.button === 1) void close(tab.id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
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

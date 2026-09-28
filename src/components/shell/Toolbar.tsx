import { useState } from 'react'
import { Chevron, MinusIcon, PlusIcon } from '../icons'
import { AppMenu } from './AppMenu'
import { ToolButton } from './ToolButton'
import { useViewerStore, ZOOM_STEP } from '../../state/viewerStore'

export function Toolbar() {
  const status = useViewerStore((state) => state.status)
  const fileName = useViewerStore((state) => state.fileName)
  const pageCount = useViewerStore((state) => state.pageCount)
  const currentPage = useViewerStore((state) => state.currentPage)
  const readingMode = useViewerStore((state) => state.readingMode)
  const zoomMode = useViewerStore((state) => state.zoomMode)
  const displayZoom = useViewerStore((state) => state.displayZoom)
  const goToPage = useViewerStore((state) => state.goToPage)
  const setReadingMode = useViewerStore((state) => state.setReadingMode)
  const setZoomMode = useViewerStore((state) => state.setZoomMode)
  const zoomBy = useViewerStore((state) => state.zoomBy)
  const setActualSize = useViewerStore((state) => state.setActualSize)
  const ready = status === 'ready'
  const percent = Math.round(displayZoom * 100)
  const [draft, setDraft] = useState(String(currentPage))
  const [trackedPage, setTrackedPage] = useState(currentPage)
  if (trackedPage !== currentPage) {
    setTrackedPage(currentPage)
    setDraft(String(currentPage))
  }

  function commitPage() {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(String(currentPage))
      return
    }
    if (parsed === currentPage) return
    goToPage(parsed)
  }

  return (
    <div className="toolbar-frame">
      <header className="toolbar">
      <div className="toolbar-start">
        <AppMenu />
        <div className="brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <h1 className="wordmark">Bazure</h1>
        </div>
        {fileName ? (
          <>
            <span className="file-rule" aria-hidden="true" />
            <span className="file-name" title={fileName}>
              {fileName}
            </span>
          </>
        ) : null}
      </div>

      <div className="page-nav">
        <ToolButton
          icon
          aria-label="Previous page"
          disabled={!ready || currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <Chevron direction="left" />
        </ToolButton>
        <input
          className="page-field"
          aria-label="Page number"
          inputMode="numeric"
          disabled={!ready}
          value={ready ? draft : '—'}
          style={{ width: `${Math.max(2, String(pageCount || 1).length)}ch` }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitPage}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
        <span className="page-total">{ready ? `of ${pageCount}` : 'of —'}</span>
        <ToolButton
          icon
          aria-label="Next page"
          disabled={!ready || currentPage >= pageCount}
          onClick={() => goToPage(currentPage + 1)}
        >
          <Chevron direction="right" />
        </ToolButton>
      </div>

      <div className="toolbar-end">
        <div className="tool-cluster">
          <ToolButton
            icon
            aria-label="Zoom out"
            disabled={!ready}
            onClick={() => zoomBy(1 / ZOOM_STEP)}
          >
            <MinusIcon />
          </ToolButton>
          <ToolButton
            className="zoom-readout"
            aria-label="Actual size"
            title="Actual size"
            disabled={!ready}
            onClick={setActualSize}
          >
            <span>{ready ? percent : '—'}</span>
            <span className="zoom-unit">%</span>
          </ToolButton>
          <ToolButton icon aria-label="Zoom in" disabled={!ready} onClick={() => zoomBy(ZOOM_STEP)}>
            <PlusIcon />
          </ToolButton>
        </div>
        <span className="cluster-rule" aria-hidden="true" />
        <div className="tool-cluster">
          <ToolButton
            active={ready && zoomMode === 'fit-page'}
            disabled={!ready}
            onClick={() => setZoomMode('fit-page')}
          >
            Fit page
          </ToolButton>
          <ToolButton
            active={ready && zoomMode === 'fit-width'}
            disabled={!ready}
            onClick={() => setZoomMode('fit-width')}
          >
            Fit width
          </ToolButton>
        </div>
        <span className="cluster-rule" aria-hidden="true" />
        <div className="tool-cluster" role="group" aria-label="Reading mode">
          <ToolButton
            active={ready && readingMode === 'continuous'}
            disabled={!ready}
            onClick={() => setReadingMode('continuous')}
          >
            Continuous
          </ToolButton>
          <ToolButton
            active={ready && readingMode === 'single'}
            disabled={!ready}
            onClick={() => setReadingMode('single')}
          >
            Single
          </ToolButton>
        </div>
      </div>
    </header>
      {status === 'opening' ? (
        <div className="loading-rule" role="progressbar" aria-label="Opening PDF">
          <span />
        </div>
      ) : null}
    </div>
  )
}

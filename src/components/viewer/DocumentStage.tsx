import { useEffect, useState } from 'react'
import { resolveZoom } from '../../lib/zoom'
import { useToolStore } from '../../state/toolStore'
import { resolvedZoom, useViewerStore } from '../../state/viewerStore'
import { ContinuousView } from './ContinuousView'
import { PasswordSheet } from './PasswordSheet'
import { SinglePageView } from './SinglePageView'
import { EmptyState, ErrorState, OpeningState } from './StatusSheets'

type DocumentStageProps = {
  onOpen: () => void
  dragging: boolean
}

export function DocumentStage({ onOpen, dragging }: DocumentStageProps) {
  const status = useViewerStore((state) => state.status)
  const error = useViewerStore((state) => state.error)
  const readingMode = useViewerStore((state) => state.readingMode)
  const zoomMode = useViewerStore((state) => state.zoomMode)
  const customZoom = useViewerStore((state) => state.customZoom)
  const pageSizes = useViewerStore((state) => state.pageSizes)
  const currentPage = useViewerStore((state) => state.currentPage)
  const fileName = useViewerStore((state) => state.fileName)
  const place = useToolStore((state) => state.place)
  const setDisplayZoom = useViewerStore((state) => state.setDisplayZoom)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const stage = document.querySelector('[data-scroll-root]')
    if (!(stage instanceof HTMLElement)) return

    const measure = () => {
      setViewport({ width: stage.clientWidth, height: stage.clientHeight })
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const documentId = useViewerStore((state) => state.documentId)

  useEffect(() => {
    const stage = document.querySelector('[data-scroll-root]')
    if (stage instanceof HTMLElement) stage.scrollTop = 0
  }, [documentId])

  const page = pageSizes[currentPage - 1] ?? pageSizes[0]
  const widest = pageSizes.reduce((max, size) => Math.max(max, size.width), 0)
  const scale =
    status === 'ready' && page && viewport.width > 0
      ? resolveZoom({
          mode: zoomMode,
          customZoom,
          page,
          widest,
          viewport,
        })
      : null

  useEffect(() => {
    if (scale == null) return
    resolvedZoom.current = scale
    setDisplayZoom(scale)
  }, [scale, setDisplayZoom])

  return (
    <>
      {dragging && fileName ? <p className="drop-hint">Drop to open a different PDF</p> : null}
      {place && status === 'ready' && !dragging ? (
        <p className="drop-hint">
          {place.kind === 'cover' ? 'Drag on the page to cover a passage.' : 'Click the page to place it.'} Escape
          cancels.
        </p>
      ) : null}
      {status === 'empty' ? <EmptyState onOpen={onOpen} /> : null}
      {status === 'opening' ? <OpeningState /> : null}
      {status === 'password' ? <PasswordSheet /> : null}
      {status === 'error' ? <ErrorState message={error ?? 'Something went wrong while reading this file.'} onOpen={onOpen} /> : null}
      {status === 'ready' && scale != null && readingMode === 'continuous' ? (
        <ContinuousView scale={roundScale(scale)} />
      ) : null}
      {status === 'ready' && scale != null && readingMode === 'single' ? (
        <SinglePageView scale={roundScale(scale)} />
      ) : null}
    </>
  )
}

function roundScale(scale: number) {
  return Math.round(scale * 1000) / 1000
}

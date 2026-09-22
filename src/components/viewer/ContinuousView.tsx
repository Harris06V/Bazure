import { useEffect } from 'react'
import { snapPageBox } from '../../lib/zoom'
import { takeScrollRequest, useViewerStore } from '../../state/viewerStore'
import { PageSheet } from './PageSheet'

type ContinuousViewProps = {
  scale: number
}

export function ContinuousView({ scale }: ContinuousViewProps) {
  const documentId = useViewerStore((state) => state.documentId)
  const pageSizes = useViewerStore((state) => state.pageSizes)
  const pageCount = useViewerStore((state) => state.pageCount)
  const currentPage = useViewerStore((state) => state.currentPage)
  const scrollNonce = useViewerStore((state) => state.scrollNonce)
  const setCurrentPageFromScroll = useViewerStore((state) => state.setCurrentPageFromScroll)

  useEffect(() => {
    const page = takeScrollRequest()
    if (page == null) return
    const root = document.querySelector('[data-scroll-root]')
    const target = root?.querySelector(`[data-page="${page}"]`)
    target?.scrollIntoView({ block: 'start', inline: 'nearest' })
  }, [scrollNonce])

  useEffect(() => {
    const root = document.querySelector('[data-scroll-root]')
    if (!(root instanceof HTMLElement)) return

    let frame = 0
    const update = () => {
      frame = 0
      const pages = root.querySelectorAll<HTMLElement>('[data-page]')
      const rootTop = root.getBoundingClientRect().top
      const marker = root.clientHeight * 0.35
      let visiblePage = 1
      for (const element of pages) {
        const top = element.getBoundingClientRect().top - rootTop
        if (top <= marker) visiblePage = Number(element.dataset.page)
        else break
      }
      if (Number.isFinite(visiblePage)) setCurrentPageFromScroll(visiblePage)
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [setCurrentPageFromScroll, pageCount])

  if (!documentId) return null

  return (
    <div className="continuous-view">
      {Array.from({ length: pageCount }, (_, index) => {
        const pageNumber = index + 1
        const size = pageSizes[index] ?? pageSizes[0]
        if (!size) return null
        const box = snapPageBox(size, scale, window.devicePixelRatio || 1)
        return (
          <PageSheet
            key={`${documentId}-${pageNumber}`}
            documentId={documentId}
            pageNumber={pageNumber}
            width={box.width}
            height={box.height}
            scale={scale}
            eager={Math.abs(pageNumber - currentPage) <= 1}
          />
        )
      })}
    </div>
  )
}

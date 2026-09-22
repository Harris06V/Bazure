import { snapPageBox } from '../../lib/zoom'
import { useViewerStore } from '../../state/viewerStore'
import { PageSheet } from './PageSheet'

type SinglePageViewProps = {
  scale: number
}

export function SinglePageView({ scale }: SinglePageViewProps) {
  const documentId = useViewerStore((state) => state.documentId)
  const pageSizes = useViewerStore((state) => state.pageSizes)
  const currentPage = useViewerStore((state) => state.currentPage)
  const size = pageSizes[currentPage - 1] ?? pageSizes[0]

  if (!documentId || !size) return null

  const box = snapPageBox(size, scale, window.devicePixelRatio || 1)

  return (
    <div className="single-view">
      <PageSheet
        key={`${documentId}-${currentPage}`}
        documentId={documentId}
        pageNumber={currentPage}
        width={box.width}
        height={box.height}
        scale={scale}
        eager
      />
    </div>
  )
}

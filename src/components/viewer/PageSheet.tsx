import { useEffect, useRef, useState } from 'react'
import {
  AnnotationLayer,
  AnnotationMode,
  OutputScale,
  RenderingCancelledException,
  TextLayer,
  XfaLayer,
  type RenderTask,
} from 'pdfjs-dist'
import { createLinkService } from '../../lib/pdf/linkService'
import { getActiveDocument } from '../../lib/pdf/session'
import { bindTextSelection } from '../../lib/pdf/textSelection'
import { MarkupLayer } from './MarkupLayer'
import { CSS_UNITS } from '../../lib/zoom'

type PageSheetProps = {
  documentId: string
  pageNumber: number
  width: number
  height: number
  scale: number
  eager?: boolean
}

export function PageSheet({
  documentId,
  pageNumber,
  width,
  height,
  scale,
  eager = false,
}: PageSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const annotationRef = useRef<HTMLDivElement>(null)
  const [nearView, setNearView] = useState(eager)
  const shouldPaint = eager || nearView

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const root = sheet.closest('[data-scroll-root]')
    const observer = new IntersectionObserver(
      ([entry]) => {
        setNearView(entry?.isIntersecting ?? false)
      },
      {
        root: root instanceof Element ? root : null,
        rootMargin: '800px 0px',
      },
    )
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const textLayerEl = textRef.current
    const annotationEl = annotationRef.current
    if (!canvas || !textLayerEl || !annotationEl || !shouldPaint || width < 1 || height < 1) return

    const doc = getActiveDocument(documentId)
    if (!doc) return

    let cancelled = false
    let renderTask: RenderTask | null = null
    let textLayer: TextLayer | null = null
    let annotationLayer: AnnotationLayer | null = null
    let unbindSelection = () => {}

    textLayerEl.replaceChildren()
    annotationEl.replaceChildren()

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return

        const viewport = page.getViewport({ scale: scale * CSS_UNITS })
        const output = new OutputScale()
        if (scale < 1.25) {
          output.sx = Math.max(output.sx, 2)
          output.sy = output.sx
        }
        output.limitCanvas(width, height, 0, 8192)

        const bitmapWidth = Math.max(1, Math.round(width * output.sx))
        const bitmapHeight = Math.max(1, Math.round(height * output.sy))
        canvas.width = bitmapWidth
        canvas.height = bitmapHeight
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`

        const transform = [
          bitmapWidth / viewport.width,
          0,
          0,
          bitmapHeight / viewport.height,
          0,
          0,
        ]

        renderTask = page.render({
          canvas,
          viewport,
          transform,
          annotationMode: AnnotationMode.ENABLE_FORMS,
          background: '#ffffff',
        })

        const linkService = createLinkService(documentId)
        const textPromise = (async () => {
          textLayer = new TextLayer({
            textContentSource: page.streamTextContent({
              includeMarkedContent: true,
              disableNormalization: true,
            }),
            container: textLayerEl,
            viewport,
          })
          await textLayer.render()
          if (cancelled) return
          unbindSelection = bindTextSelection(textLayerEl)
        })()

        const annotationPromise = (async () => {
          if (page.isPureXfa) {
            const xfaHtml = await page.getXfa()
            if (cancelled || !xfaHtml) return
            XfaLayer.render({
              viewport,
              div: annotationEl,
              xfaHtml,
              annotationStorage: doc.annotationStorage,
              linkService: linkService as never,
            })
            return
          }

          const annotations = await page.getAnnotations({ intent: 'display' })
          if (cancelled || annotations.length === 0) return
          annotationLayer = new AnnotationLayer({
            div: annotationEl,
            accessibilityManager: null,
            annotationCanvasMap: null,
            annotationEditorUIManager: null,
            page,
            viewport,
            structTreeLayer: null,
            commentManager: null,
            linkService,
            annotationStorage: doc.annotationStorage,
          })
          await annotationLayer.render({
            viewport,
            div: annotationEl,
            annotations,
            page,
            linkService: linkService as never,
            renderForms: true,
            annotationStorage: doc.annotationStorage,
          })
        })()

        await Promise.all([renderTask.promise, textPromise, annotationPromise])
      } catch (error) {
        if (cancelled || error instanceof RenderingCancelledException) return
      }
    })()

    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
      annotationLayer?.destroy()
      unbindSelection()
      textLayerEl.replaceChildren()
      annotationEl.replaceChildren()
    }
  }, [documentId, pageNumber, scale, shouldPaint, width, height])

  return (
    <article
      ref={sheetRef}
      className="paper page-sheet"
      data-page={pageNumber}
      style={{
        width,
        height,
        ['--scale-factor' as string]: scale * CSS_UNITS,
      }}
      aria-label={`Page ${pageNumber}`}
    >
      <canvas ref={canvasRef} />
      <div ref={textRef} className="textLayer" />
      <div ref={annotationRef} className="annotationLayer" />
      <MarkupLayer pageNumber={pageNumber} width={width} height={height} />
    </article>
  )
}

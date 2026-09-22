import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { markupId, stampSlug, type NormBox } from '../../lib/pdf/markup'
import { useMarkupStore } from '../../state/markupStore'
import { useToolStore } from '../../state/toolStore'
import { useViewerStore } from '../../state/viewerStore'

type MarkupLayerProps = {
  pageNumber: number
  width: number
  height: number
}

function boxStyle(box: NormBox): CSSProperties {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  }
}

function clampBox(box: NormBox): NormBox {
  const x = Math.min(Math.max(0, box.x), 0.98)
  const y = Math.min(Math.max(0, box.y), 0.98)
  return {
    x,
    y,
    w: Math.min(box.w, 1 - x),
    h: Math.min(box.h, 1 - y),
  }
}

export function MarkupLayer({ pageNumber, width, height }: MarkupLayerProps) {
  const items = useMarkupStore((state) => state.items)
  const add = useMarkupStore((state) => state.add)
  const remove = useMarkupStore((state) => state.remove)
  const setText = useMarkupStore((state) => state.setText)
  const place = useToolStore((state) => state.place)
  const textSize = useToolStore((state) => state.textSize)
  const pageSize = useViewerStore((state) => state.pageSizes[pageNumber - 1])
  const pageItems = items.filter((item) => item.page === pageNumber)
  const anchor = useRef<{ x: number; y: number } | null>(null)
  const draftRef = useRef<NormBox | null>(null)
  const [draft, setDraft] = useState<NormBox | null>(null)
  const [composer, setComposer] = useState<{ x: number; y: number; kind: 'text' | 'note'; value: string } | null>(
    null,
  )
  const [openNote, setOpenNote] = useState<string | null>(null)
  const pxPerPoint = pageSize ? height / pageSize.height : 1

  function pointOf(event: { clientX: number; clientY: number; currentTarget: Element }) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || place?.kind !== 'cover') return
    const point = pointOf(event)
    anchor.current = point
    setDraft({ ...point, w: 0, h: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = anchor.current
    if (!start) return
    const point = pointOf(event)
    const box = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    }
    draftRef.current = box
    setDraft(box)
  }

  function onPointerUp() {
    const box = draftRef.current
    anchor.current = null
    draftRef.current = null
    if (!box) return
    if (box.w > 0.01 && box.h > 0.008) {
      add({ id: markupId(), kind: 'cover', page: pageNumber, ...clampBox(box) })
    }
    setDraft(null)
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !place || place.kind === 'cover' || composer) return
    const point = pointOf(event)
    if (place.kind === 'text' || place.kind === 'note') {
      setComposer({ ...point, kind: place.kind, value: '' })
      return
    }
    if (place.kind === 'date') {
      const text = new Intl.DateTimeFormat('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date())
      add({ id: markupId(), kind: 'text', page: pageNumber, x: point.x, y: point.y, text, size: 12 })
      return
    }
    if (place.kind === 'stamp') {
      add({
        id: markupId(),
        kind: 'stamp',
        page: pageNumber,
        label: place.label,
        ...clampBox({ x: point.x - 0.17, y: point.y - 0.045, w: 0.34, h: 0.09 }),
      })
      return
    }
    const w = place.name === 'Signature' ? 0.32 : 0.4
    const h = Math.min(0.7, (w * width) / (place.aspect * height))
    add({
      id: markupId(),
      kind: 'picture',
      page: pageNumber,
      src: place.src,
      name: place.name,
      ...clampBox({ x: point.x - w / 2, y: point.y - h / 2, w, h }),
    })
  }

  function commitComposer() {
    if (!composer) return
    const text = composer.value.trim()
    if (text) {
      if (composer.kind === 'note') {
        add({ id: markupId(), kind: 'note', page: pageNumber, x: composer.x, y: composer.y, text })
      } else {
        add({
          id: markupId(),
          kind: 'text',
          page: pageNumber,
          x: composer.x,
          y: composer.y,
          text,
          size: textSize,
        })
      }
    }
    setComposer(null)
  }

  return (
    <>
      <div className="markup-under">
        {pageItems.map((item) => {
          if (item.kind !== 'highlight' && item.kind !== 'underline' && item.kind !== 'strike') return null
          return item.rects.map((rect, index) => (
            <span key={`${item.id}-${index}`} className={`mark-${item.kind}`} style={boxStyle(rect)} />
          ))
        })}
      </div>
      <div
        className={place ? 'markup-over is-placing' : 'markup-over'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
      >
        {draft ? <span className="mark-cover" style={boxStyle(draft)} /> : null}
        {pageItems.map((item) => {
          if (item.kind === 'highlight' || item.kind === 'underline' || item.kind === 'strike') return null
          if (item.kind === 'cover') {
            return (
              <span key={item.id} className="mark-hit" style={boxStyle(item)}>
                <span className="mark-cover" />
                <button type="button" className="mark-x" aria-label="Remove cover" onClick={() => remove(item.id)}>
                  ×
                </button>
              </span>
            )
          }
          if (item.kind === 'text') {
            return (
              <span
                key={item.id}
                className="mark-hit mark-text"
                style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, fontSize: item.size * pxPerPoint }}
              >
                {item.text}
                <button type="button" className="mark-x" aria-label="Remove text" onClick={() => remove(item.id)}>
                  ×
                </button>
              </span>
            )
          }
          if (item.kind === 'stamp') {
            return (
              <span key={item.id} className="mark-hit" style={boxStyle(item)}>
                <span className={`mark-stamp stamp-${stampSlug(item.label)}`}>{item.label}</span>
                <button type="button" className="mark-x" aria-label="Remove stamp" onClick={() => remove(item.id)}>
                  ×
                </button>
              </span>
            )
          }
          if (item.kind === 'picture') {
            return (
              <span key={item.id} className="mark-hit" style={boxStyle(item)}>
                <img className="mark-picture" src={item.src} alt={item.name} />
                <button type="button" className="mark-x" aria-label={`Remove ${item.name}`} onClick={() => remove(item.id)}>
                  ×
                </button>
              </span>
            )
          }
          if (item.kind !== 'note') return null
          return (
            <span key={item.id} className="mark-note-wrap" style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}>
              <button
                type="button"
                className="mark-note"
                aria-label={item.text || 'Note'}
                onClick={() => setOpenNote(openNote === item.id ? null : item.id)}
              />
              {openNote === item.id ? (
                <textarea
                  className="note-pop"
                  value={item.text}
                  aria-label="Note text"
                  onChange={(event) => setText(item.id, event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                />
              ) : null}
              <button type="button" className="mark-x" aria-label="Remove note" onClick={() => remove(item.id)}>
                ×
              </button>
            </span>
          )
        })}
        {composer ? (
          <form
            className="markup-composer"
            style={{ left: `${composer.x * 100}%`, top: `${composer.y * 100}%` }}
            onSubmit={(event) => {
              event.preventDefault()
              commitComposer()
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <textarea
              autoFocus
              rows={composer.kind === 'note' ? 3 : 2}
              placeholder={composer.kind === 'note' ? 'Write a note' : 'Type'}
              value={composer.value}
              onChange={(event) => setComposer({ ...composer, value: event.target.value })}
              onBlur={commitComposer}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  commitComposer()
                }
              }}
            />
          </form>
        ) : null}
      </div>
    </>
  )
}

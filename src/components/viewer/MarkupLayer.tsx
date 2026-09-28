import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { digitalSignTimestamp, markupId, stampSlug, type Markup, type NormBox } from '../../lib/pdf/markup'
import { useMarkupStore } from '../../state/markupStore'
import { useSignFieldStore } from '../../state/signFieldStore'
import { useToolStore } from '../../state/toolStore'
import { useViewerStore } from '../../state/viewerStore'

type MarkupLayerProps = {
  pageNumber: number
  width: number
  height: number
}

type MovableMarkup = Extract<Markup, { x: number }>
type Corner = 'nw' | 'ne' | 'sw' | 'se'

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const MIN_SIZE = 0.015
const DRAG_THRESHOLD_PX = 3

type Drag =
  | { mode: 'move'; id: string; started: boolean; startX: number; startY: number; offsetX: number; offsetY: number; w: number; h: number }
  | { mode: 'resize'; id: string; started: boolean; corner: Corner; start: NormBox; keepAspect: boolean }
  | { mode: 'font'; id: string; started: boolean; startY: number; startSize: number; startHeight: number }

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

function resizeBox(start: NormBox, corner: Corner, point: { x: number; y: number }, keepAspect: boolean): NormBox {
  const fromLeft = corner === 'nw' || corner === 'sw'
  const fromTop = corner === 'nw' || corner === 'ne'
  const fixedX = fromLeft ? start.x + start.w : start.x
  const fixedY = fromTop ? start.y + start.h : start.y
  const px = Math.min(Math.max(0, point.x), 1)
  const py = Math.min(Math.max(0, point.y), 1)
  let w = Math.max(MIN_SIZE, fromLeft ? fixedX - px : px - fixedX)
  let h = Math.max(MIN_SIZE, fromTop ? fixedY - py : py - fixedY)
  if (keepAspect && start.h > 0) {
    const ratio = start.w / start.h
    if (w / h > ratio) h = w / ratio
    else w = h * ratio
  }
  const x = fromLeft ? fixedX - w : fixedX
  const y = fromTop ? fixedY - h : fixedY
  return clampBox({ x: Math.max(0, x), y: Math.max(0, y), w, h })
}

export function MarkupLayer({ pageNumber, width, height }: MarkupLayerProps) {
  const items = useMarkupStore((state) => state.items)
  const add = useMarkupStore((state) => state.add)
  const remove = useMarkupStore((state) => state.remove)
  const setText = useMarkupStore((state) => state.setText)
  const update = useMarkupStore((state) => state.update)
  const checkpoint = useMarkupStore((state) => state.checkpoint)
  const selectedId = useMarkupStore((state) => state.selectedId)
  const select = useMarkupStore((state) => state.select)
  const active = useToolStore((state) => state.active)
  const selecting = active === 'select'
  const place = useToolStore((state) => state.place)
  const textSize = useToolStore((state) => state.textSize)
  const openSignField = useToolStore((state) => state.openSignField)
  const signFields = useSignFieldStore((state) => state.fields)
  const signedIds = useSignFieldStore((state) => state.signedIds)
  const pendingSignFields = signFields.filter(
    (field) => field.page === pageNumber && !signedIds.includes(field.id),
  )
  const pageSize = useViewerStore((state) => state.pageSizes[pageNumber - 1])
  const pageItems = items.filter((item) => item.page === pageNumber)
  const overRef = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ x: number; y: number } | null>(null)
  const draftRef = useRef<NormBox | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [draft, setDraft] = useState<NormBox | null>(null)
  const [composer, setComposer] = useState<{
    x: number
    y: number
    kind: 'text' | 'note'
    value: string
    editId?: string
  } | null>(null)
  const [openNote, setOpenNote] = useState<string | null>(null)
  const pxPerPoint = pageSize ? height / pageSize.height : 1

  function pointOf(event: { clientX: number; clientY: number; currentTarget: Element }) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }
  }

  function containerPoint(clientX: number, clientY: number) {
    const bounds = overRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 0, y: 0 }
    return {
      x: (clientX - bounds.left) / bounds.width,
      y: (clientY - bounds.top) / bounds.height,
    }
  }

  function onItemPointerDown(event: ReactPointerEvent<HTMLElement>, item: MovableMarkup) {
    if (!selecting || event.button !== 0) return
    event.stopPropagation()
    select(item.id)
    const point = containerPoint(event.clientX, event.clientY)
    dragRef.current = {
      mode: 'move',
      id: item.id,
      started: false,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: point.x - item.x,
      offsetY: point.y - item.y,
      w: 'w' in item ? item.w : 0,
      h: 'h' in item ? item.h : 0,
    }
  }

  function onHandlePointerDown(event: ReactPointerEvent<HTMLElement>, item: MovableMarkup, corner: Corner) {
    event.stopPropagation()
    if (event.button !== 0) return
    if (item.kind === 'text') {
      const host = event.currentTarget.parentElement
      dragRef.current = {
        mode: 'font',
        id: item.id,
        started: false,
        startY: event.clientY,
        startSize: item.size,
        startHeight: Math.max(1, host?.getBoundingClientRect().height ?? 1),
      }
    } else if ('w' in item) {
      dragRef.current = {
        mode: 'resize',
        id: item.id,
        started: false,
        corner,
        start: { x: item.x, y: item.y, w: item.w, h: item.h },
        keepAspect: item.kind === 'picture' || item.kind === 'esign',
      }
    }
    overRef.current?.setPointerCapture(event.pointerId)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (selecting) {
      select(null)
      return
    }
    if (place?.kind !== 'cover') return
    const point = pointOf(event)
    anchor.current = point
    setDraft({ ...point, w: 0, h: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (drag) {
      if (!drag.started) {
        if (
          drag.mode === 'move' &&
          Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX
        ) {
          return
        }
        drag.started = true
        checkpoint()
        overRef.current?.setPointerCapture(event.pointerId)
      }
      const point = containerPoint(event.clientX, event.clientY)
      if (drag.mode === 'move') {
        const x = Math.min(Math.max(0, point.x - drag.offsetX), 1 - drag.w)
        const y = Math.min(Math.max(0, point.y - drag.offsetY), 1 - drag.h)
        update(drag.id, (item) => ('x' in item ? { ...item, x, y } : item))
      } else if (drag.mode === 'resize') {
        const box = resizeBox(drag.start, drag.corner, point, event.shiftKey ? !drag.keepAspect : drag.keepAspect)
        update(drag.id, (item) => ('w' in item ? { ...item, ...box } : item))
      } else {
        const factor = (drag.startHeight + event.clientY - drag.startY) / drag.startHeight
        const size = Math.min(144, Math.max(6, Math.round(drag.startSize * factor)))
        update(drag.id, (item) => (item.kind === 'text' ? { ...item, size } : item))
      }
      return
    }
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
    if (dragRef.current) {
      dragRef.current = null
      return
    }
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
    if (place.kind === 'esign') {
      const w = 0.42
      const h = 0.09
      add({
        id: markupId(),
        kind: 'esign',
        page: pageNumber,
        src: place.src,
        name: place.name,
        timestamp: digitalSignTimestamp(new Date()),
        ...clampBox({ x: point.x - w / 2, y: point.y - h / 2, w, h }),
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
    if (composer.editId) {
      const editId = composer.editId
      if (!text) remove(editId)
      else {
        checkpoint()
        update(editId, (item) => (item.kind === 'text' ? { ...item, text } : item))
      }
      setComposer(null)
      return
    }
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

  function frame(item: MovableMarkup, className: string, style: CSSProperties, removeLabel: string, body: ReactNode) {
    const selected = selecting && selectedId === item.id
    const resizable = item.kind !== 'note'
    return (
      <span
        key={item.id}
        className={selected ? `${className} is-selected` : className}
        style={style}
        onPointerDown={(event) => onItemPointerDown(event, item)}
        onDoubleClick={(event) => {
          if (!selecting || item.kind !== 'text') return
          event.stopPropagation()
          setComposer({ x: item.x, y: item.y, kind: 'text', value: item.text, editId: item.id })
        }}
      >
        {body}
        {selected && resizable
          ? (item.kind === 'text' ? (['se'] as Corner[]) : CORNERS).map((corner) => (
              <span
                key={corner}
                className={`mark-handle handle-${corner}`}
                aria-hidden="true"
                onPointerDown={(event) => onHandlePointerDown(event, item, corner)}
              />
            ))
          : null}
        <button
          type="button"
          className="mark-x"
          aria-label={removeLabel}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => remove(item.id)}
        >
          ×
        </button>
      </span>
    )
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
        ref={overRef}
        className={[
          'markup-over',
          place ? 'is-placing' : '',
          active === 'select' ? 'is-select' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
      >
        {draft ? <span className="mark-cover" style={boxStyle(draft)} /> : null}
        {pageItems.map((item) => {
          if (!('x' in item)) return null
          if (composer?.editId === item.id) return null
          if (item.kind === 'cover') {
            return frame(item, 'mark-hit', boxStyle(item), 'Remove cover', <span className="mark-cover" />)
          }
          if (item.kind === 'text') {
            return frame(
              item,
              'mark-hit mark-text',
              { left: `${item.x * 100}%`, top: `${item.y * 100}%`, fontSize: item.size * pxPerPoint },
              'Remove text',
              item.text,
            )
          }
          if (item.kind === 'stamp') {
            return frame(
              item,
              'mark-hit',
              boxStyle(item),
              'Remove stamp',
              <span className={`mark-stamp stamp-${stampSlug(item.label)}`}>{item.label}</span>,
            )
          }
          if (item.kind === 'picture') {
            return frame(
              item,
              'mark-hit',
              boxStyle(item),
              `Remove ${item.name}`,
              <img className="mark-picture" src={item.src} alt={item.name} draggable={false} />,
            )
          }
          if (item.kind === 'esign') {
            return frame(
              item,
              'mark-hit',
              boxStyle(item),
              'Remove signature',
              <span className="mark-esign">
                <span className="mark-esign-left">
                  <img className="mark-esign-img" src={item.src} alt={item.name} draggable={false} />
                </span>
                <span className="mark-esign-divider" />
                <span className="mark-esign-right">
                  <span className="mark-esign-line" style={{ fontSize: item.h * height * 0.11 }}>
                    Digitally signed by {item.name}
                  </span>
                  <span className="mark-esign-line" style={{ fontSize: item.h * height * 0.11 }}>
                    Date: {item.timestamp}
                  </span>
                </span>
              </span>,
            )
          }
          return frame(
            item,
            'mark-note-wrap',
            { left: `${item.x * 100}%`, top: `${item.y * 100}%` },
            'Remove note',
            <>
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
                  onFocus={checkpoint}
                  onChange={(event) => setText(item.id, event.target.value)}
                  onPointerDown={(event) => event.stopPropagation()}
                />
              ) : null}
            </>,
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
      {pendingSignFields.length > 0 ? (
        <div className="sign-field-layer">
          {pendingSignFields.map((field) => (
            <button
              key={field.id}
              type="button"
              className="sign-field-hit"
              style={boxStyle(field.box)}
              onClick={() => openSignField({ fieldId: field.id, page: field.page, box: field.box })}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M2 12.5c2-3 3-1 4-2s1-3 3-3 2 3 4 1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              Click here to sign
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}

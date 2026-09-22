import { useEffect, useState } from 'react'
import { AnnotationMode } from 'pdfjs-dist'
import { rebuildPages, type PageOp } from '../../../lib/pdf/assemble'
import { downloadBytes, pdfNameFrom } from '../../../lib/pdf/download'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { getActiveDocument } from '../../../lib/pdf/session'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../useTask'
import { ChoiceButton, NeedsPdf, TaskStatus } from '../ui'

function identity(count: number): PageOp[] {
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    source: index,
    rotation: 0 as const,
  }))
}

export function OrganizePanel() {
  const documentId = useViewerStore((state) => state.documentId)
  const pageCount = useViewerStore((state) => state.pageCount)
  const fileName = useViewerStore((state) => state.fileName)
  const openBytes = useViewerStore((state) => state.openBytes)
  const goToPage = useViewerStore((state) => state.goToPage)
  const signature = `${documentId ?? ''}:${pageCount}`
  const [synced, setSynced] = useState(signature)
  const [items, setItems] = useState<PageOp[]>(() => identity(pageCount))
  const [selected, setSelected] = useState<string[]>([])
  const [numberPages, setNumberPages] = useState(false)
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const { pending, error, run } = useTask()

  if (synced !== signature) {
    setSynced(signature)
    setItems(identity(pageCount))
    setSelected([])
    setThumbs({})
  }

  useEffect(() => {
    const doc = getActiveDocument(documentId)
    if (!doc || pageCount < 1) return
    let cancelled = false
    void (async () => {
      const next: Record<number, string> = {}
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
        if (cancelled) return
        const page = await doc.getPage(pageNumber)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 120 / base.width })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(viewport.width))
        canvas.height = Math.max(1, Math.round(viewport.height))
        await page.render({ canvas, viewport, annotationMode: AnnotationMode.ENABLE }).promise
        next[pageNumber - 1] = canvas.toDataURL('image/jpeg', 0.7)
        if (!cancelled) setThumbs({ ...next })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [documentId, pageCount])

  const chosen = items.filter((item) => selected.includes(item.id))

  function rotate(delta: number) {
    if (chosen.length === 0) return
    setItems((current) =>
      current.map((item) => {
        if (!selected.includes(item.id)) return item
        const rotation = (((item.rotation + delta) % 360) + 360) % 360
        return { ...item, rotation: rotation as PageOp['rotation'] }
      }),
    )
  }

  function move(delta: number) {
    if (chosen.length !== 1) return
    setItems((current) => {
      const index = current.findIndex((item) => item.id === chosen[0].id)
      const next = index + delta
      if (index < 0 || next < 0 || next >= current.length) return current
      const copy = current.slice()
      const [item] = copy.splice(index, 1)
      copy.splice(next, 0, item)
      return copy
    })
  }

  return (
    <NeedsPdf>
      <p className="panel-note">Select pages, then rotate, reorder, or remove them.</p>
      <div className="org-grid">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={selected.includes(item.id) ? 'org-card is-selected' : 'org-card'}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData('text/plain')
              if (!id || id === item.id) return
              setItems((current) => {
                const from = current.findIndex((entry) => entry.id === id)
                const to = current.findIndex((entry) => entry.id === item.id)
                if (from < 0 || to < 0) return current
                const copy = current.slice()
                const [moved] = copy.splice(from, 1)
                copy.splice(to, 0, moved)
                return copy
              })
            }}
            onClick={() => {
              setSelected((current) =>
                current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
              )
              if (typeof item.source === 'number') goToPage(item.source + 1)
            }}
          >
            {typeof item.source === 'number' && thumbs[item.source] ? (
              <img
                src={thumbs[item.source]}
                alt=""
                style={{ transform: `rotate(${item.rotation}deg)` }}
              />
            ) : (
              <span className="org-blank">Blank</span>
            )}
            <span>
              {index + 1}
              {item.rotation ? ` · ${item.rotation}°` : ''}
            </span>
          </button>
        ))}
      </div>
      <div className="pair-row">
        <ChoiceButton disabled={chosen.length === 0} onClick={() => rotate(-90)}>
          Rotate left
        </ChoiceButton>
        <ChoiceButton disabled={chosen.length === 0} onClick={() => rotate(90)}>
          Rotate right
        </ChoiceButton>
      </div>
      <div className="pair-row">
        <ChoiceButton disabled={chosen.length !== 1} onClick={() => move(-1)}>
          Move earlier
        </ChoiceButton>
        <ChoiceButton disabled={chosen.length !== 1} onClick={() => move(1)}>
          Move later
        </ChoiceButton>
      </div>
      <ChoiceButton
        disabled={chosen.length === 0}
        onClick={() => {
          setItems((current) => {
            const next = current.filter((item) => !selected.includes(item.id))
            return next.length === 0 ? current : next
          })
          setSelected([])
        }}
      >
        Delete
      </ChoiceButton>
      <ChoiceButton
        disabled={chosen.length === 0}
        onClick={() => {
          setItems((current) => {
            const next = [...current]
            for (const item of chosen) {
              const index = next.findIndex((entry) => entry.id === item.id)
              next.splice(index + 1, 0, { ...item, id: crypto.randomUUID() })
            }
            return next
          })
        }}
      >
        Duplicate
      </ChoiceButton>
      <ChoiceButton
        onClick={() => {
          const after = chosen[0]
          setItems((current) => {
            const blank: PageOp = { id: crypto.randomUUID(), source: 'blank', rotation: 0 }
            if (!after) return [...current, blank]
            const index = current.findIndex((item) => item.id === after.id)
            const next = current.slice()
            next.splice(index + 1, 0, blank)
            return next
          })
        }}
      >
        Insert blank page
      </ChoiceButton>
      <label className="check-row">
        <input
          type="checkbox"
          checked={numberPages}
          onChange={(event) => setNumberPages(event.target.checked)}
        />
        <span>Add page numbers</span>
      </label>
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null || items.length === 0}
        onClick={() => {
          void run('Updating pages', async () => {
            const bytes = await rebuildPages(await workingBytes(), items, numberPages)
            await openBytes(fileName ?? 'document.pdf', bytes)
          })
        }}
      >
        Apply
      </button>
      <ChoiceButton
        disabled={pending !== null || chosen.length === 0}
        onClick={() => {
          void run('Extracting', async () => {
            const bytes = await rebuildPages(await workingBytes(), chosen, false)
            const name = pdfNameFrom(fileName ?? 'document.pdf').replace(/\.pdf$/i, '')
            downloadBytes(bytes, `${name}-pages.pdf`, 'application/pdf')
          })
        }}
      >
        Download selected
      </ChoiceButton>
      <TaskStatus pending={pending} error={error} />
    </NeedsPdf>
  )
}

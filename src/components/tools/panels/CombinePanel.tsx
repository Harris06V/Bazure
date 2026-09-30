import { useEffect, useRef, useState } from 'react'
import { buildPdf } from '../../../lib/pdf/assemble'
import { isDesktop, pickMergeSources } from '../../../lib/desktop'
import { isImageName } from '../../../lib/pdf/images'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { filePreview } from '../../../lib/pdf/preview'
import { useTabStore } from '../../../state/tabStore'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../../../hooks/useTask'
import { ChoiceButton, TaskStatus } from '../ui'

type Source = { name: string; bytes: Uint8Array }

type Piece = {
  id: string
  name: string
  bytes: Uint8Array
  preview: string | null
  pages: number
}

function copyBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

function pieceFile(piece: Piece) {
  if (isImageName(piece.name)) return new File([piece.bytes.slice()], piece.name)
  const name = piece.name.toLowerCase().endsWith('.pdf') ? piece.name : `${piece.name}.pdf`
  return new File([piece.bytes.slice()], name, { type: 'application/pdf' })
}

export function CombinePanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const seeded = useRef(false)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [openPieceId, setOpenPieceId] = useState<string | null>(null)
  const openBytes = useTabStore((state) => state.openInNewTab)
  const status = useViewerStore((state) => state.status)
  const documentId = useViewerStore((state) => state.documentId)
  const fileName = useViewerStore((state) => state.fileName)
  const { pending, error, run } = useTask()

  function paint(id: string, name: string, bytes: Uint8Array) {
    void filePreview(name, bytes)
      .then((shot) => {
        setPieces((current) =>
          current.map((item) =>
            item.id === id ? { ...item, preview: shot.url, pages: shot.pages } : item,
          ),
        )
      })
      .catch(() => {
        setPieces((current) =>
          current.map((item) => (item.id === id ? { ...item, preview: '' } : item)),
        )
      })
  }

  function pushSources(sources: Source[], where: 'start' | 'end') {
    const next = sources.map((source) => ({
      id: crypto.randomUUID(),
      name: source.name,
      bytes: copyBytes(source.bytes),
      preview: null as string | null,
      pages: 0,
    }))
    setPieces((current) => (where === 'start' ? [...next, ...current] : [...current, ...next]))
    for (const piece of next) paint(piece.id, piece.name, piece.bytes)
    return next
  }

  useEffect(() => {
    if (seeded.current || status !== 'ready' || !documentId || !fileName) return
    let cancelled = false
    const openName = fileName
    void (async () => {
      try {
        const raw = await workingBytes()
        if (cancelled) return
        seeded.current = true
        const [piece] = pushSources([{ name: openName, bytes: raw }], 'start')
        setOpenPieceId(piece.id)
      } catch {
        if (!cancelled) seeded.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, documentId, fileName])

  function move(index: number, delta: number) {
    setPieces((current) => {
      const next = index + delta
      if (next < 0 || next >= current.length) return current
      const copy = current.slice()
      const [item] = copy.splice(index, 1)
      copy.splice(next, 0, item)
      return copy
    })
  }

  async function addSources(sources: Source[]) {
    const accepted = sources.filter((source) => {
      const name = source.name.toLowerCase()
      return name.endsWith('.pdf') || isImageName(source.name)
    })
    if (accepted.length === 0) throw new Error('Choose PDFs or images.')
    pushSources(accepted, 'end')
  }

  return (
    <>
      <p className="panel-note">
        {openPieceId && pieces.some((piece) => piece.id === openPieceId)
          ? 'The open PDF is in the list, including unsaved edits. Add more files — you can select several at once — then arrange and merge.'
          : 'Add PDFs and images. You can select several at once, then arrange and merge.'}
      </p>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length === 0) return
          void run('Adding files', async () => {
            const sources: Source[] = []
            for (const file of files) {
              sources.push({
                name: file.name || 'document.pdf',
                bytes: new Uint8Array(await file.arrayBuffer()),
              })
            }
            await addSources(sources)
          })
        }}
      />
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          if (!isDesktop) {
            inputRef.current?.click()
            return
          }
          void run('Adding files', async () => {
            const picked = await pickMergeSources()
            if (!picked || picked.length === 0) return
            await addSources(picked)
          })
        }}
      >
        Add files
      </ChoiceButton>
      {pieces.length > 0 ? (
        <ol className="file-list">
          {pieces.map((piece, index) => (
            <li key={piece.id} className="merge-file">
              <div className="merge-preview">
                {piece.preview ? <img src={piece.preview} alt="" /> : null}
              </div>
              <div className="merge-file-body">
                <span className="merge-name" title={piece.name}>
                  {piece.name}
                </span>
                {piece.pages > 0 ? (
                  <span className="merge-meta">{piece.pages === 1 ? '1 page' : `${piece.pages} pages`}</span>
                ) : null}
                <span className="file-list-actions">
                  <button type="button" aria-label="Move earlier" onClick={() => move(index, -1)}>
                    Up
                  </button>
                  <button type="button" aria-label="Move later" onClick={() => move(index, 1)}>
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => setPieces((current) => current.filter((item) => item.id !== piece.id))}
                  >
                    Remove
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null || pieces.length === 0}
        onClick={() => {
          void run('Merging', async () => {
            const bytes = await buildPdf(
              pieces.map((piece) => pieceFile(piece)),
              'Merged',
            )
            await openBytes('Merged.pdf', bytes)
            setPieces([])
            setOpenPieceId(null)
          })
        }}
      >
        Merge
      </button>
      <TaskStatus pending={pending} error={error} />
    </>
  )
}

import { useRef, useState } from 'react'
import { buildPdf } from '../../../lib/pdf/assemble'
import { isImageName } from '../../../lib/pdf/images'
import { useTabStore } from '../../../state/tabStore'
import { useTask } from '../useTask'
import { ChoiceButton, TaskStatus } from '../ui'

type Piece = { id: string; file: File }

export function CombinePanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pieces, setPieces] = useState<Piece[]>([])
  const openBytes = useTabStore((state) => state.openInNewTab)
  const { pending, error, run } = useTask()

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

  return (
    <>
      <p className="panel-note">Add PDFs and images, set the order, then merge them into one file.</p>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,application/pdf"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          const accepted = files.filter(
            (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') || isImageName(file.name),
          )
          if (accepted.length === 0) return
          setPieces((current) => [
            ...current,
            ...accepted.map((file) => ({ id: crypto.randomUUID(), file })),
          ])
        }}
      />
      <ChoiceButton disabled={pending !== null} onClick={() => inputRef.current?.click()}>
        Add files
      </ChoiceButton>
      {pieces.length > 0 ? (
        <ol className="file-list">
          {pieces.map((piece, index) => (
            <li key={piece.id}>
              <span title={piece.file.name}>{piece.file.name}</span>
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
            </li>
          ))}
        </ol>
      ) : null}
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null || pieces.length === 0}
        onClick={() => {
          void run('Combining', async () => {
            const bytes = await buildPdf(
              pieces.map((piece) => piece.file),
              'Combined',
            )
            await openBytes('Combined.pdf', bytes)
            setPieces([])
          })
        }}
      >
        Merge
      </button>
      <TaskStatus pending={pending} error={error} />
    </>
  )
}

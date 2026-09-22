import { useState } from 'react'
import { formatBytes } from '../../../lib/pdf/download'
import { loadEditable } from '../../../lib/pdf/assemble'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { rasterizeDocument } from '../../../lib/pdf/pageImage'
import { getRetainedDocument } from '../../../services/documentSource'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../useTask'
import { ChoiceButton, NeedsPdf, TaskStatus } from '../ui'

export function CompressPanel() {
  const fileName = useViewerStore((state) => state.fileName)
  const openBytes = useViewerStore((state) => state.openBytes)
  const documentId = useViewerStore((state) => state.documentId)
  const [quality, setQuality] = useState(60)
  const [result, setResult] = useState<string | null>(null)
  const { pending, error, run } = useTask()
  const current = getRetainedDocument()
  const size = current && current.id === documentId ? current.bytes.byteLength : 0

  return (
    <NeedsPdf>
      <p className="panel-note">
        This file is {formatBytes(size)}. Rewrite keeps text selectable. A smaller copy turns each page into a picture.
      </p>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          setResult(null)
          void run('Rewriting', async () => {
            const source = await workingBytes()
            const before = source.byteLength
            const pdf = await loadEditable(source)
            const saved = await pdf.save({ useObjectStreams: true })
            if (saved.byteLength >= before) {
              setResult('This file is already compact.')
              return
            }
            await openBytes(fileName ?? 'document.pdf', saved)
            setResult(`${formatBytes(before)} is now ${formatBytes(saved.byteLength)}.`)
          })
        }}
      >
        Rewrite
      </ChoiceButton>
      <label className="size-row">
        <span>Picture quality {quality}</span>
        <input
          className="quality"
          type="range"
          min={30}
          max={85}
          value={quality}
          onChange={(event) => setQuality(Number(event.target.value))}
        />
      </label>
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null}
        onClick={() => {
          setResult(null)
          void run('Compressing', async () => {
            const before = getRetainedDocument()?.bytes.byteLength ?? size
            const saved = await rasterizeDocument(quality / 100)
            await openBytes(fileName ?? 'document.pdf', saved)
            setResult(`${formatBytes(before)} is now ${formatBytes(saved.byteLength)}. Text in this copy is a picture of the page.`)
          })
        }}
      >
        Make a smaller copy
      </button>
      {result ? <p className="panel-note">{result}</p> : null}
      <TaskStatus pending={pending} error={error} />
    </NeedsPdf>
  )
}

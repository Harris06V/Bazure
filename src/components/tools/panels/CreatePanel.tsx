import { useRef } from 'react'
import { blankPdf, buildPdf } from '../../../lib/pdf/assemble'
import { pdfNameFrom } from '../../../lib/pdf/download'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../useTask'
import { ChoiceButton, TaskStatus } from '../ui'

export function CreatePanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const openBytes = useViewerStore((state) => state.openBytes)
  const { pending, error, run } = useTask()

  return (
    <>
      <p className="panel-note">
        Word, Excel, PowerPoint, images, or an existing PDF. Several files are added in the order you pick them.
      </p>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,application/pdf"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          if (files.length === 0) return
          const name = files.length === 1 ? pdfNameFrom(files[0].name) : 'Combined.pdf'
          void run('Creating PDF', async () => {
            const bytes = await buildPdf(files, name.replace(/\.pdf$/i, ''))
            await openBytes(name, bytes)
          })
        }}
      />
      <ChoiceButton disabled={pending !== null} onClick={() => inputRef.current?.click()}>
        Choose files
      </ChoiceButton>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          void run('Creating PDF', async () => {
            await openBytes('Untitled.pdf', await blankPdf())
          })
        }}
      >
        Blank page
      </ChoiceButton>
      <TaskStatus pending={pending} error={error} />
    </>
  )
}

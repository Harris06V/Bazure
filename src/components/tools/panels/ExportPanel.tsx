import { downloadBytes, pdfNameFrom } from '../../../lib/pdf/download'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { exportAllImages, exportPageImage, exportPlainText } from '../../../lib/pdf/pageImage'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../useTask'
import { ChoiceButton, NeedsPdf, TaskStatus } from '../ui'

export function ExportPanel() {
  const fileName = useViewerStore((state) => state.fileName)
  const currentPage = useViewerStore((state) => state.currentPage)
  const { pending, error, run } = useTask()
  const stem = pdfNameFrom(fileName ?? 'document.pdf').replace(/\.pdf$/i, '')

  return (
    <NeedsPdf>
      <p className="panel-note">
        Download the PDF with your edits, or save pages as images. Comments and signatures are included.
      </p>
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null}
        onClick={() => {
          void run('Preparing PDF', async () => {
            downloadBytes(await workingBytes(), pdfNameFrom(fileName ?? 'document.pdf'), 'application/pdf')
          })
        }}
      >
        Download PDF
      </button>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          void run('Exporting page', async () => {
            const bytes = await exportPageImage(currentPage, 'png')
            downloadBytes(bytes, `${stem}-page-${currentPage}.png`, 'image/png')
          })
        }}
      >
        This page as PNG
      </ChoiceButton>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          void run('Exporting page', async () => {
            const bytes = await exportPageImage(currentPage, 'jpeg')
            downloadBytes(bytes, `${stem}-page-${currentPage}.jpg`, 'image/jpeg')
          })
        }}
      >
        This page as JPEG
      </ChoiceButton>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          void run('Exporting pages', async () => {
            downloadBytes(await exportAllImages('png'), `${stem}-pages.zip`, 'application/zip')
          })
        }}
      >
        All pages as PNG
      </ChoiceButton>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          void run('Exporting pages', async () => {
            downloadBytes(await exportAllImages('jpeg'), `${stem}-pages.zip`, 'application/zip')
          })
        }}
      >
        All pages as JPEG
      </ChoiceButton>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          void run('Exporting text', async () => {
            const text = await exportPlainText()
            downloadBytes(new TextEncoder().encode(text), `${stem}.txt`, 'text/plain')
          })
        }}
      >
        Text
      </ChoiceButton>
      <TaskStatus pending={pending} error={error} />
    </NeedsPdf>
  )
}

import { downloadBytes, pdfNameFrom } from '../../../lib/pdf/download'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { useToolStore } from '../../../state/toolStore'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../../../hooks/useTask'
import { ChoiceButton, NeedsPdf, TaskStatus } from '../ui'

export function SharePanel() {
  const fileName = useViewerStore((state) => state.fileName)
  const place = useToolStore((state) => state.place)
  const setPlace = useToolStore((state) => state.setPlace)
  const { pending, error, run } = useTask()
  const signHere = place?.kind === 'stamp' && place.label === 'Sign here'

  return (
    <NeedsPdf>
      <h3 className="panel-sub">Send for comments</h3>
      <p className="panel-note">Notes and highlights are saved into a copy you can pass on.</p>
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null}
        onClick={() => {
          void run('Preparing copy', async () => {
            const name = pdfNameFrom(fileName ?? 'document.pdf').replace(/\.pdf$/i, '')
            downloadBytes(await workingBytes(), `${name}-comments.pdf`, 'application/pdf')
          })
        }}
      >
        Download for comments
      </button>
      <h3 className="panel-sub">Request signatures</h3>
      <p className="panel-note">
        Place Sign here marks, then download a copy. Whoever opens it can sign with Fill & Sign.
      </p>
      <ChoiceButton
        active={signHere}
        onClick={() => setPlace(signHere ? null : { kind: 'stamp', label: 'Sign here' })}
      >
        Place Sign here
      </ChoiceButton>
      <ChoiceButton
        disabled={pending !== null}
        onClick={() => {
          void run('Preparing copy', async () => {
            const name = pdfNameFrom(fileName ?? 'document.pdf').replace(/\.pdf$/i, '')
            downloadBytes(await workingBytes(), `${name}-sign.pdf`, 'application/pdf')
          })
        }}
      >
        Download to sign
      </ChoiceButton>
      <TaskStatus pending={pending} error={error} />
    </NeedsPdf>
  )
}

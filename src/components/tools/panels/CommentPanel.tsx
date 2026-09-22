import { workingBytes } from '../../../lib/pdf/markupBake'
import { markSelection } from '../../../lib/pdf/selectionMarkup'
import { useToolStore } from '../../../state/toolStore'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../useTask'
import { ChoiceButton, MarkupList, NeedsPdf, TaskStatus } from '../ui'

export function CommentPanel() {
  const place = useToolStore((state) => state.place)
  const setPlace = useToolStore((state) => state.setPlace)
  const openBytes = useViewerStore((state) => state.openBytes)
  const fileName = useViewerStore((state) => state.fileName)
  const { pending, error, run } = useTask()

  function paint(kind: 'highlight' | 'underline' | 'strike') {
    void run('Adding comment', async () => {
      if (!markSelection(kind)) throw new Error('Select text on the page first.')
    })
  }

  return (
    <NeedsPdf>
      <p className="panel-note">Select text, then mark it. Or click the page to leave a note.</p>
      <ChoiceButton onClick={() => paint('highlight')}>Highlight</ChoiceButton>
      <ChoiceButton onClick={() => paint('underline')}>Underline</ChoiceButton>
      <ChoiceButton onClick={() => paint('strike')}>Strikethrough</ChoiceButton>
      <ChoiceButton
        active={place?.kind === 'note'}
        onClick={() => setPlace(place?.kind === 'note' ? null : { kind: 'note' })}
      >
        Add note
      </ChoiceButton>
      <MarkupList kinds={['highlight', 'underline', 'strike', 'note']} />
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null}
        onClick={() => {
          void run('Saving', async () => {
            await openBytes(fileName ?? 'document.pdf', await workingBytes())
          })
        }}
      >
        Save into PDF
      </button>
      <TaskStatus pending={pending} error={error} />
    </NeedsPdf>
  )
}

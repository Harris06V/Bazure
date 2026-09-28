import { STAMPS } from '../../../lib/pdf/markup'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { useToolStore } from '../../../state/toolStore'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../../../hooks/useTask'
import { MarkupList, NeedsPdf, TaskStatus } from '../ui'

export function StampPanel() {
  const place = useToolStore((state) => state.place)
  const setPlace = useToolStore((state) => state.setPlace)
  const openBytes = useViewerStore((state) => state.openBytes)
  const fileName = useViewerStore((state) => state.fileName)
  const { pending, error, run } = useTask()
  const activeLabel = place?.kind === 'stamp' ? place.label : null

  return (
    <NeedsPdf>
      <p className="panel-note">Choose a stamp, then click the page.</p>
      <div className="stamp-grid">
        {STAMPS.map((stamp) => (
          <button
            key={stamp.label}
            type="button"
            className={activeLabel === stamp.label ? 'stack-btn is-active' : 'stack-btn'}
            onClick={() =>
              setPlace(activeLabel === stamp.label ? null : { kind: 'stamp', label: stamp.label })
            }
          >
            {stamp.label}
          </button>
        ))}
      </div>
      <MarkupList kinds={['stamp']} />
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

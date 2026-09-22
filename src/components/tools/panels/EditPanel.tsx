import { useRef } from 'react'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { useToolStore } from '../../../state/toolStore'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../useTask'
import { ChoiceButton, MarkupList, NeedsPdf, TaskStatus } from '../ui'

export function EditPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const place = useToolStore((state) => state.place)
  const setPlace = useToolStore((state) => state.setPlace)
  const textSize = useToolStore((state) => state.textSize)
  const setTextSize = useToolStore((state) => state.setTextSize)
  const openBytes = useViewerStore((state) => state.openBytes)
  const fileName = useViewerStore((state) => state.fileName)
  const { pending, error, run } = useTask()

  function arm(next: typeof place) {
    setPlace(place && next && place.kind === next.kind ? null : next)
  }

  return (
    <NeedsPdf>
      <p className="panel-note">Add text, cover a passage, or place an image. Then save it into the PDF.</p>
      <ChoiceButton active={place?.kind === 'text'} onClick={() => arm({ kind: 'text' })}>
        Add text
      </ChoiceButton>
      <label className="size-row">
        <span>Size</span>
        <input
          type="number"
          min={8}
          max={72}
          value={textSize}
          onChange={(event) => setTextSize(Number(event.target.value))}
        />
      </label>
      <ChoiceButton active={place?.kind === 'cover'} onClick={() => arm({ kind: 'cover' })}>
        Cover
      </ChoiceButton>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void run('Reading image', async () => {
            const bitmap = await createImageBitmap(file)
            try {
              const canvas = document.createElement('canvas')
              canvas.width = bitmap.width
              canvas.height = bitmap.height
              const context = canvas.getContext('2d')
              if (!context) throw new Error('Could not read that image.')
              context.drawImage(bitmap, 0, 0)
              setPlace({
                kind: 'picture',
                src: canvas.toDataURL('image/png'),
                aspect: bitmap.width / bitmap.height,
                name: 'Image',
              })
            } finally {
              bitmap.close()
            }
          })
        }}
      />
      <ChoiceButton active={place?.kind === 'picture' && place.name === 'Image'} onClick={() => inputRef.current?.click()}>
        Add image
      </ChoiceButton>
      <MarkupList kinds={['text', 'cover', 'picture']} />
      <button
        type="button"
        className="primary-btn panel-go"
        disabled={pending !== null}
        onClick={() => {
          void run('Saving', async () => {
            const bytes = await workingBytes()
            await openBytes(fileName ?? 'document.pdf', bytes)
          })
        }}
      >
        Save into PDF
      </button>
      <TaskStatus pending={pending} error={error} />
    </NeedsPdf>
  )
}

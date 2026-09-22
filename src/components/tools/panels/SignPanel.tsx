import { useRef, useState, type PointerEvent } from 'react'
import { workingBytes } from '../../../lib/pdf/markupBake'
import { useToolStore } from '../../../state/toolStore'
import { useViewerStore } from '../../../state/viewerStore'
import { useTask } from '../useTask'
import { ChoiceButton, MarkupList, NeedsPdf, TaskStatus } from '../ui'

function cropCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')
  if (!context) return null
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 12) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) return null
  const pad = 8
  const cropX = Math.max(0, minX - pad)
  const cropY = Math.max(0, minY - pad)
  const cropW = Math.min(width - cropX, maxX - minX + pad * 2)
  const cropH = Math.min(height - cropY, maxY - minY + pad * 2)
  const out = document.createElement('canvas')
  out.width = cropW
  out.height = cropH
  out.getContext('2d')?.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  return { src: out.toDataURL('image/png'), aspect: cropW / cropH }
}

export function SignPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [typed, setTyped] = useState('')
  const setPlace = useToolStore((state) => state.setPlace)
  const place = useToolStore((state) => state.place)
  const openBytes = useViewerStore((state) => state.openBytes)
  const fileName = useViewerStore((state) => state.fileName)
  const { pending, error, run } = useTask()

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const bounds = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    }
  }

  function useDrawn() {
    const canvas = canvasRef.current
    if (!canvas) return
    const cropped = cropCanvas(canvas)
    if (!cropped) {
      void run('Signature', async () => {
        throw new Error('Draw or type a signature first.')
      })
      return
    }
    setPlace({ kind: 'picture', ...cropped, name: 'Signature' })
  }

  function useTyped() {
    const name = typed.trim()
    if (!name) return
    const canvas = document.createElement('canvas')
    const size = 72
    const context = canvas.getContext('2d')
    if (!context) return
    context.font = `${size}px "Segoe Script", "Brush Script MT", "Palatino Linotype", cursive`
    const width = Math.ceil(context.measureText(name).width + 24)
    canvas.width = Math.max(width, 80)
    canvas.height = 100
    context.font = `${size}px "Segoe Script", "Brush Script MT", "Palatino Linotype", cursive`
    context.fillStyle = '#1B2733'
    context.textBaseline = 'middle'
    context.fillText(name, 12, 54)
    setPlace({
      kind: 'picture',
      src: canvas.toDataURL('image/png'),
      aspect: canvas.width / canvas.height,
      name: 'Signature',
    })
  }

  return (
    <NeedsPdf>
      <p className="panel-note">
        Type into form fields on the page. Draw or type a signature, then click the page to place it.
      </p>
      <canvas
        ref={canvasRef}
        className="sign-pad"
        width={560}
        height={160}
        aria-label="Draw a signature"
        onPointerDown={(event) => {
          const canvas = canvasRef.current
          const context = canvas?.getContext('2d')
          if (!canvas || !context) return
          drawing.current = true
          canvas.setPointerCapture(event.pointerId)
          const start = point(event)
          context.strokeStyle = '#1B2733'
          context.lineWidth = 3.2
          context.lineCap = 'round'
          context.lineJoin = 'round'
          context.beginPath()
          context.moveTo(start.x, start.y)
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return
          const context = canvasRef.current?.getContext('2d')
          if (!context) return
          const next = point(event)
          context.lineTo(next.x, next.y)
          context.stroke()
        }}
        onPointerUp={() => {
          drawing.current = false
        }}
      />
      <div className="pair-row">
        <ChoiceButton onClick={useDrawn}>Use drawing</ChoiceButton>
        <ChoiceButton
          onClick={() => {
            const canvas = canvasRef.current
            const context = canvas?.getContext('2d')
            if (!canvas || !context) return
            context.clearRect(0, 0, canvas.width, canvas.height)
          }}
        >
          Clear
        </ChoiceButton>
      </div>
      <label className="size-row">
        <span>Name</span>
        <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="Type a signature" />
      </label>
      <ChoiceButton disabled={!typed.trim()} onClick={useTyped}>
        Use typed name
      </ChoiceButton>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void run('Reading signature', async () => {
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
                name: 'Signature',
              })
            } finally {
              bitmap.close()
            }
          })
        }}
      />
      <ChoiceButton onClick={() => fileRef.current?.click()}>Use an image</ChoiceButton>
      <ChoiceButton
        active={place?.kind === 'date'}
        onClick={() => setPlace(place?.kind === 'date' ? null : { kind: 'date' })}
      >
        Place date
      </ChoiceButton>
      <MarkupList kinds={['picture', 'text']} />
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

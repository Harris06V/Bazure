import { AnnotationMode, getDocument } from 'pdfjs-dist'
import { extensionOf, fileToRasters, isImageName } from './images'
import { pdfAsset } from './setup'

function drawBitmap(bitmap: ImageBitmap) {
  const width = 120
  const height = Math.max(1, Math.round((bitmap.height / Math.max(bitmap.width, 1)) * width))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

async function rasterPreview(bytes: Uint8Array, pages: number) {
  const bitmap = await createImageBitmap(new Blob([bytes.slice()]))
  return { url: drawBitmap(bitmap), pages }
}

export async function filePreview(name: string, bytes: Uint8Array) {
  const extension = extensionOf(name)
  if (extension === 'tif' || extension === 'tiff') {
    const rasters = await fileToRasters(new File([bytes.slice()], name))
    const first = rasters[0]
    if (!first) return { url: '', pages: 0 }
    return rasterPreview(first.bytes, rasters.length)
  }
  if (isImageName(name)) return rasterPreview(bytes, 1)
  if (extension !== 'pdf') return { url: '', pages: 0 }

  const task = getDocument({
    data: bytes.slice(),
    cMapUrl: pdfAsset('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: pdfAsset('standard_fonts/'),
    wasmUrl: pdfAsset('wasm/'),
    iccUrl: pdfAsset('iccs/'),
    enableXfa: true,
  })
  try {
    const doc = await task.promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: 120 / Math.max(base.width, 1) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    await page.render({ canvas, viewport, annotationMode: AnnotationMode.ENABLE }).promise
    return { url: canvas.toDataURL('image/jpeg', 0.72), pages: doc.numPages }
  } finally {
    await task.destroy()
  }
}

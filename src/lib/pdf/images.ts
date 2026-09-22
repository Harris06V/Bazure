import { decode, decodeImage, toRGBA8 } from 'utif'

export type Raster = {
  kind: 'jpg' | 'png'
  bytes: Uint8Array
  width: number
  height: number
}

export function extensionOf(name: string) {
  return /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? ''
}

export function isImageName(name: string) {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff'].includes(extensionOf(name))
}

async function blobBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

async function canvasPng(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read this image.')
  context.drawImage(source, 0, 0, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Could not read this image.'))),
      'image/png',
    )
  })
  return blobBytes(blob)
}

async function tiffRasters(buffer: ArrayBuffer): Promise<Raster[]> {
  const pages = decode(buffer)
  if (pages.length === 0) throw new Error('Could not read this TIFF.')
  const rasters: Raster[] = []
  for (const page of pages) {
    decodeImage(buffer, page)
    const rgba = toRGBA8(page)
    const canvas = document.createElement('canvas')
    canvas.width = page.width
    canvas.height = page.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not read this TIFF.')
    const image = context.createImageData(page.width, page.height)
    image.data.set(rgba)
    context.putImageData(image, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Could not read this TIFF.'))),
        'image/png',
      )
    })
    rasters.push({
      kind: 'png',
      bytes: await blobBytes(blob),
      width: page.width,
      height: page.height,
    })
  }
  return rasters
}

export async function fileToRasters(file: File): Promise<Raster[]> {
  const extension = extensionOf(file.name)
  if (extension === 'tif' || extension === 'tiff') return tiffRasters(await file.arrayBuffer())

  const bytes = new Uint8Array(await file.arrayBuffer())
  const bitmap = await createImageBitmap(file)
  const width = bitmap.width
  const height = bitmap.height
  try {
    if (extension === 'jpg' || extension === 'jpeg') {
      return [{ kind: 'jpg', bytes, width, height }]
    }
    if (extension === 'png') return [{ kind: 'png', bytes, width, height }]
    return [{ kind: 'png', bytes: await canvasPng(bitmap, width, height), width, height }]
  } finally {
    bitmap.close()
  }
}

declare module 'utif' {
  export type TiffIfd = {
    width: number
    height: number
  }

  export function decode(buffer: ArrayBuffer | Uint8Array): TiffIfd[]
  export function decodeImage(buffer: ArrayBuffer | Uint8Array, ifd: TiffIfd): void
  export function toRGBA8(ifd: TiffIfd): Uint8Array
}

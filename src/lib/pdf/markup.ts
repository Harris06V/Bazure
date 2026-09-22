export type NormBox = {
  x: number
  y: number
  w: number
  h: number
}

export const STAMPS = [
  { label: 'Approved', color: '#2C6FB0' },
  { label: 'Final', color: '#2C6FB0' },
  { label: 'Draft', color: '#5C6E80' },
  { label: 'Revised', color: '#5C6E80' },
  { label: 'Confidential', color: '#E0654A' },
  { label: 'Void', color: '#E0654A' },
  { label: 'Sign here', color: '#2C6FB0' },
] as const

export type StampLabel = (typeof STAMPS)[number]['label']

export type Markup =
  | {
      id: string
      kind: 'highlight' | 'underline' | 'strike'
      page: number
      rects: NormBox[]
    }
  | {
      id: string
      kind: 'note'
      page: number
      x: number
      y: number
      text: string
    }
  | {
      id: string
      kind: 'text'
      page: number
      x: number
      y: number
      text: string
      size: number
    }
  | {
      id: string
      kind: 'cover'
      page: number
      x: number
      y: number
      w: number
      h: number
    }
  | {
      id: string
      kind: 'stamp'
      page: number
      x: number
      y: number
      w: number
      h: number
      label: StampLabel
    }
  | {
      id: string
      kind: 'picture'
      page: number
      x: number
      y: number
      w: number
      h: number
      src: string
      name: 'Signature' | 'Image'
    }

export function markupId() {
  return crypto.randomUUID()
}

export function stampSlug(label: string) {
  return label.toLowerCase().replace(/\s+/g, '-')
}

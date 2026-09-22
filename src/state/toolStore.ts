import { create } from 'zustand'
import type { StampLabel } from '../lib/pdf/markup'

export type ToolId =
  | 'create'
  | 'edit'
  | 'comment'
  | 'stamp'
  | 'sign'
  | 'organize'
  | 'combine'
  | 'export'
  | 'compress'
  | 'share'

export type PlaceMode =
  | { kind: 'text' }
  | { kind: 'cover' }
  | { kind: 'note' }
  | { kind: 'date' }
  | { kind: 'stamp'; label: StampLabel }
  | { kind: 'picture'; src: string; aspect: number; name: 'Signature' | 'Image' }

type ToolState = {
  active: ToolId | null
  place: PlaceMode | null
  textSize: number
  toggle: (id: ToolId) => void
  close: () => void
  setPlace: (place: PlaceMode | null) => void
  setTextSize: (size: number) => void
}

export const useToolStore = create<ToolState>((set) => ({
  active: null,
  place: null,
  textSize: 14,

  toggle: (id) =>
    set((state) =>
      state.active === id ? { active: null, place: null } : { active: id, place: null },
    ),

  close: () => set({ active: null, place: null }),

  setPlace: (place) => set({ place }),

  setTextSize: (size) => set({ textSize: Math.min(72, Math.max(8, size)) }),
}))

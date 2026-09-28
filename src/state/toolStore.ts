import { create } from 'zustand'
import type { NormBox, StampLabel } from '../lib/pdf/markup'
import { useMarkupStore } from './markupStore'

export type ToolId =
  | 'select'
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
  | { kind: 'esign'; src: string; aspect: number; name: string }

export type SignTarget = { fieldId: string; page: number; box: NormBox }

type ToolState = {
  active: ToolId | null
  place: PlaceMode | null
  textSize: number
  signTarget: SignTarget | null
  toggle: (id: ToolId) => void
  close: () => void
  setPlace: (place: PlaceMode | null) => void
  setTextSize: (size: number) => void
  setSignTarget: (target: SignTarget | null) => void
  openSignField: (target: SignTarget) => void
}

export const useToolStore = create<ToolState>((set) => ({
  active: null,
  place: null,
  textSize: 14,
  signTarget: null,

  toggle: (id) => {
    useMarkupStore.getState().select(null)
    set((state) =>
      state.active === id
        ? { active: null, place: null, signTarget: null }
        : { active: id, place: null, signTarget: null },
    )
  },

  close: () => {
    useMarkupStore.getState().select(null)
    set({ active: null, place: null, signTarget: null })
  },

  setPlace: (place) => set({ place }),

  setTextSize: (size) => set({ textSize: Math.min(72, Math.max(8, size)) }),

  setSignTarget: (target) => set({ signTarget: target }),

  openSignField: (target) => set({ active: 'sign', place: null, signTarget: target }),
}))

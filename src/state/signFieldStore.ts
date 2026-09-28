import { create } from 'zustand'
import type { NormBox } from '../lib/pdf/markup'

export type SignField = {
  id: string
  page: number
  box: NormBox
}

type SignFieldState = {
  fields: SignField[]
  signedIds: string[]
  setFieldsForPage: (page: number, fields: SignField[]) => void
  markSigned: (id: string) => void
  restoreSigned: (ids: string[]) => void
  clear: () => void
}

export const useSignFieldStore = create<SignFieldState>((set) => ({
  fields: [],
  signedIds: [],

  setFieldsForPage: (page, fields) =>
    set((state) => ({
      fields: [...state.fields.filter((field) => field.page !== page), ...fields],
    })),

  markSigned: (id) => set((state) => ({ signedIds: [...state.signedIds, id] })),

  restoreSigned: (ids) => set({ signedIds: ids }),

  clear: () => set({ fields: [], signedIds: [] }),
}))

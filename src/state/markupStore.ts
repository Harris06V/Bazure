import { create } from 'zustand'
import type { Markup } from '../lib/pdf/markup'

type MarkupState = {
  items: Markup[]
  add: (markup: Markup) => void
  addMany: (markups: Markup[]) => void
  remove: (id: string) => void
  setText: (id: string, text: string) => void
  clear: () => void
}

export const useMarkupStore = create<MarkupState>((set) => ({
  items: [],

  add: (markup) => set((state) => ({ items: [...state.items, markup] })),

  addMany: (markups) =>
    set((state) => (markups.length === 0 ? state : { items: [...state.items, ...markups] })),

  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),

  setText: (id, text) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id && (item.kind === 'note' || item.kind === 'text') ? { ...item, text } : item,
      ),
    })),

  clear: () => set({ items: [] }),
}))

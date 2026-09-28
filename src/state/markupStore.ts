import { create } from 'zustand'
import { markupId, type Markup } from '../lib/pdf/markup'

const HISTORY_LIMIT = 100

type MarkupState = {
  items: Markup[]
  /** Reference to `items` at the last save; dirty when they differ. */
  savedItems: Markup[]
  past: Markup[][]
  future: Markup[][]
  selectedId: string | null
  clipboard: Markup | null
  add: (markup: Markup) => void
  addMany: (markups: Markup[]) => void
  remove: (id: string) => void
  setText: (id: string, text: string) => void
  /** Change an item without recording history; call `checkpoint` first. */
  update: (id: string, change: (item: Markup) => Markup) => void
  checkpoint: () => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  copySelected: () => boolean
  cutSelected: () => boolean
  paste: (page: number) => boolean
  duplicateSelected: () => boolean
  removeSelected: () => boolean
  nudgeSelected: (dx: number, dy: number) => boolean
  markSaved: () => void
  restore: (items: Markup[], savedItems: Markup[]) => void
  clear: () => void
}

function pushPast(past: Markup[][], items: Markup[]) {
  if (past[past.length - 1] === items) return past
  const next = [...past, items]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}

function isMovable(item: Markup): item is Extract<Markup, { x: number }> {
  return 'x' in item
}

function offsetCopy(item: Markup, page: number, delta: number): Markup {
  if (!isMovable(item)) return { ...item, id: markupId(), page }
  const w = 'w' in item ? item.w : 0
  const h = 'h' in item ? item.h : 0
  return {
    ...item,
    id: markupId(),
    page,
    x: Math.min(Math.max(0, item.x + delta), 1 - w),
    y: Math.min(Math.max(0, item.y + delta), 1 - h),
  }
}

export const useMarkupStore = create<MarkupState>((set, get) => ({
  items: [],
  savedItems: [],
  past: [],
  future: [],
  selectedId: null,
  clipboard: null,

  add: (markup) =>
    set((state) => ({ past: pushPast(state.past, state.items), future: [], items: [...state.items, markup] })),

  addMany: (markups) =>
    set((state) =>
      markups.length === 0
        ? state
        : { past: pushPast(state.past, state.items), future: [], items: [...state.items, ...markups] },
    ),

  remove: (id) =>
    set((state) => ({
      past: pushPast(state.past, state.items),
      future: [],
      items: state.items.filter((item) => item.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  setText: (id, text) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id && (item.kind === 'note' || item.kind === 'text') ? { ...item, text } : item,
      ),
    })),

  update: (id, change) =>
    set((state) => ({ items: state.items.map((item) => (item.id === id ? change(item) : item)) })),

  checkpoint: () => set((state) => ({ past: pushPast(state.past, state.items), future: [] })),

  undo: () =>
    set((state) => {
      const past = [...state.past]
      let previous = past.pop()
      // Skip checkpoints that never led to a change.
      while (previous === state.items && past.length > 0) previous = past.pop()
      if (!previous || previous === state.items) return state
      return { past, future: [state.items, ...state.future], items: previous, selectedId: null }
    }),

  redo: () =>
    set((state) => {
      const [next, ...future] = state.future
      if (!next) return state
      return { past: pushPast(state.past, state.items), future, items: next, selectedId: null }
    }),

  select: (id) => set({ selectedId: id }),

  copySelected: () => {
    const { items, selectedId } = get()
    const item = items.find((entry) => entry.id === selectedId)
    if (!item) return false
    set({ clipboard: item })
    return true
  },

  cutSelected: () => {
    const { selectedId, copySelected, remove } = get()
    if (!selectedId || !copySelected()) return false
    remove(selectedId)
    return true
  },

  paste: (page) => {
    const { clipboard, add } = get()
    if (!clipboard) return false
    const copy = offsetCopy(clipboard, page, clipboard.page === page ? 0.02 : 0)
    add(copy)
    set({ clipboard: copy, selectedId: copy.id })
    return true
  },

  duplicateSelected: () => {
    const { items, selectedId, add } = get()
    const item = items.find((entry) => entry.id === selectedId)
    if (!item) return false
    const copy = offsetCopy(item, item.page, 0.02)
    add(copy)
    set({ selectedId: copy.id })
    return true
  },

  removeSelected: () => {
    const { selectedId, remove } = get()
    if (!selectedId) return false
    remove(selectedId)
    return true
  },

  nudgeSelected: (dx, dy) => {
    const { items, selectedId, checkpoint, update } = get()
    const item = items.find((entry) => entry.id === selectedId)
    if (!item || !isMovable(item)) return false
    checkpoint()
    const w = 'w' in item ? item.w : 0
    const h = 'h' in item ? item.h : 0
    update(item.id, (current) =>
      isMovable(current)
        ? {
            ...current,
            x: Math.min(Math.max(0, current.x + dx), 1 - w),
            y: Math.min(Math.max(0, current.y + dy), 1 - h),
          }
        : current,
    )
    return true
  },

  markSaved: () => set((state) => ({ savedItems: state.items })),

  restore: (items, savedItems) =>
    set({ items, savedItems, past: [], future: [], selectedId: null }),

  clear: () => {
    const empty: Markup[] = []
    set({ items: empty, savedItems: empty, past: [], future: [], selectedId: null })
  },
}))

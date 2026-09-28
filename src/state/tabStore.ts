import { create } from 'zustand'
import type { Markup } from '../lib/pdf/markup'
import { getActiveDocument } from '../lib/pdf/session'
import type { ReadingMode, ZoomMode } from '../lib/pdf/types'
import { getRetainedDocument } from '../lib/pdf/documentSource'
import { useMarkupStore } from './markupStore'
import { useSignFieldStore } from './signFieldStore'
import { useToolStore } from './toolStore'
import { useViewerStore } from './viewerStore'

/** Everything needed to bring a background tab back exactly as it was left. */
type TabSnapshot = {
  bytes: Uint8Array | null
  modified: boolean
  items: Markup[]
  savedItems: Markup[]
  signedIds: string[]
  currentPage: number
  readingMode: ReadingMode
  zoomMode: ZoomMode
  customZoom: number
}

export type DocTab = {
  id: string
  name: string
  dirty: boolean
  snapshot: TabSnapshot | null
}

type TabState = {
  tabs: DocTab[]
  activeId: string | null
  openFiles: (files: File[]) => Promise<void>
  openInNewTab: (name: string, bytes: Uint8Array) => Promise<void>
  switchTo: (id: string) => Promise<void>
  close: (id: string) => Promise<boolean>
  closeAll: () => Promise<boolean>
  reorder: (ids: string[]) => void
}

export function isActiveDirty() {
  const markup = useMarkupStore.getState()
  return useViewerStore.getState().modified || markup.items !== markup.savedItems
}

// Only one tab may snapshot/switch at a time; opening itself is not awaited here.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(task: () => Promise<T>) {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

// A tab whose document is still loading keeps its snapshot here until it lands.
let restoring: { tabId: string; snap: TabSnapshot } | null = null

async function snapshotActive(activeId: string): Promise<TabSnapshot> {
  if (restoring?.tabId === activeId) {
    const { snap } = restoring
    restoring = null
    return snap
  }
  const viewer = useViewerStore.getState()
  const markup = useMarkupStore.getState()
  const doc = getActiveDocument(viewer.documentId)
  let bytes = getRetainedDocument()?.bytes ?? null
  let formEdited = false
  if (doc && doc.annotationStorage.size > 0) {
    try {
      bytes = new Uint8Array(await doc.saveDocument())
      formEdited = true
    } catch {
      // Keep the original bytes; only unsaved form input is lost.
    }
  }
  return {
    bytes,
    modified: viewer.modified || formEdited,
    items: markup.items,
    savedItems: markup.savedItems,
    signedIds: useSignFieldStore.getState().signedIds,
    currentPage: viewer.currentPage,
    readingMode: viewer.readingMode,
    zoomMode: viewer.zoomMode,
    customZoom: viewer.customZoom,
  }
}

function restore(tab: DocTab) {
  const viewer = useViewerStore.getState()
  useToolStore.getState().close()
  const snap = tab.snapshot
  if (!snap?.bytes) {
    viewer.closeDocument()
    return
  }
  useViewerStore.setState({ zoomMode: snap.zoomMode, customZoom: snap.customZoom })
  viewer.setReadingMode(snap.readingMode)
  restoring = { tabId: tab.id, snap }
  void viewer.openBytes(tab.name, snap.bytes, { modified: snap.modified }).then(() => {
    if (restoring?.tabId !== tab.id || restoring.snap !== snap) return
    restoring = null
    useMarkupStore.getState().restore(snap.items, snap.savedItems)
    useSignFieldStore.getState().restoreSigned(snap.signedIds)
    useViewerStore.getState().goToPage(snap.currentPage)
  })
}

export const useTabStore = create<TabState>((set, get) => {
  async function parkActive() {
    const { activeId } = get()
    if (!activeId) return
    const snap = await snapshotActive(activeId)
    const name = useViewerStore.getState().fileName
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === activeId
          ? {
              ...tab,
              name: name ?? tab.name,
              snapshot: snap,
              dirty: snap.modified || snap.items !== snap.savedItems,
            }
          : tab,
      ),
    }))
  }

  function activeIsBlank() {
    const { tabs, activeId } = get()
    return (
      tabs.some((tab) => tab.id === activeId) &&
      useViewerStore.getState().status === 'empty' &&
      !isActiveDirty()
    )
  }

  function startTab(name: string, open: () => void) {
    return serial(async () => {
      let id = get().activeId
      if (id && activeIsBlank()) {
        const reuse = id
        set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === reuse ? { ...tab, name } : tab)) }))
      } else {
        await parkActive()
        id = crypto.randomUUID()
        const tab: DocTab = { id, name, dirty: false, snapshot: null }
        set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }))
      }
      useToolStore.getState().close()
      open()
    })
  }

  return {
    tabs: [],
    activeId: null,

    openFiles: async (files) => {
      for (const file of files) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
          await startTab(file.name, () => void useViewerStore.getState().openFile(file))
          continue
        }
        const bytes = new Uint8Array(await file.arrayBuffer())
        await startTab(file.name, () => void useViewerStore.getState().openBytes(file.name, bytes, { modified: false }))
      }
    },

    openInNewTab: async (name, bytes) => {
      await startTab(name, () => void useViewerStore.getState().openBytes(name, bytes))
    },

    switchTo: (id) =>
      serial(async () => {
        const { tabs, activeId } = get()
        const target = tabs.find((tab) => tab.id === id)
        if (!target || id === activeId) return
        await parkActive()
        set({ activeId: id })
        restore(target)
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, snapshot: null, dirty: false } : tab)),
        }))
      }),

    close: (id) =>
      serial(async () => {
        const { tabs, activeId } = get()
        const index = tabs.findIndex((tab) => tab.id === id)
        const tab = tabs[index]
        if (!tab) return false
        const isActive = id === activeId
        const dirty = isActive ? isActiveDirty() : tab.dirty
        const name = isActive ? (useViewerStore.getState().fileName ?? tab.name) : tab.name
        if (dirty && !window.confirm(`Close "${name}" without saving? Your changes will be lost.`)) return false
        const remaining = tabs.filter((entry) => entry.id !== id)
        if (!isActive) {
          set({ tabs: remaining })
          return true
        }
        if (restoring?.tabId === id) restoring = null
        const next = remaining[index] ?? remaining[index - 1] ?? null
        set({ tabs: remaining, activeId: next?.id ?? null })
        if (next) {
          restore(next)
          set((state) => ({
            tabs: state.tabs.map((entry) => (entry.id === next.id ? { ...entry, snapshot: null, dirty: false } : entry)),
          }))
        } else {
          useViewerStore.getState().closeDocument()
        }
        return true
      }),

    closeAll: () =>
      serial(async () => {
        const { tabs, activeId } = get()
        const anyDirty = tabs.some((tab) => (tab.id === activeId ? isActiveDirty() : tab.dirty))
        if (anyDirty && !window.confirm('Close all documents? Unsaved changes will be lost.')) return false
        restoring = null
        set({ tabs: [], activeId: null })
        useViewerStore.getState().closeDocument()
        return true
      }),

    reorder: (ids) =>
      set((state) => {
        const byId = new Map(state.tabs.map((tab) => [tab.id, tab]))
        const next = ids.flatMap((id) => byId.get(id) ?? [])
        return next.length === state.tabs.length ? { tabs: next } : state
      }),
  }
})

export function anyTabDirty() {
  const { tabs, activeId } = useTabStore.getState()
  return tabs.some((tab) => (tab.id === activeId ? isActiveDirty() : tab.dirty))
}

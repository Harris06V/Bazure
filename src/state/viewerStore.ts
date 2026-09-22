import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  beginOpen,
  cancelOpen,
  isCurrentOpen,
  openErrorMessage,
  providePassword,
} from '../lib/pdf/openDocument'
import { destroyActiveDocument, setActiveDocument } from '../lib/pdf/session'
import type { PageSize, ReadingMode, ZoomMode } from '../lib/pdf/types'
import { clampZoom, ZOOM_STEP } from '../lib/zoom'
import { releaseRetainedDocument, retainBytes } from '../services/documentSource'
import { useMarkupStore } from './markupStore'
import { useToolStore } from './toolStore'

export type ViewerStatus = 'empty' | 'opening' | 'password' | 'ready' | 'error'

type ViewerState = {
  status: ViewerStatus
  error: string | null
  passwordIncorrect: boolean
  documentId: string | null
  fileName: string | null
  pageCount: number
  pageSizes: PageSize[]
  currentPage: number
  readingMode: ReadingMode
  zoomMode: ZoomMode
  customZoom: number
  displayZoom: number
  scrollNonce: number
  openFile: (file: File) => Promise<void>
  openBytes: (name: string, bytes: Uint8Array) => Promise<void>
  submitPassword: (password: string) => void
  goToPage: (page: number) => void
  setCurrentPageFromScroll: (page: number) => void
  setReadingMode: (mode: ReadingMode) => void
  setZoomMode: (mode: ZoomMode) => void
  zoomBy: (factor: number) => void
  setActualSize: () => void
  setDisplayZoom: (zoom: number) => void
}

let scrollRequest: number | null = null

export function takeScrollRequest() {
  const page = scrollRequest
  scrollRequest = null
  return page
}

function requestScroll(page: number) {
  scrollRequest = page
}

function looksLikePdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

async function measurePages(
  doc: PDFDocumentProxy,
  generation: number,
  publish: (sizes: PageSize[]) => void,
) {
  const count = doc.numPages
  const first = await doc.getPage(1)
  if (!isCurrentOpen(generation)) return
  const firstViewport = first.getViewport({ scale: 1 })
  const sizes = Array.from({ length: count }, () => ({
    width: firstViewport.width,
    height: firstViewport.height,
  }))
  publish(sizes.slice())

  const concurrency = 4
  let cursor = 2
  let completed = 1

  async function worker() {
    while (cursor <= count) {
      const pageNumber = cursor
      cursor += 1
      if (!isCurrentOpen(generation)) return
      let page
      try {
        page = await doc.getPage(pageNumber)
      } catch (error) {
        if (!isCurrentOpen(generation)) return
        throw error
      }
      if (!isCurrentOpen(generation)) return
      const viewport = page.getViewport({ scale: 1 })
      sizes[pageNumber - 1] = { width: viewport.width, height: viewport.height }
      completed += 1
      if (completed % 8 === 0 || completed === count) publish(sizes.slice())
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(count - 1, 0)) }, () =>
      worker(),
    ),
  )
}

function resetEdits() {
  useMarkupStore.getState().clear()
  useToolStore.getState().setPlace(null)
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  status: 'empty',
  error: null,
  passwordIncorrect: false,
  documentId: null,
  fileName: null,
  pageCount: 0,
  pageSizes: [],
  currentPage: 1,
  readingMode: 'continuous',
  zoomMode: 'fit-page',
  customZoom: 1,
  displayZoom: 1,
  scrollNonce: 0,

  openBytes: async (name, bytes) => {
    cancelOpen()
    destroyActiveDocument()
    releaseRetainedDocument()
    resetEdits()

    const retained = retainBytes(name, bytes)

    set({
      status: 'opening',
      error: null,
      passwordIncorrect: false,
      documentId: retained.id,
      fileName: name,
      pageCount: 0,
      pageSizes: [],
      currentPage: 1,
    })

    const { generation, promise } = beginOpen(bytes, (incorrect) => {
      if (!isCurrentOpen(generation)) return
      set({ status: 'password', passwordIncorrect: incorrect })
    })

    try {
      const doc = await promise
      if (!isCurrentOpen(generation)) {
        await doc.loadingTask.destroy()
        return
      }

      setActiveDocument(retained.id, doc)
      await measurePages(doc, generation, (pageSizes) => {
        if (!isCurrentOpen(generation)) return
        set({
          status: 'ready',
          pageCount: doc.numPages,
          pageSizes,
          passwordIncorrect: false,
        })
      })
    } catch (error) {
      if (!isCurrentOpen(generation)) return
      destroyActiveDocument()
      set({
        status: 'error',
        error: openErrorMessage(error),
        pageCount: 0,
        pageSizes: [],
      })
    }
  },

  openFile: async (file) => {
    if (!looksLikePdf(file)) {
      cancelOpen()
      destroyActiveDocument()
      releaseRetainedDocument()
      resetEdits()
      set({
        status: 'error',
        error: 'Choose a file that ends in .pdf.',
        passwordIncorrect: false,
        documentId: null,
        fileName: file.name,
        pageCount: 0,
        pageSizes: [],
        currentPage: 1,
      })
      return
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    await get().openBytes(file.name, bytes)
  },

  submitPassword: (password) => {
    if (get().status !== 'password') return
    set({ status: 'opening', passwordIncorrect: false })
    providePassword(password)
  },

  goToPage: (page) => {
    const { pageCount, status } = get()
    if (status !== 'ready' || pageCount < 1) return
    const next = Math.min(pageCount, Math.max(1, Math.trunc(page)))
    requestScroll(next)
    set((state) => ({ currentPage: next, scrollNonce: state.scrollNonce + 1 }))
  },

  setCurrentPageFromScroll: (page) => {
    const { pageCount, currentPage, status } = get()
    if (status !== 'ready') return
    const next = Math.min(pageCount, Math.max(1, Math.trunc(page)))
    if (next === currentPage) return
    set({ currentPage: next })
  },

  setReadingMode: (mode) => {
    const { currentPage, status, readingMode } = get()
    if (mode === readingMode) return
    if (status === 'ready') requestScroll(currentPage)
    set((state) => ({
      readingMode: mode,
      scrollNonce: state.scrollNonce + 1,
    }))
  },

  setZoomMode: (mode) => set({ zoomMode: mode }),

  zoomBy: (factor) => {
    const next = clampZoom(resolvedZoom.current * factor)
    set({ zoomMode: 'custom', customZoom: next })
  },

  setActualSize: () => set({ zoomMode: 'custom', customZoom: 1 }),

  setDisplayZoom: (zoom) => {
    if (Math.abs(get().displayZoom - zoom) < 0.001) return
    set({ displayZoom: zoom })
  },
}))

/** Latest scale painted by the stage. Zoom buttons multiply this, including fit modes. */
export const resolvedZoom = { current: 1 }

export { ZOOM_STEP }

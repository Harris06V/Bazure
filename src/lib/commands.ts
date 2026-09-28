import { baseName, isDesktop, pickAndOpen, pickSavePath, writePath } from './desktop'
import { downloadBytes, pdfNameFrom } from './pdf/download'
import { workingBytes } from './pdf/markupBake'
import { useMarkupStore } from '../state/markupStore'
import { useTabStore } from '../state/tabStore'
import { useToolStore, type ToolId } from '../state/toolStore'
import { useViewerStore } from '../state/viewerStore'

type WritableHandle = {
  name: string
  createWritable: () => Promise<{ write: (data: Uint8Array) => Promise<void>; close: () => Promise<void> }>
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string
    types: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<WritableHandle>
}

// Save As picks a real file; later Saves in the same tab overwrite it.
const saveHandles = new Map<string, WritableHandle>()

export function openPicker() {
  if (isDesktop) {
    void pickAndOpen().catch((error: unknown) => {
      window.alert(error instanceof Error ? error.message : 'Could not open that file.')
    })
    return
  }
  document.getElementById('bazure-file')?.click()
}

function hasDocument() {
  return useViewerStore.getState().status === 'ready'
}

function markSaved(name: string) {
  useViewerStore.getState().rename(name)
  useViewerStore.getState().setModified(false)
  useMarkupStore.getState().markSaved()
}

async function writeHandle(handle: WritableHandle, bytes: Uint8Array) {
  const writable = await handle.createWritable()
  await writable.write(bytes)
  await writable.close()
}

export async function save() {
  if (!hasDocument()) return
  const tabId = useTabStore.getState().activeId
  if (isDesktop) {
    const path = useTabStore.getState().tabs.find((tab) => tab.id === tabId)?.path
    if (!path) return saveAs()
    await writePath(path, await workingBytes())
    markSaved(baseName(path))
    return
  }
  const handle = tabId ? saveHandles.get(tabId) : undefined
  const bytes = await workingBytes()
  if (handle) {
    await writeHandle(handle, bytes)
    markSaved(handle.name)
    return
  }
  const name = pdfNameFrom(useViewerStore.getState().fileName ?? 'document.pdf')
  downloadBytes(bytes, name, 'application/pdf')
  markSaved(name)
}

export async function saveAs() {
  if (!hasDocument()) return
  const suggested = pdfNameFrom(useViewerStore.getState().fileName ?? 'document.pdf')
  if (isDesktop) {
    const chosen = await pickSavePath(suggested)
    if (!chosen) return
    const path = /\.pdf$/i.test(chosen) ? chosen : `${chosen}.pdf`
    await writePath(path, await workingBytes())
    const tabId = useTabStore.getState().activeId
    if (tabId) useTabStore.getState().setPath(tabId, path)
    markSaved(baseName(path))
    return
  }
  const picker = (window as SavePickerWindow).showSaveFilePicker
  if (picker) {
    let handle: WritableHandle
    try {
      handle = await picker({
        suggestedName: suggested,
        types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }],
      })
    } catch {
      return
    }
    await writeHandle(handle, await workingBytes())
    const tabId = useTabStore.getState().activeId
    if (tabId) saveHandles.set(tabId, handle)
    markSaved(handle.name)
    return
  }
  const chosen = window.prompt('Save as', suggested)?.trim()
  if (!chosen) return
  const name = pdfNameFrom(chosen)
  downloadBytes(await workingBytes(), name, 'application/pdf')
  markSaved(name)
}

export async function print() {
  if (!hasDocument()) return
  const bytes = await workingBytes()
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const url = URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
  document.getElementById('bazure-print')?.remove()
  const frame = document.createElement('iframe')
  frame.id = 'bazure-print'
  frame.title = 'Print'
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  frame.src = url
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, '_blank', 'noopener')
    }
  }
  document.body.append(frame)
  // Leave the frame long enough for the print dialog to read it.
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
}

function copySelectedText() {
  const text = window.getSelection()?.toString() ?? ''
  if (!text) return false
  void navigator.clipboard?.writeText(text)
  return true
}

export function copy() {
  return useMarkupStore.getState().copySelected() || copySelectedText()
}

export function cut() {
  return useMarkupStore.getState().cutSelected()
}

export function paste() {
  if (!hasDocument()) return false
  return useMarkupStore.getState().paste(useViewerStore.getState().currentPage)
}

export function duplicate() {
  return useMarkupStore.getState().duplicateSelected()
}

export function deleteSelected() {
  return useMarkupStore.getState().removeSelected()
}

export function undo() {
  useMarkupStore.getState().undo()
}

export function redo() {
  useMarkupStore.getState().redo()
}

export function closeActiveTab() {
  const { activeId, close } = useTabStore.getState()
  if (activeId) void close(activeId)
}

export function openTool(id: ToolId) {
  const tools = useToolStore.getState()
  if (tools.active !== id) tools.toggle(id)
}

export function toggleFullScreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.()
}

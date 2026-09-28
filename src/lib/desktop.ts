import { useTabStore, anyTabDirty } from '../state/tabStore'

/** True inside the Tauri desktop shell; false in a normal browser. */
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const PDF_FILTER = [{ name: 'PDF document', extensions: ['pdf'] }]

export function baseName(path: string) {
  return path.split(/[\\/]/).pop() || path
}

function samePath(a: string, b: string) {
  return a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase()
}

export async function openPaths(paths: string[]) {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  for (const path of paths) {
    const tabs = useTabStore.getState()
    const existing = tabs.tabs.find((tab) => tab.path && samePath(tab.path, path))
    if (existing) {
      await tabs.switchTo(existing.id)
      continue
    }
    const bytes = await readFile(path)
    await tabs.openInNewTab(baseName(path), bytes, { modified: false, path })
  }
}

export async function pickAndOpen() {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({ multiple: true, directory: false, filters: PDF_FILTER })
  if (!picked) return
  await openPaths(Array.isArray(picked) ? picked : [picked])
}

/** Native Save dialog. Returns the chosen path, or null if cancelled. */
export async function pickSavePath(suggestedName: string) {
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({ defaultPath: suggestedName, filters: PDF_FILTER })
}

export async function writePath(path: string, bytes: Uint8Array) {
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  await writeFile(path, bytes)
}

export async function initDesktop() {
  const [{ invoke }, { listen }, { getCurrentWindow }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event'),
    import('@tauri-apps/api/window'),
  ])

  await listen<string[]>('open-files', (event) => void openPaths(event.payload))
  const launched = await invoke<string[]>('take_launch_files')
  if (launched.length > 0) await openPaths(launched)

  await getCurrentWindow().onCloseRequested((event) => {
    if (anyTabDirty() && !window.confirm('Quit Bazure? Unsaved changes will be lost.')) event.preventDefault()
  })
}

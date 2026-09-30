export type ThemeName = 'dark' | 'light'

const KEY = 'bazure-theme'

export function currentTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Storage can be blocked; the choice still applies for this session.
  }
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme))
      .catch(() => undefined)
  }
}

export function initTheme() {
  let theme: ThemeName = 'dark'
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') theme = stored
  } catch {
    theme = 'dark'
  }
  applyTheme(theme)
}

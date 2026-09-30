import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-500.css'
import '@fontsource/source-sans-3/latin-600.css'
import '@fontsource/newsreader/latin-500.css'
import './lib/pdf/setup'
import 'pdfjs-dist/web/pdf_viewer.css'
import './index.css'
import App from './App.tsx'
import { initDesktop, isDesktop } from './lib/desktop'
import { initTheme } from './lib/theme'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (isDesktop) void initDesktop()

import { cpSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const

function copyPdfjsAssets(): Plugin {
  const copy = () => {
    const sourceRoot = path.resolve('node_modules/pdfjs-dist')
    const destRoot = path.resolve('public/pdfjs')
    for (const folder of PDFJS_ASSET_DIRS) {
      cpSync(path.join(sourceRoot, folder), path.join(destRoot, folder), {
        recursive: true,
      })
    }
  }

  return {
    name: 'bazure-pdfjs-assets',
    buildStart: copy,
    configureServer: copy,
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyPdfjsAssets()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})

<img src="assets/bazure-icon.svg" width="64" alt="Bazure">

# Bazure

Browser-based PDF editor. Runs fully client-side; files never leave the machine.

## Download

**[Get the Windows installer from the latest release](https://github.com/Harris06V/Bazure/releases/latest)**: download `Bazure_<version>_x64-setup.exe` and run it. No admin rights needed.

The installer isn't code-signed, so Windows SmartScreen may warn on first run. Click **More info**, then **Run anyway**.

Everything below is for building from source.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build -> dist/
npm run preview  # serve dist/
npm run lint
```

Requires Node 20.19+ (Vite 8).

## Desktop app (Tauri)

One-time prerequisites (Windows):

```sh
winget install Microsoft.VisualStudio.2022.BuildTools --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install Rustlang.Rustup
```

Restart the terminal, then:

```sh
npm run app:dev     # desktop window with hot reload (stop any running `npm run dev` first)
npm run app:build   # installers -> src-tauri/target/release/bundle/{nsis,msi}/
```

Releases: bump `version` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, then push a matching tag (`git tag v0.1.1 && git push --tags`). The `Release` workflow builds the installers on GitHub and attaches them to a release.

Desktop-only behavior:

- Registers as a handler for `.pdf` ("Open with Bazure"). Opening more PDFs adds tabs to the running window.
- Open / Save / Save as use native dialogs. Save overwrites the original file.
- Asks before quitting with unsaved changes.
- The webview can only read/write files you picked or opened (no blanket file system access).

## Features

| Area | What it does |
| --- | --- |
| Tabs | Multiple PDFs open at once. Drag to reorder, middle-click to close. Unsaved dot per tab. |
| Menu (top-left) | Open, Create, Save, Save as, Print, Undo/Redo, Cut/Copy/Paste, zoom/view, close tabs. |
| Select | Click to select, drag to move, corner handles to resize. Double-click text to edit. |
| Comment | Highlight, underline, strikethrough selected text. Sticky notes. |
| Edit | Add text, place images, white-out regions (visual cover, not true redaction). |
| Stamp | Approved, Draft, Confidential, Sign here, etc. |
| Fill & Sign | Fill form fields. Draw/type/upload a signature. Adds "Digitally signed by … / Date" block. Detects empty signature fields and prompts to sign them. |
| Pages | Drag thumbnails to reorder. Rotate, duplicate, delete, insert blank, page numbers, extract. |
| Create / Combine | Build a PDF from Word, Excel, PowerPoint, images, or other PDFs (Create is in the menu). Result opens in a new tab. |
| Export | PDF, PNG/JPEG per page or all pages (zip), plain text. |
| Compress | Shrink file size. |

The signature block is a visual stamp, not a cryptographic (PKI) signature.

## Shortcuts

| Keys | Action |
| --- | --- |
| Ctrl+O / S / Shift+S / P | Open / Save / Save as / Print |
| Ctrl+Z / Y | Undo / Redo (markups) |
| Ctrl+C / X / V / D | Copy / Cut / Paste / Duplicate selected item |
| Del | Delete selected item |
| Arrows | Nudge selected item (Shift = larger step); otherwise change page |
| Ctrl + / - / 0 | Zoom in / out / 100% |
| Ctrl+L | Full screen |
| Ctrl+Shift+←/→ | Move focused tab |
| Esc | Cancel placement / deselect |

## License

[MIT](LICENSE)

## Stack

React 19, TypeScript, Vite, Zustand, Tailwind 4, pdf.js (render), pdf-lib (write), mammoth + fflate + utif (import).

## Layout

```
src/
  App.tsx               global shortcuts, file open, drag-drop
  components/
    shell/              toolbar, menu, tab bar
    tools/              tool rail, side panel, one file per tool in panels/
    viewer/             page rendering, markup overlay, signature fields
  hooks/                useTask, useDragReorder
  lib/
    commands.ts         save / print / clipboard / undo actions shared by menu + keys
    desktop.ts          Tauri bridge: native dialogs, file read/write, launch files
    pdf/                pdf.js + pdf-lib helpers (open, bake markups, assemble, export)
  state/                zustand stores: viewer, tabs, markups, tools, sign fields
src-tauri/              desktop shell: Rust entry, window/bundle config, permissions, icons
assets/                 source logo files
.github/workflows/      release.yml: builds Windows installers on version tags
public/pdfjs/           pdf.js fonts/cmaps, copied from node_modules on dev/build (gitignored)
```

Markups live in `state/markupStore` as normalized page coordinates (0–1) and are only written into the PDF on save/export (`lib/pdf/markupBake.ts`).

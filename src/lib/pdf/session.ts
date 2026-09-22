import type { PDFDocumentProxy } from 'pdfjs-dist'

type ActiveDocument = {
  id: string
  doc: PDFDocumentProxy
}

let active: ActiveDocument | null = null

export function setActiveDocument(id: string, doc: PDFDocumentProxy) {
  if (active && active.doc !== doc) releaseDocument(active.doc)
  active = { id, doc }
}

export function getActiveDocument(id: string | null) {
  if (!id || active?.id !== id) return null
  return active.doc
}

export function destroyActiveDocument() {
  if (!active) return
  const doc = active.doc
  active = null
  releaseDocument(doc)
}

function releaseDocument(doc: PDFDocumentProxy) {
  // Wait a frame so in-flight page renders can cancel before the worker goes away.
  requestAnimationFrame(() => {
    void doc.loadingTask.destroy()
  })
}

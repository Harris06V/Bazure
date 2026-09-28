/**
 * Bytes for the open document stay here so a later export step (pdf-lib)
 * can flatten annotations without asking the renderer to give them back.
 * pdf.js transfers the buffer it is given into the worker, so callers pass
 * a copy and keep this one.
 *
 * `origin` is the seam for a future remote document: add a variant, keep
 * the viewer on PDFDocumentProxy + page sizes.
 */
export type DocumentOrigin = {
  kind: 'local-file'
  name: string
}

export type RetainedDocument = {
  id: string
  origin: DocumentOrigin
  bytes: Uint8Array
}

let retained: RetainedDocument | null = null

export function retainBytes(name: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const document: RetainedDocument = {
    id: crypto.randomUUID(),
    origin: { kind: 'local-file', name },
    bytes: copy,
  }
  retained = document
  return document
}

export function retainLocalFile(file: File, bytes: Uint8Array) {
  return retainBytes(file.name, bytes)
}

export function getRetainedDocument() {
  return retained
}

export function releaseRetainedDocument() {
  retained = null
}

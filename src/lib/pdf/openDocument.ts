import {
  getDocument,
  InvalidPDFException,
  PasswordResponses,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import { pdfAsset } from './setup'

type PasswordHandler = (incorrect: boolean) => void

let token = 0
let passwordUpdate: ((password: string) => void) | null = null
let pending: { task: PDFDocumentLoadingTask; settled: boolean } | null = null

function abortPendingLoad() {
  passwordUpdate = null
  if (pending && !pending.settled) pending.task.destroy()
  pending = null
}

export function isCurrentOpen(generation: number) {
  return generation === token
}

export function cancelOpen() {
  token += 1
  abortPendingLoad()
}

export function providePassword(password: string) {
  const update = passwordUpdate
  passwordUpdate = null
  update?.(password)
}

/**
 * Starts a load. The returned promise stays pending while pdf.js is waiting
 * for a password; call `providePassword` from the prompt.
 */
export function beginOpen(bytes: Uint8Array, onPassword: PasswordHandler) {
  token += 1
  const generation = token
  abortPendingLoad()

  const task = getDocument({
    data: bytes.slice(),
    cMapUrl: pdfAsset('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: pdfAsset('standard_fonts/'),
    wasmUrl: pdfAsset('wasm/'),
    iccUrl: pdfAsset('iccs/'),
    enableXfa: true,
  })

  pending = { task, settled: false }

  task.onPassword = (update: (password: string) => void, reason: number) => {
    if (generation !== token) return
    passwordUpdate = update
    onPassword(reason === PasswordResponses.INCORRECT_PASSWORD)
  }

  const promise = task.promise.finally(() => {
    if (pending?.task === task) pending.settled = true
  })

  return { generation, promise }
}

export function openErrorMessage(error: unknown) {
  if (
    error instanceof InvalidPDFException ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'InvalidPDFException')
  ) {
    return "This file doesn't look like a readable PDF."
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'PasswordException' || error.name === 'UnknownErrorException')
  ) {
    return 'Bazure could not unlock this PDF.'
  }

  return 'Something went wrong while reading this file.'
}

export type { PDFDocumentProxy }

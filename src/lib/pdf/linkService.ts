import { getActiveDocument } from './session'
import { useViewerStore } from '../../state/viewerStore'

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * The small slice of pdf.js's link service this reader needs:
 * in-document jumps, named page actions, and web links.
 */
export function createLinkService(documentId: string) {
  return {
    externalLinkEnabled: true,
    eventBus: undefined,
    addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow = false) {
      const parsed = URL.parse(url)
      if (!parsed || !SAFE_PROTOCOLS.has(parsed.protocol)) {
        link.removeAttribute('href')
        link.title = url
        link.onclick = () => false
        return
      }
      link.href = parsed.href
      link.title = parsed.href
      link.target = newWindow ? '_blank' : '_blank'
      link.rel = 'noopener noreferrer'
    },
    getDestinationHash() {
      return '#'
    },
    getAnchorUrl(anchor: string) {
      return anchor || '#'
    },
    async goToDestination(dest: unknown) {
      const doc = getActiveDocument(documentId)
      if (!doc) return
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
      if (!Array.isArray(explicit)) return
      const [ref] = explicit as unknown[]
      let pageNumber = 0
      if (ref && typeof ref === 'object') {
        pageNumber = doc.cachedPageNumber(ref as never) ?? 0
        if (!pageNumber) pageNumber = (await doc.getPageIndex(ref as never)) + 1
      } else if (typeof ref === 'number' && Number.isInteger(ref)) {
        pageNumber = ref + 1
      }
      if (pageNumber >= 1) useViewerStore.getState().goToPage(pageNumber)
    },
    executeNamedAction(action: string) {
      const { currentPage, pageCount, goToPage } = useViewerStore.getState()
      if (action === 'NextPage') goToPage(currentPage + 1)
      else if (action === 'PrevPage') goToPage(currentPage - 1)
      else if (action === 'FirstPage') goToPage(1)
      else if (action === 'LastPage') goToPage(pageCount)
    },
    async getAttachmentContent(id: string) {
      const doc = getActiveDocument(documentId)
      if (!doc) return null
      return doc.getAttachmentContent(id)
    },
    executeSetOCGState() {},
  }
}

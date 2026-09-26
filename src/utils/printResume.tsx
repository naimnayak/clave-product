import { createRoot } from 'react-dom/client'
import { ResumePreview } from '@/components/builder/ResumePreview'
import type { ResumeDocument } from '@/types/resumeDocument'

/**
 * PDF export: renders the resume with the exact editor template into a hidden A4 frame and opens the
 * browser's print dialog, where "Save as PDF" produces a vector PDF with real, selectable text
 * (what ATS parsers need, unlike image-based PDF exports).
 */
const PAGE_WIDTH = 794 // A4 at 96dpi, same as ResumePreview

const PRINT_CSS = `
  @page { size: A4; margin: 14mm 0; }
  @page :first { margin-top: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${PAGE_WIDTH}px; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  article { box-shadow: none !important; }
  li, p, h2 { break-inside: avoid; }
  h2 { break-after: avoid; }
`

const fileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Resume'

function stylesheetsLoaded(doc: Document): Promise<void> {
  const links = [...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.sheet) return resolve()
          link.addEventListener('load', () => resolve(), { once: true })
          link.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  ).then(() => undefined)
}

export async function printResume(resume: ResumeDocument): Promise<void> {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  Object.assign(frame.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${PAGE_WIDTH}px`,
    height: '1123px',
    border: '0',
    visibility: 'hidden',
  })
  document.body.appendChild(frame)

  const win = frame.contentWindow
  const doc = frame.contentDocument
  if (!win || !doc) {
    frame.remove()
    throw new Error('Printing is not available in this browser.')
  }

  doc.open()
  doc.write('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>')
  doc.close()
  doc.title = fileName(resume.name)
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) doc.head.appendChild(node.cloneNode(true))
  const printStyle = doc.createElement('style')
  printStyle.textContent = PRINT_CSS
  doc.head.appendChild(printStyle)

  const mount = doc.createElement('div')
  doc.body.appendChild(mount)
  const root = createRoot(mount)
  root.render(<ResumePreview doc={resume} />)

  await stylesheetsLoaded(doc)
  await doc.fonts?.ready
  // Let the preview measure itself at full width before printing.
  await new Promise((resolve) => setTimeout(resolve, 250))

  // Some browsers name the PDF after the top-level page title.
  const previousTitle = document.title
  document.title = doc.title
  const cleanup = () => {
    document.title = previousTitle
    root.unmount()
    frame.remove()
  }
  win.addEventListener('afterprint', () => setTimeout(cleanup, 0), { once: true })
  setTimeout(() => frame.isConnected && cleanup(), 120_000)
  win.focus()
  win.print()
}

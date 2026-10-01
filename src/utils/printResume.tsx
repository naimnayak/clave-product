import { createRoot } from 'react-dom/client'
import { PAGE_WIDTH, ResumePreview } from '@/components/builder/ResumePreview'
import type { ResumeDocument } from '@/types/resumeDocument'

/**
 * PDF export: renders the resume with the exact editor template into a hidden A4 frame and opens the
 * browser's print dialog, where "Save as PDF" produces a vector PDF with real, selectable text
 * (what ATS parsers need, unlike image-based PDF exports).
 *
 * - Zero page margins: browsers only print their header/footer (page title, URL, date, page number)
 *   inside the page margin, so with none there is no "Clave" footer on the resume.
 * - The page renders unscaled (no CSS transform): transformed content can't be split across pages
 *   and gets cropped after page one.
 * - Spacing between pages comes from the page's own padding, repeated on every page fragment.
 * - The page is a hair shorter than A4 so a full single page never spills into a blank second one.
 */
const PRINT_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; min-height: 0 !important; }
  body { width: 210mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .resume-page {
    width: 210mm !important;
    min-height: calc(297mm - 2px) !important;
    box-shadow: none !important;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
  .resume-page > div, .resume-page > aside { -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  li, p, header, h1 { break-inside: avoid; }
  h2 { break-inside: avoid; break-after: avoid; }
`

export const resumeFileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Resume'

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
  doc.write('<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"></head><body></body></html>')
  doc.close()
  doc.title = resumeFileName(resume.name)
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) doc.head.appendChild(node.cloneNode(true))
  const printStyle = doc.createElement('style')
  printStyle.textContent = PRINT_CSS
  doc.head.appendChild(printStyle)

  const mount = doc.createElement('div')
  doc.body.appendChild(mount)
  const root = createRoot(mount)
  root.render(<ResumePreview doc={resume} bare />)

  await stylesheetsLoaded(doc)
  await doc.fonts?.ready
  // Let React commit and fonts settle before printing.
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

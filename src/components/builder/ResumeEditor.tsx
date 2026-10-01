import { FileQuestion, LayoutPanelLeft, Minus, Plus, ScanEye, Shrink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EditorPanel } from '@/components/builder/EditorPanel'
import { ResumePreview } from '@/components/builder/ResumePreview'
import { DownloadButton, ResumeTopBar } from '@/components/builder/ResumeTopBar'
import { TemplateMenu } from '@/components/builder/TemplateMenu'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { useResumeEditor } from '@/hooks/useResumeEditor'
import { paths } from '@/routes/navigation'
import { toast } from '@/store/toastStore'
import { computeAts } from '@/utils/ats'
import { cn } from '@/utils/cn'
import { exportResume } from '@/services/resumeExport.service'
import type { ResumeExportFormat } from '@/services/resumeExport.service'

type MobileView = 'editor' | 'preview'

const ZOOM_STEPS = [50, 65, 75, 90, 100, 110, 125]
const DEFAULT_ZOOM_INDEX = 4 // 100%

/** Minimal zoom control strip shown above the A4 preview. */
function PreviewToolbar({
  zoomIndex,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  zoomIndex: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}) {
  const zoom = ZOOM_STEPS[zoomIndex]
  const canZoomIn = zoomIndex < ZOOM_STEPS.length - 1
  const canZoomOut = zoomIndex > 0

  const btnBase =
    'flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface/80 hover:text-text disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="mb-3 flex items-center justify-end gap-0.5">
      <button
        type="button"
        aria-label="Fit to screen"
        title="Fit to screen"
        onClick={onFit}
        className={cn(btnBase, zoom === ZOOM_STEPS[DEFAULT_ZOOM_INDEX] && 'text-primary/60')}
      >
        <Shrink className="size-3.5" aria-hidden />
      </button>
      <div className="mx-1 h-4 w-px bg-border/60" aria-hidden />
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        className={btnBase}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span
        aria-live="polite"
        aria-label={`Zoom: ${zoom}%`}
        className="w-10 text-center text-xs tabular-nums text-muted select-none"
      >
        {zoom}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        className={btnBase}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

/**
 * The shared destination for all four creation flows: a compact section editor
 * beside a large A4 preview. Below md the two switch via tabs.
 */
export function ResumeEditor({ id }: { id: string }) {
  const { doc, status, saveState, update, saveNow } = useResumeEditor(id)
  const [mobileView, setMobileView] = useState<MobileView>('editor')
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const ats = useMemo(() => (doc ? computeAts(doc) : null), [doc])

  if (status === 'loading') return <LoadingState label="Opening your resume…" className="min-h-dvh" />
  if (status === 'notFound' || !doc || !ats) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <EmptyState
          icon={FileQuestion}
          title="Resume not found"
          description="It may have been deleted, or the link is wrong."
          action={
            <Link to={paths.resumes} className={buttonStyles({ variant: 'secondary' })}>
              Back to Resumes
            </Link>
          }
        />
      </div>
    )
  }

  const changeTemplate = (template: typeof doc.template) => update((d) => ({ ...d, template }))
  const download = async (format: ResumeExportFormat) => {
    // The Word file is built from the saved resume, so pending edits must be saved first.
    if (!(await saveNow()) && format === 'docx') return
    if (format === 'pdf') toast.info('Choose “Save as PDF”', 'Pick it as the destination in the print dialog to download your resume.')
    try {
      await exportResume(doc, format)
      if (format === 'docx') toast.success('Your Word document is downloading')
    } catch (error) {
      toast.error(format === 'pdf' ? 'Couldn’t prepare the PDF' : 'Couldn’t create the Word document', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const zoomScale = ZOOM_STEPS[zoomIndex] / 100

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <ResumeTopBar
        name={doc.name}
        onNameChange={(name) => update((d) => ({ ...d, name }))}
        saveState={saveState}
        ats={ats}
        template={doc.template}
        onTemplateChange={changeTemplate}
        onSave={async () => {
          if (await saveNow()) toast.success('Resume saved')
        }}
        onDownload={(format) => void download(format)}
        resumeId={doc.id}
        beforeReview={saveNow}
      />

      {/* ── Mobile tab bar ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center border-b border-border bg-surface md:hidden">
        <div role="tablist" aria-label="Editor or preview" className="flex flex-1">
          {([
            { view: 'editor', label: 'Edit', Icon: LayoutPanelLeft },
            { view: 'preview', label: 'Preview', Icon: ScanEye },
          ] as const).map(({ view, label, Icon }) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={mobileView === view}
              onClick={() => setMobileView(view)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors',
                mobileView === view
                  ? 'border-primary text-primary'
                  : 'border-transparent text-secondary hover:text-text',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 border-l border-border px-3">
          <TemplateMenu value={doc.template} onChange={changeTemplate} compact />
          <DownloadButton onDownload={(format) => void download(format)} compact />
        </div>
      </div>

      {/* ── Main workspace ──────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">

        {/* Left: Editor panel */}
        <aside
          aria-label="Resume editor"
          className={cn(
            'flex min-h-0 flex-col overflow-y-auto border-r border-border bg-surface md:block md:w-[38%] md:shrink-0 lg:w-[380px] xl:w-[400px]',
            mobileView === 'editor' ? 'w-full' : 'hidden',
          )}
        >
          <EditorPanel doc={doc} update={update} />
        </aside>

        {/* Right: Preview canvas */}
        <main
          aria-label="Resume preview"
          className={cn(
            'min-h-0 flex-1 overflow-y-auto md:block',
            mobileView === 'preview' ? 'block' : 'hidden',
            'bg-[var(--editor-canvas)]',
          )}
        >
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
            {/* Preview toolbar — zoom controls */}
            <PreviewToolbar
              zoomIndex={zoomIndex}
              onZoomIn={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              onZoomOut={() => setZoomIndex((i) => Math.max(0, i - 1))}
              onFit={() => setZoomIndex(DEFAULT_ZOOM_INDEX)}
            />

            {/* A4 document — zoom applied via a scale wrapper that collapses layout height */}
            <div
              style={{
                // Collapse the box to the scaled height so there's no gap below
                height: zoomScale !== 1 ? `${zoomScale * 100}%` : undefined,
                transformOrigin: 'top center',
              }}
            >
              <div
                className="overflow-hidden rounded-sm shadow-[0_4px_24px_-4px_rgba(6,26,24,0.14),0_1px_4px_rgba(6,26,24,0.06)] ring-1 ring-black/5"
                style={{
                  transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
                  transformOrigin: 'top center',
                }}
              >
                <ResumePreview doc={doc} update={update} />
              </div>
            </div>

            <div className="h-16" />
          </div>
        </main>
      </div>
    </div>
  )
}

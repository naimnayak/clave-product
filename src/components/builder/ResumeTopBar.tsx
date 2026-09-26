import { ArrowLeft, Check, Download, Loader2, Pencil } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtsScorePopover } from '@/components/builder/AtsScorePopover'
import { TemplateMenu } from '@/components/builder/TemplateMenu'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { IconButton } from '@/components/ui/IconButton'
import type { SaveState } from '@/hooks/useResumeEditor'
import { paths } from '@/routes/navigation'
import type { TemplateId } from '@/types/resumeDocument'
import type { AtsResult } from '@/utils/ats'
import { cn } from '@/utils/cn'

interface ResumeTopBarProps {
  name: string
  onNameChange: (name: string) => void
  saveState: SaveState
  ats: AtsResult
  template: TemplateId
  onTemplateChange: (id: TemplateId) => void
  onSave: () => void
  onDownload: () => void
  /** Enables the AI review in the ATS popover. */
  resumeId?: string
  beforeReview?: () => Promise<unknown>
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-muted transition-opacity">
      {state === 'saved' && (
        <>
          <Check className="size-3 text-primary" strokeWidth={2.5} aria-hidden />
          <span className="hidden sm:inline">Saved</span>
        </>
      )}
      {state === 'saving' && (
        <>
          <Loader2 className="size-3 animate-spin text-muted" aria-hidden />
          <span className="hidden sm:inline">Saving…</span>
        </>
      )}
      {state === 'unsaved' && (
        <>
          <span className="size-1.5 rounded-full bg-warning" aria-hidden />
          <span className="hidden sm:inline text-warning">Unsaved</span>
        </>
      )}
    </p>
  )
}

/** Inline editable resume name: click to edit, blur/enter to commit. */
function ResumeName({ name, onChange }: { name: string; onChange: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEditing = () => {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => setEditing(false)

  return (
    <div className="group relative flex min-w-0 items-center">
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          aria-label="Resume name"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commit() }}
          className="w-full min-w-0 rounded-control bg-background px-2 py-0.5 text-sm font-semibold text-text focus:outline-2 focus:outline-primary"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Rename resume: ${name}`}
          className={cn(
            'flex min-w-0 items-center gap-1.5 rounded-control px-2 py-0.5 text-left text-sm font-semibold text-text',
            'hover:bg-background transition-colors',
          )}
        >
          <span className="min-w-0 truncate">{name || 'Untitled Resume'}</span>
          <Pencil className="size-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </button>
      )}
    </div>
  )
}

/** Download as an icon on narrow screens and a labelled button on wider ones. */
export function DownloadButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return compact ? (
    <IconButton label="Download PDF" variant="secondary" onClick={onClick}>
      <Download className="size-4" aria-hidden />
    </IconButton>
  ) : (
    <Button variant="secondary" size="sm" onClick={onClick} leadingIcon={<Download className="size-4" />}>
      Download
    </Button>
  )
}

export function ResumeTopBar({ name, onNameChange, saveState, ats, template, onTemplateChange, onSave, onDownload, resumeId, beforeReview }: ResumeTopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 shadow-xs sm:gap-3 sm:px-4">
      {/* Left: back + name + save status */}
      <Link
        to={paths.resumes}
        className={buttonStyles({ variant: 'secondary', size: 'sm' })}
        aria-label="Back to Resumes"
      >
        <ArrowLeft className="size-4" aria-hidden />
        <span className="hidden sm:inline">Back</span>
      </Link>

      <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <ResumeName name={name} onChange={onNameChange} />
        <div className="px-2">
          <SaveStatus state={saveState} />
        </div>
      </div>

      {/* Right: ATS + template + download + save */}
      <div className="flex shrink-0 items-center gap-1.5">
        <AtsScorePopover result={ats} resumeId={resumeId} beforeReview={beforeReview} />
        <span className="hidden h-5 w-px bg-border md:block" aria-hidden />
        <span className="hidden md:block">
          <TemplateMenu value={template} onChange={onTemplateChange} />
        </span>
        <span className="hidden md:block">
          <DownloadButton onClick={onDownload} />
        </span>
        <Button size="sm" onClick={onSave} disabled={saveState === 'saving'}>
          Save
        </Button>
      </div>
    </header>
  )
}

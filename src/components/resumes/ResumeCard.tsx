import { ArrowRight, Briefcase, Clock, Copy, Download, Eye, FileType, MoreHorizontal, MoreVertical, Pencil, Target, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATSBadge } from '@/components/resumes/ATSBadge'
import { ResumeStatusBadge } from '@/components/resumes/ResumeStatusBadge'
import { resumeStatus } from '@/utils/resumeStatus'
import { ResumeThumbnail } from '@/components/resumes/ResumeThumbnail'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown'
import { IconButton } from '@/components/ui/IconButton'
import { resumePath, useFromHere } from '@/routes/navigation'
import type { ResumeExportFormat } from '@/services/resumeExport.service'
import type { Resume } from '@/types/resume'
import { formatRelativeTime } from '@/utils/relativeTime'

export type ResumeCardView = 'grid' | 'list'

interface ResumeCardProps {
  resume: Resume
  view: ResumeCardView
  onPreview: () => void
  onRename: () => void
  onDuplicate: () => void
  onTailor: () => void
  onDownload: (format: ResumeExportFormat) => void
  onDelete: () => void
}

/** "Tailored · Stripe", "Draft · General", or just the target role. */
function subtitle(resume: Resume) {
  const status = resumeStatus(resume)
  if (status === 'tailored') return `Tailored · ${resume.tailoredFor ?? resume.targetRole}`
  return `${resume.targetRole} · General`
}

export function ResumeCard({ resume, view, onPreview, onRename, onDuplicate, onTailor, onDownload, onDelete }: ResumeCardProps) {
  const { id, name, atsScore, updatedAt } = resume
  // The editor's Back returns to the library (with its search) instead of a fixed page.
  const from = useFromHere()

  const menu = (icon: 'vertical' | 'horizontal') => (
    <Dropdown
      label={`Actions for ${name}`}
      trigger={(triggerProps) => (
        <IconButton label={`More actions for ${name}`} size="sm" {...triggerProps}>
          {icon === 'vertical' ? <MoreVertical className="size-4" aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden />}
        </IconButton>
      )}
    >
      <DropdownItem icon={Pencil} onSelect={onRename}>
        Rename
      </DropdownItem>
      <DropdownItem icon={Copy} onSelect={onDuplicate}>
        Duplicate
      </DropdownItem>
      <DropdownItem icon={Target} onSelect={onTailor}>
        Tailor to Job
      </DropdownItem>
      <DropdownItem icon={Download} onSelect={() => onDownload('pdf')}>
        Download PDF
      </DropdownItem>
      <DropdownItem icon={FileType} onSelect={() => onDownload('docx')}>
        Download Word (DOCX)
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem icon={Trash2} destructive onSelect={onDelete}>
        Delete
      </DropdownItem>
    </Dropdown>
  )

  const updated = (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <Clock className="size-3.5" aria-hidden />
      Updated {formatRelativeTime(updatedAt)}
    </span>
  )

  if (view === 'list') {
    return (
      <article className="flex items-center gap-4 rounded-large border border-border bg-surface p-3 shadow-xs transition-all hover:border-primary/40 hover:shadow-card">
        <div className="h-24 w-[68px] shrink-0 overflow-hidden rounded-control bg-tint p-1.5">
          <ResumeThumbnail resumeId={id} updatedAt={updatedAt} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-semibold text-text">{name}</h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-secondary">
            <Briefcase className="size-3 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{subtitle(resume)}</span>
          </p>
          <div className="mt-1 md:hidden">{updated}</div>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <ResumeStatusBadge resume={resume} />
          <ATSBadge score={atsScore} />
        </div>
        <div className="hidden md:block">{updated}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPreview} className={`${buttonStyles({ variant: 'secondary', size: 'sm' })} hidden sm:inline-flex`}>
            Preview
          </button>
          <Link to={resumePath(id)} state={from} aria-label={`Open Resume: ${name}`} className={buttonStyles({ size: 'sm' })}>
            Open
          </Link>
          {menu('vertical')}
        </div>
      </article>
    )
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-large border border-border bg-surface shadow-xs transition-all hover:border-primary/40 hover:shadow-card">
      <div className="relative flex h-44 items-end justify-center bg-tint px-5 pt-10">
        <ResumeThumbnail resumeId={id} updatedAt={updatedAt} className="h-full w-[68%] max-w-[200px] rounded-t-[4px]" />
        <div className="absolute top-2.5 right-2.5 left-2.5 flex items-start justify-between">
          <ResumeStatusBadge resume={resume} />
          <div className="flex items-center gap-1">
            <ATSBadge score={atsScore} />
            {menu('vertical')}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-text">{name}</h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-secondary">
            <Briefcase className="size-3 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{subtitle(resume)}</span>
          </p>
          <div className="mt-1">{updated}</div>
        </div>
        <div className="mt-auto flex items-center gap-2">
          <button type="button" onClick={onPreview} className={`${buttonStyles({ variant: 'secondary', size: 'sm' })} h-7! flex-1 gap-1.5! text-xs!`}>
            <Eye className="size-3.5" aria-hidden />
            Preview
          </button>
          <Link to={resumePath(id)} state={from} aria-label={`Open Resume: ${name}`} className={`${buttonStyles({ size: 'sm' })} h-7! flex-[1.4] gap-1.5! text-xs!`}>
            Open
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          {menu('horizontal')}
        </div>
      </div>
    </article>
  )
}

import { ArrowRight, Briefcase, Check, FileText, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlowShell } from '@/components/resumes/FlowShell'
import { resumePath } from '@/routes/navigation'
import { createResumeDocument } from '@/services/resumeDocument.service'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { resumeStructures } from '@/utils/resumeStructures'
import type { ResumeSectionKey } from '@/types/resumeDocument'

const sectionLabels: Record<ResumeSectionKey, string> = {
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
}

function MiniDocumentPreview({ accentColor }: { accentColor: 'emerald' | 'blue' | 'purple' }) {
  const accentClass =
    accentColor === 'emerald'
      ? 'bg-primary'
      : accentColor === 'blue'
      ? 'bg-[#3B82F6]'
      : 'bg-[#8B5CF6]'

  return (
    <div
      aria-hidden
      className="flex h-[62px] w-[46px] shrink-0 flex-col justify-between rounded-[4px] border border-border bg-surface p-1.5 shadow-2xs select-none"
    >
      {/* Mini Header lines */}
      <div>
        <div className="h-[2.5px] w-5 rounded-full bg-text/80" />
        <div className="mt-1 h-[1.5px] w-3 rounded-full bg-muted" />
      </div>

      {/* Mini Section 1 (Accent) */}
      <div className="space-y-0.5">
        <div className={cn('h-[2px] w-4 rounded-full', accentClass)} />
        <div className="h-[1.5px] w-8 rounded-full bg-border" />
        <div className="h-[1.5px] w-6 rounded-full bg-border" />
      </div>

      {/* Mini Section 2 */}
      <div className="space-y-0.5">
        <div className="h-[2px] w-3.5 rounded-full bg-muted" />
        <div className="h-[1.5px] w-7 rounded-full bg-border" />
      </div>

      {/* Mini Section 3 */}
      <div className="space-y-0.5">
        <div className="h-[1.5px] w-6 rounded-full bg-border" />
      </div>
    </div>
  )
}

/** Choose a basic structure, then write from a blank page. No AI, no profile import. */
export function ManualResumeFlow() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [structureId, setStructureId] = useState(resumeStructures[0].id)
  const [creating, setCreating] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    const structure = resumeStructures.find((s) => s.id === structureId) ?? resumeStructures[0]
    setCreating(true)
    try {
      const doc = await createResumeDocument({
        start: 'blank',
        name: name.trim(),
        targetRole: role.trim(),
        sectionOrder: structure.order,
      })
      navigate(resumePath(doc.id), { replace: true })
    } catch {
      toast.error('Couldn’t create your resume', 'Please try again.')
      setCreating(false)
    }
  }

  return (
    <FlowShell
      editorial
      title="Start from scratch"
      description="Pick a structure and start writing. You stay in control of every word."
      step={{ current: 1, total: 1, label: 'Choose a structure' }}
    >
      <form onSubmit={submit} className="w-full space-y-7">
        {/* Basic Information: Two-column form */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Resume name */}
          <div>
            <label htmlFor="resume-name-input" className="block text-[14px] font-semibold text-text mb-2">
              Resume name
            </label>
            <div className="relative flex h-12 w-full items-center rounded-[8px] border border-border bg-surface shadow-xs transition-all duration-150 hover:border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <FileText className="ml-3.5 h-[18px] w-[18px] shrink-0 text-muted pointer-events-none" />
              <input
                id="resume-name-input"
                type="text"
                placeholder="e.g. Product Designer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-full w-full bg-transparent pl-3 pr-9 text-[15px] text-text placeholder:text-muted focus:outline-none"
              />
              {name && (
                <button
                  type="button"
                  onClick={() => setName('')}
                  className="absolute right-3 inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-neutral-100 hover:text-text transition-colors cursor-pointer"
                  aria-label="Clear resume name"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Target role */}
          <div>
            <label htmlFor="target-role-input" className="block text-[14px] font-semibold text-text mb-2">
              Target role
            </label>
            <div className="relative flex h-12 w-full items-center rounded-[8px] border border-border bg-surface shadow-xs transition-all duration-150 hover:border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <Briefcase className="ml-3.5 h-[18px] w-[18px] shrink-0 text-muted pointer-events-none" />
              <input
                id="target-role-input"
                type="text"
                placeholder="e.g. Product Designer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-full w-full bg-transparent pl-3 pr-9 text-[15px] text-text placeholder:text-muted focus:outline-none"
              />
              {role && (
                <button
                  type="button"
                  onClick={() => setRole('')}
                  className="absolute right-3 inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-neutral-100 hover:text-text transition-colors cursor-pointer"
                  aria-label="Clear target role"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-secondary">Optional. Helps with keyword scoring.</p>
          </div>
        </div>

        {/* Resume structure section */}
        <div>
          <h2 className="text-[14px] font-semibold text-text mb-3">Resume structure</h2>
          <div className="space-y-3">
            {resumeStructures.map((structure) => {
              const selected = structure.id === structureId
              const isRecommended = structure.id === 'education-first'
              const accentColor =
                structure.id === 'education-first'
                  ? 'emerald'
                  : structure.id === 'experience-first'
                  ? 'blue'
                  : 'purple'

              return (
                <label
                  key={structure.id}
                  className={cn(
                    'group relative flex cursor-pointer items-center gap-4 sm:gap-5 rounded-[12px] border p-4 sm:p-5 transition-all duration-150 select-none',
                    selected
                      ? 'border-primary bg-primary/[0.025] shadow-xs'
                      : 'border-border bg-surface hover:border-primary/40 hover:bg-primary/[0.01]'
                  )}
                >
                  {/* Hidden radio input */}
                  <input
                    type="radio"
                    name="structure"
                    value={structure.id}
                    checked={selected}
                    onChange={() => setStructureId(structure.id)}
                    className="sr-only"
                  />

                  {/* Custom Radio Button Indicator */}
                  {selected ? (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xs">
                      <Check className="size-3 text-white stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="size-5 shrink-0 rounded-full border border-border bg-surface transition-colors group-hover:border-primary" />
                  )}

                  {/* Miniature Resume Preview Document */}
                  <MiniDocumentPreview accentColor={accentColor} />

                  {/* Card Content */}
                  <div className="min-w-0 flex-1">
                    {/* Title + Optional Badge */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-text">{structure.label}</h3>
                      {isRecommended && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Recommended
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="mt-1 text-[13px] text-secondary">{structure.description}</p>

                    {/* Structure Flow Pills */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Section order">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors',
                          selected ? 'bg-primary/12 text-primary-deep' : 'bg-background text-secondary'
                        )}
                      >
                        Summary
                      </span>
                      {structure.order.map((key) => (
                        <span key={key} className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted">→</span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors',
                              selected ? 'bg-primary/12 text-primary-deep' : 'bg-background text-secondary'
                            )}
                          >
                            {sectionLabels[key]}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-primary px-6 text-[15px] font-medium text-on-primary shadow-xs transition-all duration-150 hover:bg-primary-deep active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin text-white" />
                <span>Opening editor…</span>
              </>
            ) : (
              <>
                <span>Start writing</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </FlowShell>
  )
}

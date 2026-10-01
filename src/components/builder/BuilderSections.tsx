import { Pencil } from 'lucide-react'
import { AiActions } from '@/components/builder/AiActions'
import { BulletsEditor } from '@/components/builder/BulletsEditor'
import { EntryList } from '@/components/builder/EntryList'
import { Input } from '@/components/ui/Input'
import { TagInput } from '@/components/ui/TagInput'
import { Textarea } from '@/components/ui/Textarea'
import type { ResumeUpdater } from '@/hooks/useResumeEditor'
import type { ResumeContact, ResumeContent, ResumeDocument, ResumeHeadingKey, SkillGroupKey } from '@/types/resumeDocument'
import { defaultSkillLabels, jobRoleFor, templateHeading, withHeading, withSkillLabel } from '@/utils/resumeLabels'

interface SectionProps {
  doc: ResumeDocument
  update: ResumeUpdater
}

const span2 = 'sm:col-span-2'

function useContentSetter(update: ResumeUpdater) {
  return (patch: Partial<ResumeContent>) => update((d) => ({ ...d, content: { ...d.content, ...patch } }))
}

const skillsContext = (doc: ResumeDocument) => ({
  role: doc.targetRole || undefined,
  skills: [...doc.content.skills.technical, ...doc.content.skills.tools],
})

/**
 * Inline rename for a printed heading. Empty shows the template's heading as the placeholder,
 * so clearing the field restores it.
 */
export function HeadingInput({ value, fallback, label, onChange }: { value: string; fallback: string; label: string; onChange: (value: string) => void }) {
  return (
    <label className="group flex items-center gap-1.5" title="Rename this heading">
      <Pencil className="size-3 shrink-0 text-muted transition-colors group-hover:text-primary" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        placeholder={fallback}
        maxLength={80}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-text transition-colors placeholder:text-text hover:border-border focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  )
}

/** Heading field shown at the top of each section in the panel. */
export function SectionHeadingField({ doc, update, sectionKey }: SectionProps & { sectionKey: ResumeHeadingKey }) {
  const fallback = templateHeading(doc, sectionKey)
  return (
    <div className="mb-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-secondary">Section heading</span>
      <HeadingInput
        label={`${fallback} section heading`}
        value={doc.content.headings?.[sectionKey] ?? ''}
        fallback={fallback}
        onChange={(value) => update((d) => withHeading(d, sectionKey, value))}
      />
    </div>
  )
}

export function ContactSection({ doc, update }: SectionProps) {
  const { contact } = doc.content
  const set = (patch: Partial<ResumeContact>) => update((d) => ({ ...d, content: { ...d.content, contact: { ...d.content.contact, ...patch } } }))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Full name" hint="The heading at the top of your resume." autoComplete="name" value={contact.name} onChange={(e) => set({ name: e.target.value })} className={span2} />
      <Input
        label="Job role"
        placeholder="e.g. Frontend Developer"
        hint="Shown between your name and contact details."
        value={jobRoleFor(doc)}
        onChange={(e) => set({ role: e.target.value })}
        className={span2}
      />
      <Input
        label="Tagline"
        placeholder="e.g. Building fast, accessible web apps"
        hint="One short line under your job role."
        value={contact.tagline ?? ''}
        onChange={(e) => set({ tagline: e.target.value })}
        className={span2}
      />
      <Input label="Email" type="email" autoComplete="email" value={contact.email} onChange={(e) => set({ email: e.target.value })} />
      <Input label="Phone" type="tel" autoComplete="tel" value={contact.phone} onChange={(e) => set({ phone: e.target.value })} />
      <Input label="Location" value={contact.location} onChange={(e) => set({ location: e.target.value })} className={span2} />
      <Input label="LinkedIn" placeholder="linkedin.com/in/…" value={contact.linkedin} onChange={(e) => set({ linkedin: e.target.value })} />
      <Input label="GitHub" placeholder="github.com/…" value={contact.github} onChange={(e) => set({ github: e.target.value })} />
      <Input label="Portfolio" value={contact.portfolio} onChange={(e) => set({ portfolio: e.target.value })} className={span2} />
    </div>
  )
}

export function SummarySection({ doc, update }: SectionProps) {
  const set = useContentSetter(update)
  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Target role"
        placeholder="e.g. Frontend Developer"
        hint="Used for keyword matching and your resume list."
        value={doc.targetRole}
        onChange={(e) => update((d) => ({ ...d, targetRole: e.target.value }))}
      />
      <div>
        <Textarea label="Professional summary" rows={5} value={doc.content.summary} onChange={(e) => set({ summary: e.target.value })} />
        <div className="mt-1 -ml-3">
          <AiActions allowEmpty text={doc.content.summary} context={{ ...skillsContext(doc), kind: 'summary' }} onResult={(summary) => set({ summary })} />
        </div>
      </div>
    </div>
  )
}

export function ExperienceSection({ doc, update }: SectionProps) {
  const set = useContentSetter(update)
  return (
    <EntryList
      items={doc.content.experience}
      onChange={(experience) => set({ experience })}
      createItem={(id) => ({ id, title: '', company: '', location: '', start: '', end: '', description: '', bullets: [] })}
      addLabel="Add Experience"
      itemLabel="Experience"
      getTitle={(e) => e.title}
      getSubtitle={(e) => [e.company, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
      renderFields={(item, patch) => (
        <>
          <Input label="Job title" value={item.title} onChange={(e) => patch({ title: e.target.value })} />
          <Input label="Company" value={item.company} onChange={(e) => patch({ company: e.target.value })} />
          <Input label="Location" value={item.location} onChange={(e) => patch({ location: e.target.value })} className={span2} />
          <Input label="Start date" placeholder="e.g. Jan 2025" value={item.start} onChange={(e) => patch({ start: e.target.value })} />
          <Input label="End date" placeholder="e.g. Present" value={item.end} onChange={(e) => patch({ end: e.target.value })} />
          <Textarea label="Description" rows={2} value={item.description} onChange={(e) => patch({ description: e.target.value })} className={span2} />
          <div className={span2}>
            <BulletsEditor bullets={item.bullets} onChange={(bullets) => patch({ bullets })} context={skillsContext(doc)} />
          </div>
        </>
      )}
    />
  )
}

export function EducationSection({ doc, update }: SectionProps) {
  const set = useContentSetter(update)
  return (
    <EntryList
      items={doc.content.education}
      onChange={(education) => set({ education })}
      createItem={(id) => ({ id, degree: '', institution: '', location: '', dates: '', details: '' })}
      addLabel="Add Education"
      itemLabel="Education"
      getTitle={(e) => e.degree || e.institution}
      getSubtitle={(e) => (e.degree ? e.institution : '')}
      renderFields={(item, patch) => (
        <>
          <Input label="Degree" value={item.degree} onChange={(e) => patch({ degree: e.target.value })} />
          <Input label="Institution" value={item.institution} onChange={(e) => patch({ institution: e.target.value })} />
          <Input label="Location" value={item.location} onChange={(e) => patch({ location: e.target.value })} />
          <Input label="Dates" placeholder="e.g. 2021 – 2025" value={item.dates} onChange={(e) => patch({ dates: e.target.value })} />
          <Textarea label="Details" rows={2} hint="CGPA, coursework, honours." value={item.details} onChange={(e) => patch({ details: e.target.value })} className={span2} />
        </>
      )}
    />
  )
}

export function ProjectsSection({ doc, update }: SectionProps) {
  const set = useContentSetter(update)
  return (
    <EntryList
      items={doc.content.projects}
      onChange={(projects) => set({ projects })}
      createItem={(id) => ({ id, name: '', description: '', tech: [], link: '', bullets: [] })}
      addLabel="Add Project"
      itemLabel="Project"
      getTitle={(p) => p.name}
      getSubtitle={(p) => p.tech.slice(0, 3).join(', ')}
      renderFields={(item, patch) => (
        <>
          <Input label="Project name" value={item.name} onChange={(e) => patch({ name: e.target.value })} />
          <Input label="Project link" value={item.link} onChange={(e) => patch({ link: e.target.value })} />
          <Textarea label="Description" rows={2} value={item.description} onChange={(e) => patch({ description: e.target.value })} className={span2} />
          <TagInput label="Tech stack" placeholder="e.g. React" value={item.tech} onChange={(tech) => patch({ tech })} className={span2} />
          <div className={span2}>
            <BulletsEditor bullets={item.bullets} onChange={(bullets) => patch({ bullets })} context={skillsContext(doc)} />
          </div>
        </>
      )}
    />
  )
}

export function SkillsSection({ doc, update }: SectionProps) {
  const { skills } = doc.content
  const set = (patch: Partial<typeof skills>) => update((d) => ({ ...d, content: { ...d.content, skills: { ...d.content.skills, ...patch } } }))
  const groups: Array<{ key: SkillGroupKey; placeholder: string }> = [
    { key: 'technical', placeholder: 'e.g. React, SQL' },
    { key: 'tools', placeholder: 'e.g. Git, Figma' },
    { key: 'other', placeholder: 'e.g. Communication' },
  ]
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ key, placeholder }) => {
        const custom = doc.content.skillLabels?.[key] ?? ''
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <HeadingInput
              label={`${defaultSkillLabels[key]} group heading`}
              value={custom}
              fallback={defaultSkillLabels[key]}
              onChange={(value) => update((d) => withSkillLabel(d, key, value))}
            />
            <TagInput
              ariaLabel={custom.trim() || defaultSkillLabels[key]}
              placeholder={placeholder}
              value={skills[key]}
              onChange={(list) => set({ ...skills, [key]: list })}
            />
          </div>
        )
      })}
    </div>
  )
}

export function CertificationsSection({ doc, update }: SectionProps) {
  const set = useContentSetter(update)
  return (
    <EntryList
      items={doc.content.certifications}
      onChange={(certifications) => set({ certifications })}
      createItem={(id) => ({ id, name: '', issuer: '', date: '', link: '' })}
      addLabel="Add Certification"
      itemLabel="Certification"
      getTitle={(c) => c.name}
      getSubtitle={(c) => [c.issuer, c.date].filter(Boolean).join(' · ')}
      renderFields={(item, patch) => (
        <>
          <Input label="Certification" value={item.name} onChange={(e) => patch({ name: e.target.value })} className={span2} />
          <Input label="Issuer" value={item.issuer} onChange={(e) => patch({ issuer: e.target.value })} />
          <Input label="Date" value={item.date} onChange={(e) => patch({ date: e.target.value })} />
          <Input label="Credential link" value={item.link} onChange={(e) => patch({ link: e.target.value })} className={span2} />
        </>
      )}
    />
  )
}

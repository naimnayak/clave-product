import { Award, Briefcase, FolderGit2, GraduationCap, Layers, Sparkles, User } from 'lucide-react'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CertificationsSection,
  ContactSection,
  EducationSection,
  ExperienceSection,
  ProjectsSection,
  SectionHeadingField,
  SkillsSection,
  SummarySection,
} from '@/components/builder/BuilderSections'
import { ResumeSectionEditor } from '@/components/builder/ResumeSectionEditor'
import type { SectionStatus } from '@/components/builder/ResumeSectionEditor'
import type { ResumeUpdater } from '@/hooks/useResumeEditor'
import type { ResumeDocument, ResumeSectionKey } from '@/types/resumeDocument'
import { headingFor } from '@/utils/resumeLabels'

interface SectionMeta {
  icon: LucideIcon
  Component: React.ComponentType<{ doc: ResumeDocument; update: ResumeUpdater }>
}

const bodySections: Record<ResumeSectionKey, SectionMeta> = {
  experience: { icon: Briefcase, Component: ExperienceSection },
  education: { icon: GraduationCap, Component: EducationSection },
  projects: { icon: FolderGit2, Component: ProjectsSection },
  skills: { icon: Layers, Component: SkillsSection },
  certifications: { icon: Award, Component: CertificationsSection },
} as const

// ─── Hint text ────────────────────────────────────────────────────────────────

const pluralise = (n: number, one: string, many: string) =>
  n === 0 ? 'Empty' : `${n} ${n === 1 ? one : many}`

function hintFor(key: string, doc: ResumeDocument): string {
  const { content } = doc
  switch (key) {
    case 'contact':
      return [content.contact.name, content.contact.email].filter(Boolean).join(' · ') || 'Empty'
    case 'summary':
      return content.summary ? `${content.summary.slice(0, 52)}…` : 'Empty'
    case 'experience':
      return pluralise(content.experience.length, 'entry', 'entries')
    case 'education':
      return pluralise(content.education.length, 'entry', 'entries')
    case 'projects':
      return pluralise(content.projects.length, 'project', 'projects')
    case 'skills': {
      const total =
        content.skills.technical.length +
        content.skills.tools.length +
        content.skills.other.length
      return pluralise(total, 'skill', 'skills')
    }
    default:
      return pluralise(content.certifications.length, 'certification', 'certifications')
  }
}

// ─── Section completion status ────────────────────────────────────────────────

function statusFor(key: string, doc: ResumeDocument): SectionStatus {
  const { content } = doc
  switch (key) {
    case 'contact': {
      const { name, email, phone } = content.contact
      const filled = [name, email, phone].filter(Boolean).length
      if (filled >= 2) return 'complete'
      if (filled >= 1) return 'partial'
      return 'empty'
    }
    case 'summary':
      if (!content.summary.trim()) return 'empty'
      return content.summary.trim().length >= 80 ? 'complete' : 'partial'
    case 'experience':
      if (content.experience.length === 0) return 'empty'
      return content.experience.some((e) => e.title && e.company) ? 'complete' : 'partial'
    case 'education':
      if (content.education.length === 0) return 'empty'
      return content.education.some((e) => e.degree || e.institution) ? 'complete' : 'partial'
    case 'projects':
      if (content.projects.length === 0) return 'empty'
      return content.projects.some((p) => p.name && p.description) ? 'complete' : 'partial'
    case 'skills': {
      const total =
        content.skills.technical.length +
        content.skills.tools.length +
        content.skills.other.length
      if (total === 0) return 'empty'
      return total >= 3 ? 'complete' : 'partial'
    }
    case 'certifications':
      if (content.certifications.length === 0) return 'empty'
      return content.certifications.some((c) => c.name) ? 'complete' : 'partial'
    default:
      return 'empty'
  }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/** One section open at a time keeps the editor compact. */
export function EditorPanel({ doc, update }: { doc: ResumeDocument; update: ResumeUpdater }) {
  const [openKey, setOpenKey] = useState<string | null>('summary')
  const toggle = (key: string) => setOpenKey((current) => (current === key ? null : key))

  const move = (key: ResumeSectionKey, delta: -1 | 1) =>
    update((d) => {
      const order = [...d.sectionOrder]
      const index = order.indexOf(key)
      ;[order[index], order[index + delta]] = [order[index + delta], order[index]]
      return { ...d, sectionOrder: order }
    })

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="border-b border-border bg-background/50 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70 select-none">
          Sections
        </p>
      </div>

      <ResumeSectionEditor
        title="Header & Contact"
        icon={User}
        status={statusFor('contact', doc)}
        open={openKey === 'contact'}
        hint={hintFor('contact', doc)}
        onToggle={() => toggle('contact')}
      >
        <ContactSection doc={doc} update={update} />
      </ResumeSectionEditor>

      <ResumeSectionEditor
        title={headingFor(doc, 'summary')}
        icon={Sparkles}
        status={statusFor('summary', doc)}
        open={openKey === 'summary'}
        hint={hintFor('summary', doc)}
        onToggle={() => toggle('summary')}
      >
        <SectionHeadingField doc={doc} update={update} sectionKey="summary" />
        <SummarySection doc={doc} update={update} />
      </ResumeSectionEditor>

      {doc.sectionOrder.map((key, index) => {
        const { icon, Component } = bodySections[key]
        const title = headingFor(doc, key)
        return (
          <ResumeSectionEditor
            key={key}
            title={title}
            icon={icon}
            status={statusFor(key, doc)}
            open={openKey === key}
            hint={hintFor(key, doc)}
            onToggle={() => toggle(key)}
            reorder={{
              canMoveUp: index > 0,
              canMoveDown: index < doc.sectionOrder.length - 1,
              onMoveUp: () => move(key, -1),
              onMoveDown: () => move(key, 1),
            }}
          >
            <SectionHeadingField doc={doc} update={update} sectionKey={key} />
            <Component doc={doc} update={update} />
          </ResumeSectionEditor>
        )
      })}

      <div className="h-8" />
    </div>
  )
}

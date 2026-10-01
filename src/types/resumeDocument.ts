export type TemplateId = 'classic' | 'modern' | 'compact' | 'minimal' | 'student' | 'designer' | 'engineer' | 'business' | 'academic' | 'executive'
export type ResumeSectionKey = 'experience' | 'education' | 'projects' | 'skills' | 'certifications'
/** Every section with a printed heading: the body sections plus the summary. */
export type ResumeHeadingKey = ResumeSectionKey | 'summary'
export type SkillGroupKey = 'technical' | 'tools' | 'other'

export interface ResumeContact {
  name: string
  /** Job role shown between the name and the contact line. Unset (null) falls back to the target role on templates that show one; '' hides it. */
  role?: string | null
  /** Short one-line pitch under the job role. */
  tagline?: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  portfolio: string
}

export interface ResumeExperience {
  id: string
  title: string
  company: string
  location: string
  start: string
  end: string
  description: string
  bullets: string[]
}

export interface ResumeEducation {
  id: string
  degree: string
  institution: string
  location: string
  dates: string
  details: string
}

export interface ResumeProject {
  id: string
  name: string
  description: string
  tech: string[]
  link: string
  bullets: string[]
}

export interface ResumeSkills {
  technical: string[]
  tools: string[]
  other: string[]
}

export interface ResumeCertification {
  id: string
  name: string
  issuer: string
  date: string
  link: string
}

export interface ResumeContent {
  contact: ResumeContact
  summary: string
  experience: ResumeExperience[]
  education: ResumeEducation[]
  projects: ResumeProject[]
  skills: ResumeSkills
  certifications: ResumeCertification[]
  /** Custom section headings; missing or blank entries use the template's heading. */
  headings?: Partial<Record<ResumeHeadingKey, string>>
  /** Custom skill group headings, e.g. "Technical Skills" → "Languages". */
  skillLabels?: Partial<Record<SkillGroupKey, string>>
}

export interface ResumeDocument {
  id: string
  name: string
  targetRole: string
  template: TemplateId
  /** Order of the body sections below the summary. */
  sectionOrder: ResumeSectionKey[]
  content: ResumeContent
  updatedAt: string
}

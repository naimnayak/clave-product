import type { ResumeDocument, ResumeHeadingKey, SkillGroupKey } from '@/types/resumeDocument'
import { templates } from '@/utils/resumeTemplates'

/** Headings used when neither the user nor the template renames a section. */
export const defaultHeadings: Record<ResumeHeadingKey, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
}

export const defaultSkillLabels: Record<SkillGroupKey, string> = {
  technical: 'Technical Skills',
  tools: 'Tools',
  other: 'Other Relevant Skills',
}

export const skillGroupKeys: SkillGroupKey[] = ['technical', 'tools', 'other']

const custom = (value: string | undefined) => (value?.trim() ? value : undefined)

/** The template's heading for a section, ignoring any custom heading. */
export const templateHeading = (doc: ResumeDocument, key: ResumeHeadingKey) => templates[doc.template].labels?.[key] ?? defaultHeadings[key]

/** The printed heading: the user's custom heading, else the template's, else the default. */
export const headingFor = (doc: ResumeDocument, key: ResumeHeadingKey) => custom(doc.content.headings?.[key]) ?? templateHeading(doc, key)

export const skillLabelFor = (doc: ResumeDocument, key: SkillGroupKey) => custom(doc.content.skillLabels?.[key]) ?? defaultSkillLabels[key]

/** Job role under the name. An explicit value (even '') wins; otherwise role-showing templates use the target role. */
export const jobRoleFor = (doc: ResumeDocument) => {
  const role = doc.content.contact.role
  if (role !== undefined && role !== null) return role
  return templates[doc.template].role ? doc.targetRole : ''
}

/**
 * Stores a custom heading as typed (trimming mid-typing would eat the space between words).
 * An empty value removes the override so the template heading comes back.
 */
export const withHeading = (doc: ResumeDocument, key: ResumeHeadingKey, value: string): ResumeDocument => {
  const headings = { ...doc.content.headings }
  if (value) headings[key] = value
  else delete headings[key]
  return { ...doc, content: { ...doc.content, headings } }
}

export const withSkillLabel = (doc: ResumeDocument, key: SkillGroupKey, value: string): ResumeDocument => {
  const skillLabels = { ...doc.content.skillLabels }
  if (value) skillLabels[key] = value
  else delete skillLabels[key]
  return { ...doc, content: { ...doc.content, skillLabels } }
}

/** Every printed label resolved for this document: used by the DOCX export so it matches the preview. */
export const resolvedLabels = (doc: ResumeDocument) => ({
  headings: Object.fromEntries((Object.keys(defaultHeadings) as ResumeHeadingKey[]).map((key) => [key, headingFor(doc, key).trim()])) as Record<ResumeHeadingKey, string>,
  skillLabels: Object.fromEntries(skillGroupKeys.map((key) => [key, skillLabelFor(doc, key).trim()])) as Record<SkillGroupKey, string>,
  role: jobRoleFor(doc).trim(),
})

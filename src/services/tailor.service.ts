import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'
import type { ResumeDocument } from '@/types/resumeDocument'

/** A change the backend suggests, as data. The UI applies the ones the user keeps. */
export type TailorPatch =
  | { op: 'setTargetRole'; value: string }
  | { op: 'setSummary'; value: string }
  | { op: 'addSkills'; category: 'technical' | 'tools' | 'other'; values: string[] }
  | { op: 'moveProjectToTop'; projectId: string }
  | { op: 'replaceBullet'; experienceId: string; index: number; value: string }

export interface TailorChange {
  id: string
  title: string
  description: string
  patch: TailorPatch
  apply: (doc: ResumeDocument) => ResumeDocument
}

export interface TailorAnalysis {
  jobTitle: string
  company: string
  keywords: { matched: string[]; missing: string[]; all: string[] }
  changes: TailorChange[]
}

export interface JobInput {
  title: string
  company: string
  description: string
}

export interface AnalyzeJobDescriptionRequest {
  resumeId: string
  jobTitle: string
  company: string
  jobDescription: string
}

/** Small client-side vocabulary for the instant keyword preview under the JD box (no network). */
const VOCAB = [
  'figma', 'user research', 'wireframing', 'prototyping', 'design system', 'usability testing', 'accessibility',
  'information architecture', 'a/b testing', 'stakeholder', 'analytics', 'metrics', 'agile', 'journey mapping',
  'interaction design', 'visual design', 'design thinking', 'user flows', 'react', 'typescript', 'sql', 'jira',
]

export const extractKeywords = (text: string): string[] => {
  const lower = text.toLowerCase()
  return VOCAB.filter((keyword) => lower.includes(keyword))
}

export function docCorpus(doc: ResumeDocument): string {
  const { content } = doc
  return [
    doc.targetRole,
    content.summary,
    ...content.skills.technical,
    ...content.skills.tools,
    ...content.skills.other,
    ...content.experience.flatMap((e) => [e.title, e.description, ...e.bullets]),
    ...content.projects.flatMap((p) => [p.name, p.description, ...p.tech, ...p.bullets]),
  ]
    .join(' ')
    .toLowerCase()
}

/** Percentage of the job's keywords the resume covers. */
export function jobMatch(doc: ResumeDocument, keywords: string[]): number {
  if (keywords.length === 0) return 0
  const corpus = docCorpus(doc)
  return Math.round((keywords.filter((k) => corpus.includes(k.toLowerCase())).length / keywords.length) * 100)
}

/** Client twin of the backend's apply_patch (backend/app/services/resume_logic.py). */
function applyPatch(doc: ResumeDocument, patch: TailorPatch): ResumeDocument {
  const { content } = doc
  switch (patch.op) {
    case 'setTargetRole':
      return { ...doc, targetRole: patch.value }
    case 'setSummary':
      return { ...doc, content: { ...content, summary: patch.value } }
    case 'addSkills': {
      const existing = new Set([...content.skills.technical, ...content.skills.tools, ...content.skills.other].map((s) => s.toLowerCase()))
      const added = patch.values.filter((s) => !existing.has(s.toLowerCase()))
      return { ...doc, content: { ...content, skills: { ...content.skills, [patch.category]: [...content.skills[patch.category], ...added] } } }
    }
    case 'moveProjectToTop': {
      const index = content.projects.findIndex((p) => p.id === patch.projectId)
      if (index <= 0) return doc
      const projects = [...content.projects]
      const [picked] = projects.splice(index, 1)
      return { ...doc, content: { ...content, projects: [picked, ...projects] } }
    }
    case 'replaceBullet':
      return {
        ...doc,
        content: {
          ...content,
          experience: content.experience.map((e) =>
            e.id === patch.experienceId ? { ...e, bullets: e.bullets.map((b, i) => (i === patch.index ? patch.value : b)) } : e,
          ),
        },
      }
  }
}

type ApiTailorAnalysis = Omit<TailorAnalysis, 'changes'> & { changes: Omit<TailorChange, 'apply'>[] }

/** POST /api/resumes/:id/tailor/analyze — the AI model suggests changes; nothing is saved and the original stays untouched. */
export async function analyzeJobDescription(req: AnalyzeJobDescriptionRequest, _doc?: ResumeDocument): Promise<TailorAnalysis> {
  const result = await apiClient.post<ApiTailorAnalysis>(
    `/resumes/${encodeURIComponent(req.resumeId)}/tailor/analyze`,
    { jobTitle: req.jobTitle, company: req.company, jobDescription: req.jobDescription },
    AI_TIMEOUT_MS,
  )
  return { ...result, changes: result.changes.map((change) => ({ ...change, apply: (doc: ResumeDocument) => applyPatch(doc, change.patch) })) }
}

export async function analyzeJob(doc: ResumeDocument, job: JobInput): Promise<TailorAnalysis> {
  return analyzeJobDescription({ resumeId: doc.id, jobTitle: job.title, company: job.company, jobDescription: job.description }, doc)
}

export function applyChanges(doc: ResumeDocument, analysis: TailorAnalysis, selectedIds: Set<string>): ResumeDocument {
  return analysis.changes.filter((c) => selectedIds.has(c.id)).reduce((current, change) => change.apply(current), doc)
}

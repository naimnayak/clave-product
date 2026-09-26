import { getProfile } from '@/services/profile.service'
import { readSettings } from '@/services/settings.service'
import { apiClient, orNull } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import type { ResumeType } from '@/types/resume'
import type { ResumeDocument, ResumeSectionKey, TemplateId } from '@/types/resumeDocument'
import { buildContentFromProfile, defaultSectionOrder, emptyResumeContent } from '@/utils/resumeFromProfile'

/** Resume documents (GET/PUT/POST /api/resumes). The backend also recomputes each resume's ATS score on save. */

type SourceType = 'manual' | 'template' | 'ai' | 'upload' | 'tailored' | 'duplicate'

const path = (id: string) => `/resumes/${encodeURIComponent(id)}`
const documentFields = (doc: ResumeDocument) => ({
  name: doc.name,
  targetRole: doc.targetRole,
  template: doc.template,
  sectionOrder: doc.sectionOrder,
  content: doc.content,
})

async function buildDocument(name: string, targetRole: string, start: 'profile' | 'blank'): Promise<Omit<ResumeDocument, 'id'>> {
  const user = useAuthStore.getState().user
  const profile = start === 'profile' ? await getProfile() : null
  return {
    name,
    targetRole,
    template: 'classic',
    sectionOrder: defaultSectionOrder(profile),
    content: profile ? buildContentFromProfile(profile, user?.name, user?.email) : emptyResumeContent(user?.name, user?.email),
    updatedAt: new Date().toISOString(),
  }
}

/** Persists builder edits. The `touch` option is kept for callers; the server always stamps updatedAt. */
export async function saveResumeDocument(doc: ResumeDocument, _options: { touch?: boolean } = { touch: true }): Promise<void> {
  await apiClient.put(path(doc.id), documentFields(doc))
}

export async function getResumeDocument(id: string): Promise<ResumeDocument | null> {
  return orNull(apiClient.get<ResumeDocument>(path(id)))
}

/** For library thumbnails and the preview dialog. */
export async function getResumePreview(id: string): Promise<ResumeDocument | null> {
  return getResumeDocument(id)
}

export interface CreateOptions {
  start: 'profile' | 'blank'
  name?: string
  targetRole?: string
  template?: TemplateId
  sectionOrder?: ResumeSectionKey[]
}

/** Creates and saves a new resume for the manual and template flows. */
export async function createResumeDocument(options: CreateOptions): Promise<ResumeDocument> {
  const role = options.targetRole ?? (options.start === 'profile' ? ((await getProfile())?.targetRoles[0] ?? '') : '')
  const doc = await buildDocument('Untitled Resume', role, options.start)
  return apiClient.post<ResumeDocument>('/resumes', {
    ...doc,
    name: options.name?.trim() || (role ? `${role} Resume` : 'Untitled Resume'),
    template: options.template ?? readSettings().defaultTemplate,
    sectionOrder: options.sectionOrder ?? doc.sectionOrder,
    type: 'base',
    sourceType: options.template ? 'template' : 'manual',
  })
}

/** Saves an already-prepared document (AI draft, upload or tailored copy) as a new resume. */
export async function createResumeFromDocument(
  doc: ResumeDocument,
  extras: { type: ResumeType; tailoredFor?: string; name?: string; sourceType?: SourceType; sourceFileId?: string },
): Promise<ResumeDocument> {
  // A tailored copy keeps the source resume's id until it is saved, which links it to the original.
  const fromExisting = extras.type === 'tailored' && !doc.id.startsWith('draft_')
  return apiClient.post<ResumeDocument>('/resumes', {
    ...documentFields(doc),
    name: extras.name ?? doc.name,
    type: extras.type,
    tailoredFor: extras.tailoredFor,
    sourceType: extras.sourceType ?? (extras.type === 'tailored' ? 'tailored' : doc.id.startsWith('draft_') ? 'ai' : 'manual'),
    sourceResumeId: fromExisting ? doc.id : undefined,
    // Saving your own uploaded resume doesn't use a plan credit; the server checks the upload is yours.
    sourceFileId: extras.sourceFileId,
  })
}

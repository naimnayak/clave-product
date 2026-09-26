import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'
import type { ProfileData } from '@/types/profile'

/**
 * Onboarding import. Resume import uploads the file and asks the backend to parse it into a Career
 * Profile draft for review (nothing is saved until the user confirms on the review step).
 */
export const RESUME_MAX_BYTES = 5 * 1024 * 1024
export const RESUME_ACCEPT = '.pdf,.docx'

export function validateResumeFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'pdf' && extension !== 'docx') return 'Please upload a PDF or DOCX file.'
  if (file.size === 0) return 'This file looks empty. Try a different one.'
  if (file.size > RESUME_MAX_BYTES) return 'This file is larger than 5 MB. Try a smaller one.'
  return null
}

export function isValidLinkedInUrl(value: string): boolean {
  return /^(https?:\/\/)?([\w-]+\.)?linkedin\.com\/in\/[\w%-]+\/?/i.test(value.trim())
}

export async function extractResume(
  file: File,
  identity: { name: string; email: string },
  onStage: (stage: string) => void,
): Promise<ProfileData> {
  onStage('Reading your resume…')
  const upload = await apiClient.upload<{ fileId: string }>('/files/upload', file)
  onStage('Extracting your career information…')
  const profile = await apiClient.post<ProfileData>(`/files/${encodeURIComponent(upload.fileId)}/parse-profile`, {}, AI_TIMEOUT_MS)
  return { ...profile, name: profile.name || identity.name, email: profile.email || identity.email }
}

/**
 * LinkedIn import from the profile PDF LinkedIn generates (Profile → More → Save to PDF). Reading
 * profile URLs directly isn't allowed by LinkedIn, so the export is the reliable, permitted path.
 * The profile link, when given, is added to the profile's links.
 */
export async function importLinkedIn(
  file: File,
  profileUrl: string,
  identity: { name: string; email: string },
  onStage: (stage: string) => void,
): Promise<ProfileData> {
  const profile = await extractResume(file, identity, onStage)
  const url = profileUrl.trim()
  if (url && isValidLinkedInUrl(url) && !profile.links.some((link) => /linkedin\.com/i.test(link.url))) {
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    profile.links = [...profile.links, { id: crypto.randomUUID(), label: 'LinkedIn', url: href }]
  }
  return profile
}

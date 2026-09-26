import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'
import type { JobAnalysisResponse } from '@/services/jobAnalysis.service'
import type { ProfileData } from '@/types/profile'
import type { ResumeDocument } from '@/types/resumeDocument'

export interface GenerationInput {
  role: string
  industry: string
  jobDescription: string
  /** Bumped by Regenerate so the wording differs from the last attempt. */
  attempt: number
  /** Output of the analyze-job step, when the user went through it. */
  jobAnalysis?: JobAnalysisResponse
}

export interface GeneratedResume {
  doc: ResumeDocument
  /** ATS-focused keywords the resume covers. */
  keywords: string[]
  usedJobDescription: boolean
}

/**
 * Request shape for POST /api/resumes/generate. The backend builds the resume from the saved Career
 * Profile with the AI model and returns an unsaved draft; "Open in Resume Editor" saves it via POST /api/resumes.
 */
export interface GenerateResumeRequest {
  targetRole: string
  industry: string
  jobDescription: string
  attempt: number
  jobAnalysis?: JobAnalysisResponse
}

export const generationStages = [
  'Understanding your profile',
  'Selecting relevant experience',
  'Writing your summary',
  'Optimizing for ATS',
  'Structuring your resume',
]

/** How often the visible stage advances while the request runs (the API returns in one response). */
const STAGE_INTERVAL_MS = 1400

/**
 * Missing details worth flagging before generating. None of them block generation.
 */
export function missingProfileInfo(profile: ProfileData): string[] {
  const missing: string[] = []
  if (profile.targetRoles.length === 0) missing.push('a target role')
  if (profile.skills.length === 0) missing.push('skills')
  if (profile.experience.length + profile.projects.length === 0) missing.push('experience or projects')
  if (profile.education.length === 0) missing.push('education')
  if (!profile.summary.trim()) missing.push('a professional summary')
  if (!profile.phone.trim() && !profile.location.trim()) missing.push('a phone number or location')
  return missing
}

/** AI generation from the Career Profile (the profile argument is kept for callers; the server reads the saved one). */
export async function generateResumeFromProfile(
  _profile: ProfileData,
  input: GenerationInput,
  onStage: (stageIndex: number) => void,
): Promise<GeneratedResume> {
  let stage = 0
  onStage(stage)
  const ticker = setInterval(() => {
    stage = Math.min(stage + 1, generationStages.length - 1)
    onStage(stage)
  }, STAGE_INTERVAL_MS)
  try {
    const request: GenerateResumeRequest = {
      targetRole: input.role,
      industry: input.industry,
      jobDescription: input.jobDescription,
      attempt: input.attempt,
      jobAnalysis: input.jobAnalysis,
    }
    const result = await apiClient.post<GeneratedResume>('/resumes/generate', request, AI_TIMEOUT_MS)
    onStage(generationStages.length - 1)
    return result
  } finally {
    clearInterval(ticker)
  }
}

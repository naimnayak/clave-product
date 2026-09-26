import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'

/** POST /api/resumes/:id/analyze: AI review of a saved resume, optionally against a job description. */
export interface AtsReview {
  score: number
  summary: string
  factors: {
    keywordMatch: number
    skillsMatch: number
    experienceMatch: number
    formatting: number
    sectionCompleteness: number
  }
  missingKeywords: string[]
  suggestions: string[]
}

export async function reviewResume(resumeId: string, jobDescription = ''): Promise<AtsReview> {
  return apiClient.post<AtsReview>(`/resumes/${encodeURIComponent(resumeId)}/analyze`, { jobDescription }, AI_TIMEOUT_MS)
}

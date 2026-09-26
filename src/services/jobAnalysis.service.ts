/**
 * jobAnalysis.service.ts
 *
 * Owns the contract for POST /api/resumes/analyze-job (AI on the backend). The backend compares
 * the job with the stored Career Profile; the profile sent here is a fallback for contract parity.
 */

import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'
import type { ProfileData } from '@/types/profile'

// ─── API request shape ────────────────────────────────────────────────────────

export interface JobAnalysisRequest {
  targetRole: string
  jobDescription: string
  /** Full Career Profile object. The backend prefers the saved profile when there is one. */
  careerProfile: ProfileData
}

// ─── API response shape ───────────────────────────────────────────────────────
// This is the single source of truth for the Step 2 UI.

export type InsightType = 'strength' | 'opportunity' | 'gap'

export interface JobInsight {
  /** Machine-readable type — the UI maps this to an icon. */
  type: InsightType
  title: string
  body: string
}

export interface JobAnalysisResponse {
  /** Parsed or inferred job title from the JD. */
  role: string
  /** Company name parsed from the JD. Empty string if not found. */
  company: string
  /** Location parsed from the JD. Empty string if not found. */
  location: string
  /** e.g. "Hybrid", "Remote", "On-site". Empty string if not found. */
  workType: string
  /** e.g. "1–3 years", "0–2 years". Empty string if not found. */
  experience: string
  /**
   * Profile-to-job alignment score (0–100).
   * NOT an ATS score — this measures Career Profile coverage of the JD.
   */
  alignmentScore: number
  /** All key requirements identified in the JD. */
  keyRequirements: string[]
  /** Subset of keyRequirements already present in the Career Profile. */
  matchedSkills: string[]
  /** Constructive gaps — requirements not well-covered by the profile. */
  gaps: string[]
  /** High-level observations about the profile ↔ job match. */
  insights: JobInsight[]
}

/** Analyzes a job description against the Career Profile. */
export async function analyzeJobDescription(request: JobAnalysisRequest): Promise<JobAnalysisResponse> {
  return apiClient.post<JobAnalysisResponse>('/resumes/analyze-job', request, AI_TIMEOUT_MS)
}

import { apiClient, orNull } from '@/services/apiClient'
import type { CompanyInfo, Job, JobDetail, JobFeedStatus, JobsPreview } from '@/types/job'

/** Plain-text job description from a catalog listing, used to prefill the Tailor flow. */
export function jobToDescription(job: Job, detail: JobDetail): string {
  const list = (heading: string, items: string[]) => (items.length ? `${heading}:\n${items.map((item) => `- ${item}`).join('\n')}` : '')
  return [
    `${job.title} at ${job.company} (${job.location}${job.experience ? `, ${job.experience}` : ''}).`,
    detail.about,
    list('Responsibilities', detail.responsibilities),
    list('Requirements', detail.requirements),
    list('Nice to have', detail.niceToHave),
    job.skills.length ? `Skills: ${job.skills.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Jobs catalog (GET /api/jobs, Clave Pro). matchPercent and `recommended` are computed per user on the
 * backend from their latest resume, saved job descriptions and Career Profile. Free users get 402
 * PRO_REQUIRED here and use getJobsPreview() instead.
 */
export async function getJobs(): Promise<Job[]> {
  return apiClient.get<Job[]>('/jobs?limit=100')
}

/** Top matches for any plan; Free users get them with the company and apply link hidden. */
export async function getJobsPreview(): Promise<JobsPreview> {
  return apiClient.get<JobsPreview>('/jobs/preview')
}

export async function getJobFeedStatus(): Promise<JobFeedStatus> {
  return apiClient.get<JobFeedStatus>('/jobs/feed')
}

export async function getRecommendedJobs(limit = 3): Promise<Job[]> {
  return apiClient.get<Job[]>(`/jobs/recommended?limit=${limit}`)
}

export async function getJobById(id: string): Promise<{ job: Job; detail: JobDetail } | null> {
  return orNull(apiClient.get<{ job: Job; detail: JobDetail }>(`/jobs/${encodeURIComponent(id)}`))
}

/** Long-form details for every listing, keyed by job id. */
export async function getJobDetails(): Promise<Record<string, JobDetail>> {
  return apiClient.get<Record<string, JobDetail>>('/jobs/details')
}

/** Company profiles keyed by company name. */
export async function getCompanies(): Promise<Record<string, CompanyInfo>> {
  return apiClient.get<Record<string, CompanyInfo>>('/companies')
}

/** jobId -> ISO date saved */
export async function getSavedJobs(): Promise<Record<string, string>> {
  return apiClient.get<Record<string, string>>('/jobs/saved')
}

export async function saveJob(id: string): Promise<void> {
  await apiClient.post(`/jobs/${encodeURIComponent(id)}/save`)
}

export async function unsaveJob(id: string): Promise<void> {
  await apiClient.delete(`/jobs/${encodeURIComponent(id)}/save`)
}

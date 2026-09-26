import type { Job, WorkType } from '@/types/job'

export interface JobFilterValues {
  role: string
  location: string
  experience: string
  workType: string
  posted: string
  minMatch: string
}

export const ALL = 'all'

export const defaultFilters: JobFilterValues = { role: ALL, location: '', experience: ALL, workType: ALL, posted: ALL, minMatch: ALL }

/** Role families present in the current listings, alphabetical ("Other" last). */
export const roleOptionsFor = (jobs: Job[]): string[] =>
  [...new Set(jobs.map((job) => job.roleType).filter(Boolean))].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
export const experienceOptions: Array<[string, string]> = [
  ['internship', 'Internship'],
  ['entry', 'Entry level (0–2 yrs)'],
  ['junior', 'Junior (1–3 yrs)'],
  ['mid', 'Mid-level (3+ yrs)'],
]
export const workTypeLabels: Record<WorkType, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' }
export const postedOptions: Array<[string, string]> = [['1', 'Past 24 hours'], ['7', 'Past week'], ['30', 'Past month']]
export const minMatchOptions: Array<[string, string]> = [['70', '70% and up'], ['80', '80% and up'], ['90', '90% and up']]

function matchesLocation(job: Job, text: string): boolean {
  const needle = text.trim().toLowerCase()
  if (!needle) return true
  return job.city.toLowerCase().includes(needle) || job.location.toLowerCase().includes(needle) || (needle === 'remote' && job.workType === 'remote')
}

export function applyJobFilters(jobs: Job[], query: string, f: JobFilterValues): Job[] {
  const needle = query.trim().toLowerCase()
  return jobs.filter(
    (job) =>
      (!needle || [job.title, job.company, job.city, job.roleType, ...job.skills].some((text) => text.toLowerCase().includes(needle))) &&
      (f.role === ALL || job.roleType === f.role) &&
      matchesLocation(job, f.location) &&
      (f.experience === ALL || job.level === f.experience) &&
      (f.workType === ALL || job.workType === f.workType) &&
      (f.posted === ALL || job.postedDaysAgo <= Number(f.posted)) &&
      (f.minMatch === ALL || job.matchPercent >= Number(f.minMatch)),
  )
}

export const countActiveFilters = (f: JobFilterValues) =>
  Object.entries(f).filter(([key, value]) => (key === 'location' ? value.trim() !== '' : value !== ALL)).length

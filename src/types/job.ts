export type WorkType = 'remote' | 'hybrid' | 'onsite'
export type JobLevel = 'internship' | 'entry' | 'junior' | 'mid'

export interface Job {
  id: string
  title: string
  company: string
  location: string
  experience: string
  matchPercent: number
  skills: string[]
  city: string
  workType: WorkType
  level: JobLevel
  roleType: string
  postedDaysAgo: number
  /** Shown when the listing includes it. */
  salary?: string
  /** Set by the API for the best matches ("Recommended for You"). */
  recommended?: boolean
  /** Company application link, when the listing has one. */
  applyUrl?: string
}

/** The long-form part of a listing, loaded only on the detail page. */
export interface JobDetail {
  jobType: string
  about: string
  responsibilities: string[]
  requirements: string[]
  niceToHave: string[]
  /** A skill worth building for this role, used when the profile already covers the listed skills. */
  stretchSkill: string
}

export interface CompanyInfo {
  description: string
  industry: string
  size: string
  location: string
}

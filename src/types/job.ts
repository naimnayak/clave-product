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
  /** Job skills found in the user's resume or Career Profile. */
  matchedSkills?: string[]
  /** Job skills the user doesn't show yet. */
  missingSkills?: string[]
  /** Job board the listing came from (naukri, indeed, linkedin, internshala, foundit). */
  source?: string
  /** Free-plan preview: company and apply link are hidden until the user upgrades. */
  locked?: boolean
}

/** GET /api/jobs/preview: the top matches, shown to Free users with details hidden. */
export interface JobsPreview {
  jobs: Job[]
  totalMatches: number
  totalJobs: number
  isPro: boolean
}

/** GET /api/jobs/feed: the Pro user's personal job feed. */
export interface JobFeedStatus {
  enabled: boolean
  running: boolean
  lastRefreshAt: string | null
  nextRefreshAt: string | null
  scheduledLeft: number
  jdSearchesLeft: number
  queries: string[]
  location: string
  lastError: string | null
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

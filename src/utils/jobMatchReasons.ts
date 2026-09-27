import type { Job, JobDetail } from '@/types/job'
import type { ProfileData } from '@/types/profile'
import { workTypeLabels } from '@/utils/jobFilters'

export interface MatchReasons {
  /** Skills the job asks for that are in the Career Profile. */
  matchingSkills: string[]
  points: string[]
  /** One actionable, factual gap, when there is one. */
  gap: string | null
}

const phrase = (skill: string) => (skill.includes(' ') ? skill.toLowerCase() : skill)

/**
 * Explains a match. The skill overlap comes from the API (resume + Career Profile), falling back to the
 * profile's skills for older responses. The wording is template-based.
 */
export function deriveMatchReasons(job: Job, detail: JobDetail, profile: ProfileData | null): MatchReasons {
  const mine = new Set((profile?.skills ?? []).map((skill) => skill.toLowerCase()))
  const shared = job.matchedSkills ?? job.skills.filter((skill) => mine.has(skill.toLowerCase()))
  const missing = job.missingSkills ?? job.skills.filter((skill) => !mine.has(skill.toLowerCase()))

  const points: string[] = []
  const openers = ['Strong {} experience', 'Relevant {} background', 'Hands-on experience with {}']
  shared.slice(0, 3).forEach((skill, index) => points.push(openers[index].replace('{}', phrase(skill))))

  if (profile) {
    if (profile.preferredLocations.toLowerCase().includes(job.city.toLowerCase())) {
      points.push(`Matches your preferred location (${job.city})`)
    }
    if (profile.workModes.includes(job.workType)) {
      points.push(`Fits your preferred ${workTypeLabels[job.workType].toLowerCase()} work style`)
    }
  }
  if (points.length === 0) points.push('Related to the roles in your resume and job descriptions')

  const gapSkill = missing[0] ? phrase(missing[0]) : detail.stretchSkill
  return {
    matchingSkills: (shared.length >= 3 ? shared : [...shared, ...job.skills.filter((s) => !shared.includes(s))]).slice(0, 4),
    points: points.slice(0, 4),
    gap: gapSkill ? `Consider strengthening your experience with ${gapSkill}.` : null,
  }
}

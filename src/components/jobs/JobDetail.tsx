import { ArrowLeft, Bookmark, BookmarkCheck, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApplyControl } from '@/components/jobs/ApplyControl'
import { CompanyLogo } from '@/components/jobs/CompanyLogo'
import { JobOverview } from '@/components/jobs/JobOverview'
import { JobSkills } from '@/components/jobs/JobSkills'
import { WhyYouMatch } from '@/components/jobs/WhyYouMatch'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { paths, useFromHere } from '@/routes/navigation'
import type { Job, JobDetail as JobDetailData } from '@/types/job'
import { workTypeLabels } from '@/utils/jobFilters'
import type { MatchReasons } from '@/utils/jobMatchReasons'
import { postedLong } from '@/utils/relativeTime'

const tailorPath = (job: Job) => `${paths.tailorResume}?job=${encodeURIComponent(job.id)}`

/** As a plain link inside the page, or as a bordered button in the navbar. */
export function BackToJobs({ variant = 'link' }: { variant?: 'link' | 'button' }) {
  return (
    <Link
      to={paths.jobs}
      className={
        variant === 'button'
          ? 'inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-xs font-semibold text-text shadow-xs transition-colors hover:border-primary/30 hover:bg-tint'
          : 'inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-secondary transition-colors hover:text-text'
      }
    >
      <ArrowLeft className={variant === 'button' ? 'size-3.5' : 'size-4'} aria-hidden />
      Back to Jobs
    </Link>
  )
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-secondary marker:text-primary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

interface JobDetailProps {
  job: Job
  detail: JobDetailData
  reasons: MatchReasons
  saved: boolean
  onToggleSave: () => void
  /** The page owns the h1; the split-view panel sits under the page's h1 so uses h2. */
  headingLevel: 'h1' | 'h2'
  /** Mobile page only: the desktop panel already sits next to the list. */
  showBack?: boolean
}

/** The full job detail, shared by the desktop split panel and the mobile /jobs/:id page. */
export function JobDetail({ job, detail, reasons, saved, onToggleSave, headingLevel: Heading, showBack }: JobDetailProps) {
  const from = useFromHere()
  const place = job.city === 'Remote' ? 'India' : job.city
  const meta = [place, workTypeLabels[job.workType], job.experience, detail.jobType, `Posted ${postedLong(job.postedDaysAgo)}`]

  const saveButton = (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={saved}
      onClick={onToggleSave}
      leadingIcon={saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
    >
      {saved ? 'Saved' : 'Save Job'}
    </Button>
  )

  return (
    <article className="flex flex-col gap-5">
      {showBack && (
        <div>
          <BackToJobs />
        </div>
      )}

      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <CompanyLogo company={job.company} className="size-14 rounded-[14px]" />
            <div className="min-w-0">
              <Heading className="text-xl leading-tight font-semibold tracking-tight text-text">{job.title}</Heading>
              <p className="mt-0.5 text-sm font-medium text-secondary">{job.company}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
                {meta.map((item, index) => (
                  <span key={item} className="flex items-center gap-2">
                    {index > 0 && <span aria-hidden className="size-1 rounded-full bg-border" />}
                    {item}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>

        <JobSkills skills={job.skills} />

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to={tailorPath(job)} state={from} className={buttonStyles({ size: 'sm' })}>
            <Target className="size-4" aria-hidden />
            Tailor Resume
          </Link>
          <ApplyControl job={job} size="sm" />
          {saveButton}
        </div>
      </header>

      <JobOverview job={job} detail={detail} />
      <WhyYouMatch reasons={reasons} />

      <section aria-labelledby={`about-${job.id}`} className="flex flex-col gap-5">
        <div>
          <h3 id={`about-${job.id}`} className="font-editorial text-xl font-medium tracking-tight text-text">
            About the Role
          </h3>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-secondary">{detail.about}</p>
        </div>
        <BulletList title="Responsibilities" items={detail.responsibilities} />
        <BulletList title="Requirements" items={detail.requirements} />
        <BulletList title="Nice to Have" items={detail.niceToHave} />
      </section>
    </article>
  )
}

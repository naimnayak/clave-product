import { Bookmark, BookmarkCheck, Briefcase, MapPin, Target, Wifi } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApplyControl } from '@/components/jobs/ApplyControl'
import { CompanyLogo } from '@/components/jobs/CompanyLogo'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { paths } from '@/routes/navigation'
import type { Job, JobDetail } from '@/types/job'
import { workTypeLabels } from '@/utils/jobFilters'
import { postedLong } from '@/utils/relativeTime'

interface JobHeaderProps {
  job: Job
  detail: JobDetail
  saved: boolean
  onToggleSave: () => void
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-secondary">
      <span className="text-muted [&>svg]:size-4" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  )
}

/** Company, role, key facts, and the main actions. */
export function JobHeader({ job, detail, saved, onToggleSave }: JobHeaderProps) {
  const place = job.city === 'Remote' ? 'India' : job.city

  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-4 sm:gap-5">
        <span className="flex size-[72px] shrink-0 items-center justify-center rounded-large border border-border bg-surface shadow-xs sm:size-24">
          <CompanyLogo company={job.company} className="size-12 rounded-[12px] sm:size-16 sm:rounded-[16px]" />
        </span>
        <div className="min-w-0">
          <h1 className="font-editorial text-3xl leading-tight font-medium tracking-tight text-text sm:text-4xl">{job.title}</h1>
          <p className="mt-1 text-lg text-text">{job.company}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <Meta icon={<MapPin />}>{place}</Meta>
            <Meta icon={<Wifi />}>{workTypeLabels[job.workType]}</Meta>
            <Meta icon={<Briefcase />}>{detail.jobType}</Meta>
            <span className="text-sm text-secondary">Posted {postedLong(job.postedDaysAgo)}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-6 lg:items-end">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 items-center gap-2 rounded-default bg-tint px-4 text-sm font-semibold text-primary-deep ring-1 ring-primary/15">
            {job.matchPercent}% Match
          </span>
          <Button
            variant="secondary"
            aria-pressed={saved}
            onClick={onToggleSave}
            leadingIcon={saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
          >
            {saved ? 'Saved' : 'Save Job'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`${paths.tailorResume}?job=${job.id}`} className={buttonStyles({ size: 'md' })}>
            <Target className="size-4" aria-hidden />
            Tailor Resume
          </Link>
          <ApplyControl job={job} />
        </div>
      </div>
    </header>
  )
}

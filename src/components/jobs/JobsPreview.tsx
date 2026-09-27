import { Briefcase, FileText, Lock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CompanyLogo } from '@/components/jobs/CompanyLogo'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAsyncData } from '@/hooks/useAsyncData'
import { paths } from '@/routes/navigation'
import { getJobsPreview } from '@/services/job.service'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'
import type { Job } from '@/types/job'
import { cn } from '@/utils/cn'
import { workTypeLabels } from '@/utils/jobFilters'

const BOARDS = 'LinkedIn, Indeed, Naukri, Internshala and Foundit'

function LockedRow({ job, onUnlock }: { job: Job; onUnlock: () => void }) {
  return (
    <article className="flex flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-center md:gap-5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span aria-hidden className="blur-[3px]">
          <CompanyLogo company={job.title} className="size-10 rounded-[10px]" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-text">{job.title}</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary-deep">{job.matchPercent}% match</span>
          </div>
          <p className="mt-0.5 text-[13px] text-secondary">
            <span className="select-none blur-[4px]" aria-hidden>Company name</span>
            <span className="sr-only">Company hidden until you upgrade</span> <span aria-hidden>·</span> {job.city === 'Remote' ? 'India' : job.city}{' '}
            <span aria-hidden>·</span> {workTypeLabels[job.workType]}
          </p>
        </div>
      </div>
      <ul className="hidden shrink-0 flex-wrap justify-end gap-1.5 lg:flex" aria-label="Skills you match">
        {(job.matchedSkills?.length ? job.matchedSkills : job.skills).slice(0, 3).map((skill) => (
          <li key={skill}>
            <Badge>{skill}</Badge>
          </li>
        ))}
      </ul>
      <Button variant="tint" size="sm" className="h-7! gap-1.5! px-2.5! text-xs!" leadingIcon={<Lock className="size-3" />} onClick={onUnlock}>
        Unlock
      </Button>
    </article>
  )
}

/**
 * What Free users see instead of the job feed: their real top matches with the company hidden, and an
 * upgrade call to action. `compact` is the dashboard version.
 */
export function JobsPreview({ compact = false }: { compact?: boolean }) {
  const preview = useAsyncData(getJobsPreview)
  const openUpgradeModal = useUpgradeModalStore((s) => s.openUpgradeModal)

  if (preview.status === 'loading') return <LoadingState label="Finding jobs that fit your resume…" />
  if (preview.status === 'error') return <EmptyState title="Couldn’t load job matches" description="Please refresh the page to try again." />

  const { jobs, totalMatches } = preview.data
  const pitch =
    totalMatches > 0
      ? `${totalMatches} job${totalMatches === 1 ? '' : 's'} already match your resume. Clave Pro shows them all, with the company and apply link, and keeps searching ${BOARDS} for you.`
      : `Clave Pro searches ${BOARDS} for jobs that match your resume and the job descriptions you use, and ranks them for you.`

  return (
    <div className={cn('flex flex-col gap-4', !compact && 'mx-auto w-full max-w-4xl')}>
      {!compact && (
        <header className="flex flex-col gap-2">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-deep uppercase shadow-xs">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            Clave Pro
          </p>
          <h1 className="font-editorial text-3xl font-medium tracking-tight text-text sm:text-4xl">Jobs picked for your resume</h1>
          <p className="max-w-2xl text-sm text-secondary">{pitch}</p>
        </header>
      )}

      {jobs.length > 0 ? (
        <Card padding="none" className="divide-y divide-border overflow-hidden rounded-large shadow-none">
          {jobs.map((job) => (
            <LockedRow key={job.id} job={job} onUnlock={openUpgradeModal} />
          ))}
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 rounded-large py-8 text-center shadow-none">
          <span className="flex size-11 items-center justify-center rounded-default icon-tile">
            <FileText className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="max-w-md text-sm text-secondary">
            Add a resume or run an ATS check with a job description, and we’ll match jobs to it.
          </p>
          <Link to={paths.resumes} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
            Go to Resumes
          </Link>
        </Card>
      )}

      <div className={cn('flex flex-col items-start gap-3 rounded-large border border-primary/15 bg-tint p-4 sm:flex-row sm:items-center', compact && 'mt-0')}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-default bg-surface text-primary ring-1 ring-primary/15">
          <Briefcase className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="flex-1 text-sm text-secondary">{compact ? pitch : 'Unlock your personal job feed, unlimited resumes and mock interviews for ₹199 a month.'}</p>
        <Button onClick={openUpgradeModal}>Unlock jobs</Button>
      </div>
    </div>
  )
}

import { SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackToJobs } from '@/components/jobs/JobDetail'
import { JobsPreview } from '@/components/jobs/JobsPreview'
import { ProGate } from '@/components/upgrade/ProGate'
import { JobDescription } from '@/components/jobs/JobDescription'
import { JobDetails } from '@/components/jobs/JobDetails'
import { JobHeader } from '@/components/jobs/JobHeader'
import { MatchSection } from '@/components/jobs/MatchSection'
import { SkillsList } from '@/components/jobs/SkillsList'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { useSavedJobs } from '@/hooks/useSavedJobs'
import { paths } from '@/routes/navigation'
import { getCompanies, getJobById } from '@/services/job.service'
import { getProfile } from '@/services/profile.service'
import type { CompanyInfo, Job, JobDetail } from '@/types/job'
import type { ProfileData } from '@/types/profile'
import { deriveMatchReasons } from '@/utils/jobMatchReasons'

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; job: Job; detail: JobDetail; profile: ProfileData | null; company: CompanyInfo | undefined }

function JobDetailScreen({ jobId }: { jobId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const { isSaved, toggle } = useSavedJobs()

  useEffect(() => {
    let active = true
    Promise.all([getJobById(jobId), getProfile(), getCompanies()]).then(
      ([found, profile, companies]) => {
        if (!active) return
        setState(found ? { status: 'ready', job: found.job, detail: found.detail, profile, company: companies[found.job.company] } : { status: 'missing' })
      },
      () => active && setState({ status: 'missing' }),
    )
    return () => {
      active = false
    }
  }, [jobId])

  if (state.status === 'loading') return <LoadingState label="Opening job…" />

  if (state.status === 'missing') {
    return (
      <EmptyState
        icon={SearchX}
        title="Job not found"
        description="It may have been filled or removed."
        action={
          <Link to={paths.jobs} className={buttonStyles({ variant: 'secondary' })}>
            Back to Jobs
          </Link>
        }
        className="py-24"
      />
    )
  }

  const { job, detail, profile, company } = state
  const reasons = deriveMatchReasons(job, detail, profile)

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="md:hidden">
        <BackToJobs />
      </div>
      <JobHeader job={job} detail={detail} saved={isSaved(job.id)} onToggleSave={() => toggle(job)} />
      <MatchSection job={job} reasons={reasons} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* On phones the wrapper disappears so details, description and skills can be ordered freely. */}
        <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-5">
          <div className="order-1 lg:order-none">
            <JobDetails job={job} detail={detail} company={company} />
          </div>
          <div className="order-3 lg:order-none">
            <SkillsList skills={job.skills} />
          </div>
        </div>
        <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1">
          <JobDescription detail={detail} />
        </div>
      </div>
    </div>
  )
}

export function JobDetailPage() {
  const { jobId = '' } = useParams()
  return (
    <ProGate fallback={<JobsPreview />}>
      <JobDetailScreen key={jobId} jobId={jobId} />
    </ProGate>
  )
}

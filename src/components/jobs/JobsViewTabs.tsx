import { ProGate } from '@/components/upgrade/ProGate'
import { useApplications } from '@/hooks/useApplications'
import { useAsyncData } from '@/hooks/useAsyncData'
import { MATCHED_THRESHOLD, useJobsView } from '@/hooks/useJobsView'
import type { JobsView } from '@/hooks/useJobsView'
import { useSavedJobs } from '@/hooks/useSavedJobs'
import { getJobs } from '@/services/job.service'
import { cn } from '@/utils/cn'

const browse: Array<[JobsView, string]> = [
  ['all', 'All Jobs'],
  ['saved', 'Saved'],
  ['matched', 'Matched'],
]
const track: Array<[JobsView, string]> = [
  ['applied', 'Applied'],
  ['interviewing', 'Interviewing'],
  ['rejected', 'Rejected'],
]

/** Tab groups shared by the navbar (md+) and the page header (mobile). Pro only, like the Jobs page. */
export function JobsViewTabs({ className }: { className?: string }) {
  return (
    <ProGate fallback={null} loading={null}>
      <Tabs className={className} />
    </ProGate>
  )
}

function Tabs({ className }: { className?: string }) {
  const [view, setView] = useJobsView()
  const jobs = useAsyncData(getJobs)
  const { saved } = useSavedJobs()
  const { applications } = useApplications()
  const all = jobs.status === 'success' ? jobs.data : []
  const tracked = Object.values(applications)
  const byStatus = (status: string) => tracked.filter((app) => app.status === status).length
  const counts: Partial<Record<JobsView, number>> = {
    saved: all.filter((job) => job.id in saved).length,
    matched: all.filter((job) => job.matchPercent >= MATCHED_THRESHOLD).length,
    applied: byStatus('applied'),
    interviewing: byStatus('interviewing'),
    rejected: byStatus('rejected'),
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {[browse, track].map((group, index) => (
        <div key={index} role="tablist" aria-label={index === 0 ? 'Browse jobs' : 'Applications'} className="flex shrink-0 rounded-default border border-border bg-surface p-0.5">
          {group.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors',
                view === value ? 'bg-primary/10 text-primary-deep ring-1 ring-inset ring-primary/20' : 'text-secondary hover:text-text',
              )}
            >
              {label}
              {counts[value] !== undefined && <span className="font-normal text-muted">({counts[value]})</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

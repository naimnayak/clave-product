import { ArrowUpDown, Bookmark, Briefcase, Radar, SearchX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { JobFilters } from '@/components/jobs/JobFilters'
import { JobSearch } from '@/components/jobs/JobSearch'
import { JobList } from '@/components/jobs/JobList'
import { JobCard } from '@/components/jobs/JobCard'
import { JobDetail } from '@/components/jobs/JobDetail'
import { JobsViewTabs } from '@/components/jobs/JobsViewTabs'
import { MATCHED_THRESHOLD, useJobsView } from '@/hooks/useJobsView'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Select } from '@/components/ui/Select'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useApplications } from '@/hooks/useApplications'
import { useSavedJobs } from '@/hooks/useSavedJobs'
import { JobsPreview } from '@/components/jobs/JobsPreview'
import { ProGate } from '@/components/upgrade/ProGate'
import { getJobDetails, getJobFeedStatus, getJobs } from '@/services/job.service'
import { getProfile } from '@/services/profile.service'
import type { Job } from '@/types/job'
import { deriveMatchReasons } from '@/utils/jobMatchReasons'
import { applyJobFilters, countActiveFilters, defaultFilters, roleOptionsFor } from '@/utils/jobFilters'

type Sort = 'match' | 'newest'

const loadContext = () => Promise.all([getJobDetails(), getProfile()]).then(([details, profile]) => ({ details, profile }))

/** Jobs is a Clave Pro feature; Free users see their masked top matches and an upgrade prompt. */
export function JobsPage() {
  return (
    <ProGate fallback={<JobsPreview />}>
      <ProJobsPage />
    </ProGate>
  )
}

function FeedBanner() {
  const feed = useAsyncData(getJobFeedStatus)
  if (feed.status !== 'success' || !feed.data.enabled) return null
  const { running, lastRefreshAt, nextRefreshAt, queries, location } = feed.data
  const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
      <Radar className="size-3.5 text-primary" aria-hidden />
      {running
        ? 'Searching job boards for you now…'
        : queries.length
          ? `Your feed searches for ${queries.slice(0, 3).join(', ')} in ${location}.`
          : 'Add a resume or a job description so your feed knows what to search for.'}
      {lastRefreshAt && !running && <span className="text-muted">Updated {when(lastRefreshAt)}{nextRefreshAt ? ` · next ${when(nextRefreshAt)}` : ''}</span>}
    </p>
  )
}

function ProJobsPage() {
  const jobs = useAsyncData(getJobs)
  const context = useAsyncData(loadContext)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const { saved, isSaved, toggle } = useSavedJobs()
  const { applications } = useApplications()
  const [view] = useJobsView()
  const [sort, setSort] = useState<Sort>('match')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(defaultFilters)

  const all = jobs.status === 'success' ? jobs.data : []
  const tracking = view === 'applied' || view === 'interviewing' || view === 'rejected'
  const source =
    view === 'all'
      ? all
      : view === 'saved'
        ? all.filter((job) => job.id in saved)
        : view === 'matched'
          ? all.filter((job) => job.matchPercent >= MATCHED_THRESHOLD)
          : all.filter((job) => applications[job.id]?.status === view)
  const visible = applyJobFilters(source, query, filters).sort((a, b) =>
    sort === 'match' ? b.matchPercent - a.matchPercent : a.postedDaysAgo - b.postedDaysAgo,
  )
  const selected: Job | undefined = visible.find((job) => job.id === selectedId) ?? visible[0]
  const ctx = context.status === 'success' ? context.data : null
  const reasonsFor = (job: Job) => (ctx && ctx.details[job.id] ? deriveMatchReasons(job, ctx.details[job.id], ctx.profile) : null)
  const selectedReasons = selected ? reasonsFor(selected) : null

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 })
  }, [selected?.id])

  const isFiltering = query.trim() !== '' || countActiveFilters(filters) > 0

  const locations = [...new Set(all.map((job) => job.city))].sort()
  const roles = roleOptionsFor(all)
  const heading = { all: 'Jobs for You', saved: 'Saved Jobs', matched: 'Top Matches', applied: 'Applied', interviewing: 'Interviewing', rejected: 'Rejected' }[view]

  const listHeader = (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-base font-semibold text-text">
        {heading}
        <span className="text-sm font-normal text-muted">{visible.length}</span>
      </h2>
      <div className="flex items-center gap-2 text-sm text-secondary">
        <ArrowUpDown className="size-4 text-muted" aria-hidden />
        <Select aria-label="Sort jobs" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="w-36">
          <option value="match">Best match</option>
          <option value="newest">Newest first</option>
        </Select>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <JobsViewTabs className="-mb-1 overflow-x-auto md:hidden" />

      <h1 className="sr-only">Jobs</h1>
      <FeedBanner />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <JobSearch value={query} onChange={setQuery} className="col-span-2 lg:col-span-5" />
        <JobFilters filters={filters} onChange={setFilters} locations={locations} roles={roles} />
      </div>

      <section aria-label={`${view} jobs`}>
        {jobs.status === 'loading' && <LoadingState label="Finding opportunities…" />}
        {jobs.status === 'error' && <EmptyState title="Couldn’t load jobs" description="Please refresh the page to try again." />}

        {jobs.status === 'success' && visible.length === 0 && (
          <EmptyState
            icon={tracking ? Briefcase : isFiltering ? SearchX : view === 'all' ? Radar : Bookmark}
            title={
              tracking ? `No ${view} jobs yet` : isFiltering ? 'No jobs match' : view === 'all' ? 'Your feed is being prepared' : view === 'matched' ? 'No top matches yet' : 'No saved jobs yet'
            }
            description={
              tracking
                ? 'Use “Apply on Company Site” or “Mark as Applied” on any job, then update its stage here.'
                : isFiltering
                  ? 'Try a different search or loosen your filters.'
                  : view === 'all'
                    ? 'We’re searching job boards for roles that fit your resume. Check back in a few minutes.'
                    : view === 'matched'
                      ? 'Jobs that match 90% or more appear here. Running an ATS check with a job description sharpens your matches.'
                      : 'Tap the bookmark on any job to save it here.'
            }
            action={
              isFiltering &&
              !tracking && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setFilters(defaultFilters)
                  }}
                >
                  Clear search and filters
                </Button>
              )
            }
          />
        )}

        {visible.length > 0 && (
          <>
            <div className="xl:hidden">
              {listHeader}
              <ul className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2">
                {visible.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} saved={isSaved(job.id)} onToggleSave={() => toggle(job)} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden gap-4 xl:sticky xl:top-[calc(var(--navbar-height)+0.75rem)] xl:grid xl:h-[calc(100dvh-var(--navbar-height)-1.5rem)] xl:min-h-[560px] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="flex min-h-0 flex-col">
                {listHeader}
                <JobList jobs={visible} selectedId={selected?.id} isSaved={isSaved} onSelect={setSelectedId} onToggleSave={toggle} />
              </div>
              <div ref={detailRef} className="min-h-0 overflow-y-auto rounded-large border border-border bg-surface p-5 shadow-card">
                {selected && selectedReasons && ctx ? (
                  <div key={selected.id} className="job-fade">
                    <JobDetail
                      job={selected}
                      detail={ctx.details[selected.id]}
                      reasons={selectedReasons}
                      saved={isSaved(selected.id)}
                      onToggleSave={() => toggle(selected)}
                      headingLevel="h2"
                    />
                  </div>
                ) : (
                  <LoadingState label="Opening job…" />
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { adminApi } from '@/admin/adminApi'
import { act, date, dateTime, num, tableClass, useAdmin, useQuery } from '@/admin/lib'
import { PageHeader, Panel, StatCard, TableScroll } from '@/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

export function JobsAdminPage() {
  const { can } = useAdmin()
  const { state, reload } = useQuery(adminApi.jobStats, 'jobs')

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Jobs & feed"
        description="Listings in the catalog, Apify spend and the Pro job feed limits. Limits are set in backend/.env (JOB_FEED_*, APIFY_*)."
        actions={
          <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="size-4" />} onClick={() => reload()}>
            Refresh
          </Button>
        }
      />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <EmptyState title="Couldn’t load job stats" description={state.message} />}
      {state.status === 'success' && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Active listings" value={num(state.data.active)} hint={state.data.feedEnabled ? 'Job feed is on' : 'Job feed is off'} tone={state.data.feedEnabled ? 'primary' : 'warning'} />
            <StatCard
              label="Apify listings this month"
              value={num(state.data.apify.resultsThisMonth)}
              hint={state.data.apify.monthlyLimit ? `of ${num(state.data.apify.monthlyLimit)} cap · ~$${state.data.apify.estimatedCostUsd.toFixed(2)}` : `no cap · ~$${state.data.apify.estimatedCostUsd.toFixed(2)}`}
            />
            <StatCard label="Pro users searched this month" value={num(state.data.feedUsersThisMonth)} />
            <StatCard
              label="Per-user limits"
              value={`${state.data.caps.scheduledPerMonth} + ${state.data.caps.jdSearchesPerMonth}`}
              hint={`automatic + JD searches a month, ${state.data.caps.resultsPerSearch} listings each, every ${state.data.caps.refreshDays} days`}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Panel title="Active listings by source">
              <ul className="divide-y divide-border text-sm">
                {Object.entries(state.data.bySource).length === 0 && <li className="px-4 py-6 text-center text-secondary">No active listings yet.</li>}
                {Object.entries(state.data.bySource).map(([source, count]) => (
                  <li key={source} className="flex justify-between px-4 py-2.5">
                    <span>{source.replace('apify:', '')}</span>
                    <span className="tabular-nums font-medium">{num(count)}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border px-4 py-2.5 text-xs text-secondary">
                Boards searched: {state.data.sources.join(', ')}. LinkedIn is {state.data.linkedinEnabled ? 'on' : 'off (APIFY_LINKEDIN_ENABLED)'}.
              </p>
            </Panel>

            <Panel title="Latest listings">
              <TableScroll>
                <table className={tableClass}>
                  <tbody>
                    {state.data.latestJobs.map((job) => (
                      <tr key={job.id} className={job.active ? '' : 'opacity-60'}>
                        <td>
                          <span className="block font-medium text-text">{job.title}</span>
                          <span className="text-xs text-secondary">{job.company}</span>
                        </td>
                        <td>
                          <Badge>{job.source.replace('apify:', '')}</Badge>
                        </td>
                        <td className="whitespace-nowrap text-secondary">{date(job.postedAt)}</td>
                        <td className="text-right">
                          {can('manage_users') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              leadingIcon={job.active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                              onClick={() => void act(() => adminApi.setJobActive(job.id, !job.active), job.active ? 'Listing hidden' : 'Listing shown').then(() => reload())}
                            >
                              {job.active ? 'Hide' : 'Show'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </Panel>
          </div>

          {state.data.recentIngestRuns.length > 0 && (
            <Panel title="Shared-catalog ingestion runs">
              <ul className="divide-y divide-border text-sm">
                {state.data.recentIngestRuns.map((run, index) => (
                  <li key={index} className="px-4 py-2.5">
                    <p>
                      {dateTime(run.startedAt)} · fetched {run.fetched}, created {run.created}
                    </p>
                    {run.errors.length > 0 && <p className="mt-0.5 text-xs text-warning">{run.errors.join(' · ')}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

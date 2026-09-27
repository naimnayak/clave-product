import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminApi } from '@/admin/adminApi'
import { inr, num, useQuery } from '@/admin/lib'
import { BarChart, PageHeader, Panel, StatCard } from '@/admin/ui'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

export function OverviewPage() {
  const { state, reload } = useQuery(adminApi.overview, 'overview')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Users, subscriptions, revenue and costs at a glance."
        actions={
          <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="size-4" />} onClick={() => reload()}>
            Refresh
          </Button>
        }
      />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <EmptyState title="Couldn’t load the overview" description={state.message} />}
      {state.status === 'success' && <Dashboard data={state.data} />}
    </div>
  )
}

function Dashboard({ data }: { data: import('@/admin/adminApi').Overview }) {
  const { users, subscriptions, revenue, usage, jobs, support, series } = data
  const apifyShare = jobs.apifyMonthlyLimit ? Math.round((jobs.apifyResultsThisMonth / jobs.apifyMonthlyLimit) * 100) : null
  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue this month" value={inr(revenue.thisMonth)} hint={`${num(revenue.paymentsThisMonth)} payments · ${inr(revenue.allTime)} all time`} tone="primary" />
        <StatCard label="Active Pro subscribers" value={num(subscriptions.pro)} hint={`${num(subscriptions.proExpiring7d)} expire in 7 days · ${num(subscriptions.comped)} comped`} />
        <StatCard label="Users" value={num(users.total)} hint={`+${num(users.new7d)} this week · ${num(users.active7d)} active`} />
        <StatCard
          label="Apify listings this month"
          value={num(jobs.apifyResultsThisMonth)}
          hint={`~$${jobs.apifyEstimatedCostUsd.toFixed(2)}${apifyShare !== null ? ` · ${apifyShare}% of ${num(jobs.apifyMonthlyLimit)} cap` : ''}`}
          tone={apifyShare !== null && apifyShare >= 80 ? 'warning' : 'neutral'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sign-ups, last 30 days">
          <BarChart points={series.signups} label="Sign-ups" />
        </Panel>
        <Panel title="Revenue, last 30 days">
          <BarChart points={series.revenue} label="Revenue" format={inr} />
        </Panel>
      </div>

      <section aria-label="Activity" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Resumes created" value={num(usage.resumesTotal)} hint={`+${num(usage.resumes7d)} this week`} />
        <StatCard label="AI actions today" value={num(usage.aiActionsToday)} hint={`${num(usage.chatMessagesToday)} assistant messages`} />
        <StatCard label="Active job listings" value={num(jobs.active)} hint={jobs.feedEnabled ? 'Job feed on' : 'Job feed off (no Apify token or AI)'} />
        <StatCard label="Saved job descriptions" value={num(usage.jobDescriptions)} hint={`${num(usage.openChats)} open assistant chats`} />
        <StatCard label="New sign-ups (30 days)" value={num(users.new30d)} />
        <StatCard label="Users with resume credits" value={num(subscriptions.withCredits)} />
        <StatCard label="Refunded this month" value={inr(revenue.refundedThisMonth)} />
        <StatCard label="Suspended accounts" value={num(users.suspended)} />
      </section>

      <Panel title="Needs attention">
        <ul className="divide-y divide-border text-sm">
          <li className="flex items-center justify-between px-4 py-3">
            <span>Unanswered support messages</span>
            <Link to="/admin/support" className="font-semibold text-primary-deep hover:underline">
              {num(support.openMessages)}
            </Link>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span>Pro plans ending in the next 7 days</span>
            <Link to="/admin/subscribers?sort=proEnd" className="font-semibold text-primary-deep hover:underline">
              {num(subscriptions.proExpiring7d)}
            </Link>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span>Feedback this week</span>
            <Link to="/admin/support?tab=feedback" className="font-semibold text-primary-deep hover:underline">
              {num(support.feedback7d)}
            </Link>
          </li>
        </ul>
      </Panel>
    </>
  )
}

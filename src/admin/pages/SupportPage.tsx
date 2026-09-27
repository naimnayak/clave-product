import { Check, Mail, RotateCcw, Star } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { adminApi } from '@/admin/adminApi'
import { act, dateTime, useQuery } from '@/admin/lib'
import { Pagination, PageHeader, StatusBadge } from '@/admin/ui'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { cn } from '@/utils/cn'

type Tab = 'new' | 'resolved' | 'all' | 'feedback'

export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'new'
  const page = Number(params.get('page') ?? 1) || 1
  const go = (next: Partial<{ tab: Tab; page: number }>) => {
    const search = new URLSearchParams(params)
    if (next.tab) {
      search.set('tab', next.tab)
      search.delete('page')
    }
    if (next.page) search.set('page', String(next.page))
    setParams(search, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Support inbox" description="Contact-form messages and in-app feedback. Reply by email, then mark the message resolved." />
      <div role="tablist" aria-label="Inbox" className="flex w-fit rounded-default border border-border bg-surface p-0.5">
        {(
          [
            ['new', 'Open'],
            ['resolved', 'Resolved'],
            ['all', 'All'],
            ['feedback', 'Feedback'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => go({ tab: value })}
            className={cn('rounded-control px-3 py-1.5 text-xs font-semibold', tab === value ? 'bg-primary/10 text-primary-deep' : 'text-secondary hover:text-text')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'feedback' ? <Feedback page={page} onPage={(p) => go({ page: p })} /> : <Messages status={tab} page={page} onPage={(p) => go({ page: p })} />}
    </div>
  )
}

function Messages({ status, page, onPage }: { status: 'new' | 'resolved' | 'all'; page: number; onPage: (page: number) => void }) {
  const { state, reload } = useQuery(() => adminApi.messages(status, page), `${status}-${page}`)
  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <EmptyState title="Couldn’t load messages" description={state.message} />
  if (state.data.items.length === 0) return <EmptyState title={status === 'new' ? 'Inbox zero' : 'No messages'} description="New contact-form messages appear here." />
  return (
    <Card padding="none" className="overflow-hidden shadow-none">
      <ul className="divide-y divide-border">
        {state.data.items.map((message) => (
          <li key={message.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                {message.topic || 'General'} <StatusBadge status={message.status} />
              </p>
              <p className="text-xs text-secondary">
                {message.name} · {message.email} · {dateTime(message.createdAt)}
                {message.resolvedBy ? ` · resolved by ${message.resolvedBy}` : ''}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text">{message.message}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.topic || 'Your message to Clave'}`)}`}
                className={buttonStyles({ variant: 'secondary', size: 'sm' })}
              >
                <Mail className="size-4" aria-hidden />
                Reply
              </a>
              {message.status === 'new' ? (
                <Button size="sm" leadingIcon={<Check className="size-4" />} onClick={() => void act(() => adminApi.setMessageStatus(message.id, 'resolved'), 'Marked resolved').then(() => reload())}>
                  Resolve
                </Button>
              ) : (
                <Button variant="ghost" size="sm" leadingIcon={<RotateCcw className="size-4" />} onClick={() => void act(() => adminApi.setMessageStatus(message.id, 'new'), 'Reopened').then(() => reload())}>
                  Reopen
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={state.data.page} limit={state.data.limit} total={state.data.total} onPage={onPage} />
    </Card>
  )
}

function Feedback({ page, onPage }: { page: number; onPage: (page: number) => void }) {
  const { state } = useQuery(() => adminApi.feedback(page), `feedback-${page}`)
  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <EmptyState title="Couldn’t load feedback" description={state.message} />
  if (state.data.items.length === 0) return <EmptyState title="No feedback yet" />
  return (
    <Card padding="none" className="overflow-hidden shadow-none">
      <ul className="divide-y divide-border">
        {state.data.items.map((item) => (
          <li key={item.id} className="px-4 py-4">
            <p className="flex flex-wrap items-center gap-2 text-xs text-secondary">
              {item.email} · {dateTime(item.createdAt)}
              {item.page && <span>· on {item.page}</span>}
              {item.rating && (
                <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${item.rating} out of 5`}>
                  {Array.from({ length: item.rating }, (_, i) => (
                    <Star key={i} className="size-3 fill-current" aria-hidden />
                  ))}
                </span>
              )}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-text">{item.message}</p>
          </li>
        ))}
      </ul>
      <Pagination page={state.data.page} limit={state.data.limit} total={state.data.total} onPage={onPage} />
    </Card>
  )
}

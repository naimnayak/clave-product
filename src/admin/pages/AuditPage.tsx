import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi } from '@/admin/adminApi'
import { dateTime, tableClass, useQuery } from '@/admin/lib'
import { Pagination, PageHeader, TableScroll } from '@/admin/ui'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'

const ACTIONS = [
  ['', 'All actions'],
  ['subscription', 'Subscriptions'],
  ['credits', 'Credits'],
  ['plan', 'Plans & pricing'],
  ['payment', 'Refunds'],
  ['user', 'Status, roles & deletions'],
  ['usage', 'Usage resets'],
  ['broadcast', 'Broadcasts'],
  ['support', 'Support'],
  ['job', 'Job listings'],
  ['users.export', 'Exports'],
] as const

const USER_TARGET = /^(subscription|credits|usage|user|note|jobs\.refresh|payment)/

export function AuditPage() {
  const [params, setParams] = useSearchParams()
  const [target, setTarget] = useState(params.get('target') ?? '')
  const filters = { action: params.get('action') ?? '', target: params.get('target') ?? '', page: Number(params.get('page') ?? 1) || 1 }
  const { state } = useQuery(() => adminApi.audit(filters), JSON.stringify(filters))
  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Audit log" description="Every change made in the admin panel: who, what, when and from which IP." />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          set('target', target.trim())
        }}
        className="grid gap-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <SearchInput label="Filter by target" placeholder="User ID, plan ID or order ID, then Enter" value={target} onChange={(event) => setTarget(event.target.value)} />
        <Select aria-label="Action" value={filters.action} onChange={(event) => set('action', event.target.value)}>
          {ACTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </form>
      <Card padding="none" className="overflow-hidden shadow-none">
        {state.status === 'loading' && <LoadingState />}
        {state.status === 'error' && <EmptyState title="Couldn’t load the audit log" description={state.message} />}
        {state.status === 'success' && (
          <>
            {state.data.items.length === 0 ? (
              <EmptyState title="Nothing logged yet" />
            ) : (
              <TableScroll>
                <table className={tableClass}>
                  <thead className="bg-background/60">
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Who</th>
                      <th scope="col">Action</th>
                      <th scope="col">Target</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap text-secondary">{dateTime(entry.at)}</td>
                        <td>
                          <span className="block">{entry.actorEmail}</span>
                          <span className="text-xs text-muted">
                            {entry.actorRole}
                            {entry.ip ? ` · ${entry.ip}` : ''}
                          </span>
                        </td>
                        <td className="font-medium whitespace-nowrap">{entry.action}</td>
                        <td className="font-mono text-[11px]">
                          {entry.target && USER_TARGET.test(entry.action) ? (
                            <Link to={`/admin/users/${encodeURIComponent(entry.target)}`} className="text-primary-deep hover:underline">
                              {entry.target}
                            </Link>
                          ) : (
                            entry.target ?? '—'
                          )}
                        </td>
                        <td className="max-w-md">
                          <code className="block truncate text-[11px] text-secondary" title={JSON.stringify(entry.details)}>
                            {Object.keys(entry.details).length ? JSON.stringify(entry.details) : '—'}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
            <Pagination page={state.data.page} limit={state.data.limit} total={state.data.total} onPage={(page) => set('page', String(page))} />
          </>
        )}
      </Card>
    </div>
  )
}

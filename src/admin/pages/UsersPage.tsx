import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi } from '@/admin/adminApi'
import { adminPath } from '@/admin/host'
import type { UserFilters } from '@/admin/adminApi'
import { act, ago, date, tableClass, useAdmin, useQuery } from '@/admin/lib'
import { Pagination, PageHeader, PlanBadge, RoleBadge, StatusBadge, TableScroll } from '@/admin/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'

const LIMIT = 25

/** Users list with search and filters. `subscribers` opens it on active Pro users. */
export function UsersPage({ subscribers = false }: { subscribers?: boolean }) {
  const { can } = useAdmin()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const filters: UserFilters = {
    q: params.get('q') ?? '',
    plan: (params.get('plan') as UserFilters['plan']) || (subscribers ? 'pro' : undefined),
    status: (params.get('status') as UserFilters['status']) || undefined,
    role: (params.get('role') as UserFilters['role']) || undefined,
    sort: (params.get('sort') as UserFilters['sort']) || (subscribers ? 'proEnd' : 'newest'),
    page: Number(params.get('page') ?? 1) || 1,
    limit: LIMIT,
  }
  const key = JSON.stringify(filters)
  const { state } = useQuery(() => adminApi.users(filters), key)

  const set = (name: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  // Search as you type, debounced.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (params.get('q') ?? '')) set('q', search.trim() || undefined)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={subscribers ? 'Subscribers' : 'Users'}
        description={subscribers ? 'Clave Pro members, soonest renewal first. Switch the plan filter to see expired or credit holders.' : 'Search, filter and manage every account.'}
        actions={
          can('manage_users') && (
            <Button variant="secondary" size="sm" leadingIcon={<Download className="size-4" />} onClick={() => void act(() => adminApi.exportUsers(filters), 'Export downloaded')}>
              Export CSV
            </Button>
          )
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <SearchInput label="Search users" placeholder="Name, email or user ID" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select aria-label="Plan" value={filters.plan ?? ''} onChange={(event) => set('plan', event.target.value || undefined)}>
          <option value="">All plans</option>
          <option value="pro">Pro (active)</option>
          <option value="expired">Pro expired</option>
          <option value="free">Free</option>
          <option value="credits">Has resume credits</option>
        </Select>
        <Select aria-label="Status" value={filters.status ?? ''} onChange={(event) => set('status', event.target.value || undefined)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select aria-label="Role" value={filters.role ?? ''} onChange={(event) => set('role', event.target.value || undefined)}>
          <option value="">Any role</option>
          <option value="admin">Admins</option>
          <option value="support">Support</option>
        </Select>
        <Select aria-label="Sort" value={filters.sort} onChange={(event) => set('sort', event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="lastLogin">Recently active</option>
          <option value="name">Name A–Z</option>
          <option value="proEnd">Pro ends soonest</option>
        </Select>
      </div>

      <Card padding="none" className="overflow-hidden shadow-none">
        {state.status === 'loading' && <LoadingState />}
        {state.status === 'error' && <EmptyState title="Couldn’t load users" description={state.message} />}
        {state.status === 'success' && (
          <>
            {state.data.items.length === 0 ? (
              <EmptyState title="No users match" description="Try another search or clear the filters." />
            ) : (
              <TableScroll>
                <table className={tableClass}>
                  <thead className="bg-background/60">
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Pro until</th>
                      <th scope="col">Resumes</th>
                      <th scope="col">Status</th>
                      <th scope="col">Joined</th>
                      <th scope="col">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((user) => (
                      <tr key={user.id} className="hover:bg-primary/[0.03]">
                        <td>
                          <Link to={adminPath(`/users/${encodeURIComponent(user.id)}`)} className="flex min-w-0 items-center gap-3">
                            <Avatar name={user.name || user.email} src={user.avatarUrl ?? undefined} size="sm" />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 font-medium text-text">
                                <span className="truncate">{user.name || '—'}</span>
                                <RoleBadge role={user.role} owner={user.owner} />
                              </span>
                              <span className="block truncate text-xs text-secondary">{user.email}</span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <PlanBadge user={user} />
                        </td>
                        <td className="whitespace-nowrap text-secondary">{user.isPro || user.proExpired ? date(user.currentPeriodEnd) : '—'}</td>
                        <td className="tabular-nums">{user.resumesCreated}</td>
                        <td>
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="whitespace-nowrap text-secondary">{date(user.createdAt)}</td>
                        <td className="whitespace-nowrap text-secondary">{ago(user.lastLoginAt)}</td>
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

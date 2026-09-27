import { ArrowLeft, Briefcase, CreditCard, Crown, Gauge, History, Inbox, Megaphone, ShieldAlert, Tags, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import type { Permission } from '@/admin/adminApi'
import { adminPath, mainAppUrl } from '@/admin/host'
import { adminApi } from '@/admin/adminApi'
import { AuditPage } from '@/admin/pages/AuditPage'
import { BroadcastPage } from '@/admin/pages/BroadcastPage'
import { JobsAdminPage } from '@/admin/pages/JobsAdminPage'
import { OverviewPage } from '@/admin/pages/OverviewPage'
import { PaymentsPage } from '@/admin/pages/PaymentsPage'
import { PlansPage } from '@/admin/pages/PlansPage'
import { SupportPage } from '@/admin/pages/SupportPage'
import { UserDetailPage } from '@/admin/pages/UserDetailPage'
import { UsersPage } from '@/admin/pages/UsersPage'
import { AdminContext, useQuery } from '@/admin/lib'
import { RoleBadge } from '@/admin/ui'
import { ClaveLogo } from '@/components/brand/ClaveLogo'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { cn } from '@/utils/cn'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  permission: Permission
  end?: boolean
}

const NAV: Item[] = [
  { to: adminPath(), label: 'Overview', icon: Gauge, permission: 'view', end: true },
  { to: adminPath('/users'), label: 'Users', icon: Users, permission: 'view', end: true },
  { to: adminPath('/subscribers'), label: 'Subscribers', icon: Crown, permission: 'view' },
  { to: adminPath('/plans'), label: 'Plans & pricing', icon: Tags, permission: 'view' },
  { to: adminPath('/payments'), label: 'Payments', icon: CreditCard, permission: 'view' },
  { to: adminPath('/jobs'), label: 'Jobs & feed', icon: Briefcase, permission: 'view' },
  { to: adminPath('/support'), label: 'Support inbox', icon: Inbox, permission: 'support' },
  { to: adminPath('/broadcast'), label: 'Broadcast', icon: Megaphone, permission: 'broadcast' },
  { to: adminPath('/audit'), label: 'Audit log', icon: History, permission: 'view' },
]

/** /admin/*: the Clave admin panel, lazy-loaded so it never ships in the main app bundle. */
export default function AdminApp() {
  const { state } = useQuery(adminApi.me, 'me')

  if (state.status === 'loading') return <LoadingState label="Checking admin access…" className="min-h-dvh" />
  if (state.status === 'error') {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No admin access"
        description="This account isn’t an admin or support member. Ask an owner to give you a role."
        action={
          <a href={mainAppUrl} className={buttonStyles({ variant: 'secondary' })}>
            Back to Clave
          </a>
        }
        className="min-h-dvh justify-center"
      />
    )
  }

  const me = state.data
  const nav = NAV.filter((item) => me.permissions.includes(item.permission))

  return (
    <AdminContext.Provider value={me}>
      <div className="flex min-h-dvh bg-background">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <div className="flex items-center gap-2 px-5 py-5">
            <ClaveLogo />
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary-deep uppercase">Admin</span>
          </div>
          <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary/10 text-primary-deep' : 'text-secondary hover:bg-text/5 hover:text-text',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-border px-5 py-4 text-xs">
            <p className="truncate font-medium text-text">{me.email}</p>
            <div className="mt-1">
              <RoleBadge role={me.role} owner={me.owner} />
            </div>
            <a href={mainAppUrl} className="mt-3 inline-flex items-center gap-1.5 text-secondary hover:text-text">
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to Clave
            </a>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile: horizontal nav */}
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden">
            {nav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => cn('shrink-0 rounded-control px-3 py-1.5 text-xs font-semibold', isActive ? 'bg-primary/10 text-primary-deep' : 'text-secondary')}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route index element={<OverviewPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="subscribers" element={<UsersPage subscribers />} />
              <Route path="users/:uid" element={<UserDetailPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="jobs" element={<JobsAdminPage />} />
              {me.permissions.includes('support') && <Route path="support" element={<SupportPage />} />}
              {me.permissions.includes('broadcast') && <Route path="broadcast" element={<BroadcastPage />} />}
              <Route path="audit" element={<AuditPage />} />
              <Route path="*" element={<Navigate to={adminPath()} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  )
}

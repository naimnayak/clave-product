import { ArrowLeft, Ban, Bell, Crown, Minus, Plus, RefreshCw, RotateCcw, Trash2, UserCheck } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminApi } from '@/admin/adminApi'
import type { AdminUserDetail } from '@/admin/adminApi'
import { act, ago, date, dateTime, inr, tableClass, useAdmin, useQuery } from '@/admin/lib'
import { Panel, PlanBadge, RoleBadge, StatusBadge, TableScroll, useConfirm } from '@/admin/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

export function UserDetailPage() {
  const { uid = '' } = useParams()
  const { state, reload } = useQuery(() => adminApi.user(uid), uid)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/admin/users" className="inline-flex w-fit items-center gap-1.5 text-sm text-secondary hover:text-text">
        <ArrowLeft className="size-4" aria-hidden />
        All users
      </Link>
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <EmptyState title="Couldn’t load this user" description={state.message} />}
      {state.status === 'success' && <UserDetail user={state.data} reload={reload} />}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-right font-medium text-text">{children}</dd>
    </div>
  )
}

function UserDetail({ user, reload }: { user: AdminUserDetail; reload: () => void }) {
  const { can, me } = useAdmin()
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirm()
  const [grant, setGrant] = useState<null | 'grant' | 'extend'>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const protectedAccount = user.owner || user.id === me.uid
  const run = async (action: () => Promise<unknown>, message: string) => {
    if ((await act(action, message)) !== undefined) reload()
  }

  const revoke = async () => {
    const reason = await confirm({ title: 'End Clave Pro now?', description: `${user.email} goes back to the Free plan immediately. Payments aren’t refunded; use Payments for that.`, confirmLabel: 'End Pro', destructive: true, reason: true })
    if (reason !== null) await run(() => adminApi.changeSubscription(user.id, { action: 'revoke', reason }), 'Pro ended')
  }
  const credits = async (delta: number) => run(() => adminApi.changeCredits(user.id, delta), delta > 0 ? 'Credit added' : 'Credit removed')
  const reset = async (what: 'resumes' | 'mockInterviews' | 'aiToday' | 'deviceClaims', label: string) => {
    const reason = await confirm({ title: `Reset ${label}?`, description: 'The user gets this allowance back. This is recorded in the audit log.', confirmLabel: 'Reset', reason: true })
    if (reason !== null) await run(() => adminApi.resetUsage(user.id, what, reason), `${label} reset`)
  }
  const toggleStatus = async () => {
    if (user.status === 'suspended') return run(() => adminApi.setStatus(user.id, 'active'), 'Account reactivated')
    const reason = await confirm({ title: 'Suspend this account?', description: 'They are signed out on every device and can’t use Clave until reactivated. Their data is kept.', confirmLabel: 'Suspend', destructive: true, reason: true })
    if (reason !== null) await run(() => adminApi.setStatus(user.id, 'suspended', reason), 'Account suspended')
  }
  const remove = async () => {
    const reason = await confirm({
      title: 'Delete this account permanently?',
      description: 'Resumes, profile, uploads, chats and the login are deleted. Payment records are kept for accounting. This can’t be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
      reason: true,
      typeToConfirm: user.email,
    })
    if (reason === null) return
    if ((await act(() => adminApi.deleteUser(user.id, user.email, reason), 'Account deleted')) !== undefined) navigate('/admin/users')
  }

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={user.name || user.email} src={user.avatarUrl ?? undefined} size="lg" />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-editorial text-2xl font-medium text-text">
              {user.name || 'Unnamed user'}
              <RoleBadge role={user.role} owner={user.owner} />
            </h1>
            <p className="text-sm text-secondary">
              {user.email} {!user.emailVerified && <Badge variant="warning">email not verified</Badge>}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <PlanBadge user={user} />
              <StatusBadge status={user.status} />
              <span>Joined {date(user.createdAt)}</span>
              <span>· Last active {ago(user.lastLoginAt)}</span>
              <span>· Signs in with {user.provider}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('manage_users') && (
            <Button variant="secondary" size="sm" leadingIcon={<Bell className="size-4" />} onClick={() => setNotifyOpen(true)}>
              Send notification
            </Button>
          )}
          {can('manage_users') && !protectedAccount && (
            <Button variant={user.status === 'suspended' ? 'primary' : 'secondary'} size="sm" leadingIcon={user.status === 'suspended' ? <UserCheck className="size-4" /> : <Ban className="size-4" />} onClick={() => void toggleStatus()}>
              {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </Button>
          )}
        </div>
      </header>

      {user.status === 'suspended' && (
        <p role="status" className="rounded-default border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          Suspended {dateTime(user.suspendedAt)}
          {user.suspendedReason ? `: ${user.suspendedReason}` : ''}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Subscription">
          <dl className="divide-y divide-border">
            <Row label="Plan">
              <PlanBadge user={user} />
            </Row>
            <Row label="Pro until">{user.isPro || user.proExpired ? dateTime(user.currentPeriodEnd) : '—'}</Row>
            <Row label="Resume credits">
              <span className="inline-flex items-center gap-1.5">
                {can('billing') && (
                  <Button variant="ghost" size="sm" aria-label="Remove a credit" disabled={user.singleResumesBalance === 0} onClick={() => void credits(-1)}>
                    <Minus className="size-3.5" aria-hidden />
                  </Button>
                )}
                <span className="tabular-nums">{user.singleResumesBalance}</span>
                {can('billing') && (
                  <Button variant="ghost" size="sm" aria-label="Add a credit" onClick={() => void credits(1)}>
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                )}
              </span>
            </Row>
          </dl>
          {can('billing') && (
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              {user.isPro ? (
                <>
                  <Button size="sm" leadingIcon={<Crown className="size-4" />} onClick={() => setGrant('extend')}>
                    Extend Pro
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void revoke()}>
                    End Pro
                  </Button>
                </>
              ) : (
                <Button size="sm" leadingIcon={<Crown className="size-4" />} onClick={() => setGrant('grant')}>
                  Give Pro
                </Button>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Usage">
          <dl className="divide-y divide-border">
            <Row label="Resumes created (lifetime)">
              <ResetValue value={user.usage.resumesCreated ?? 0} onReset={can('manage_users') ? () => void reset('resumes', 'Resume count') : undefined} />
            </Row>
            <Row label="Mock interviews started">
              <ResetValue value={user.usage.mockInterviews ?? 0} onReset={can('manage_users') ? () => void reset('mockInterviews', 'Mock interview count') : undefined} />
            </Row>
            <Row label="AI actions today">
              <ResetValue value={user.usage.aiActionsToday ?? 0} onReset={can('manage_users') ? () => void reset('aiToday', 'Today’s AI usage') : undefined} />
            </Row>
            <Row label="Assistant messages today">{user.usage.chatMessagesToday ?? 0}</Row>
            <Row label="Free-resume device claims">
              <ResetValue value={user.counts.deviceClaims} onReset={can('manage_users') ? () => void reset('deviceClaims', 'Device claims') : undefined} />
            </Row>
          </dl>
        </Panel>

        <Panel title="Account">
          <dl className="divide-y divide-border">
            <Row label="Resumes">{user.counts.resumes}</Row>
            <Row label="Applications tracked">{user.counts.applications}</Row>
            <Row label="Saved jobs">{user.counts.savedJobs}</Row>
            <Row label="Job descriptions">{user.counts.jobDescriptions}</Row>
            <Row label="Signed-in devices">{user.counts.activeSessions}</Row>
            <Row label="Onboarding">{user.onboardingComplete ? 'Complete' : 'Not finished'}</Row>
            {can('roles') && !protectedAccount && (
              <Row label="Admin role">
                <Select
                  aria-label="Admin role"
                  value={user.role}
                  onChange={(event) => void run(() => adminApi.setRole(user.id, event.target.value as 'user' | 'support' | 'admin'), 'Role updated')}
                  className="h-8 w-36"
                >
                  <option value="user">None</option>
                  <option value="support">Support</option>
                  <option value="admin">Admin</option>
                </Select>
              </Row>
            )}
          </dl>
          {can('delete_users') && !protectedAccount && (
            <div className="border-t border-border px-4 py-3">
              <Button variant="ghost" size="sm" className="text-error!" leadingIcon={<Trash2 className="size-4" />} onClick={() => void remove()}>
                Delete account
              </Button>
            </div>
          )}
        </Panel>
      </div>

      {user.jobFeed && (
        <Panel
          title="Job feed"
          action={
            can('manage_users') && (
              <Button variant="secondary" size="sm" leadingIcon={<RefreshCw className="size-4" />} onClick={() => void run(() => adminApi.refreshFeed(user.id), 'Feed search finished')}>
                Search now
              </Button>
            )
          }
        >
          <dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
            <Row label="Searches for">{user.jobFeed.queries.join(', ') || 'Nothing yet (no resume or JD)'}</Row>
            <Row label="Location">{user.jobFeed.location}</Row>
            <Row label="Last refresh">{dateTime(user.jobFeed.lastRefreshAt)}</Row>
            <Row label="Searches left this month">
              {user.jobFeed.scheduledLeft} automatic · {user.jobFeed.jdSearchesLeft} from JDs
            </Row>
          </dl>
          {user.jobFeed.lastError && <p className="border-t border-border px-4 py-2.5 text-xs text-warning">Last error: {user.jobFeed.lastError}</p>}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Resumes (${user.counts.resumes})`}>
          {user.resumes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-secondary">No resumes yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {user.resumes.map((resume) => (
                <li key={resume.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-text">{resume.name}</span>
                    <span className="text-xs text-secondary">
                      {resume.targetRole || 'No target role'} · {resume.type} · updated {ago(resume.updatedAt)}
                    </span>
                  </span>
                  <Badge>ATS {resume.atsScore}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Payments" action={<Link to={`/admin/payments?q=${encodeURIComponent(user.email)}`} className="text-xs font-medium text-primary-deep hover:underline">Open in Payments</Link>}>
          {user.payments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-secondary">No payments.</p>
          ) : (
            <TableScroll>
              <table className={tableClass}>
                <tbody>
                  {user.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap text-secondary">{date(payment.createdAt)}</td>
                      <td>{payment.plan === 'monthly' ? 'Clave Pro' : 'Single resume'}</td>
                      <td className="tabular-nums">{inr(payment.amount)}</td>
                      <td>
                        <StatusBadge status={payment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Notes user={user} reload={reload} />
        <Panel title="Admin history">
          {user.history.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-secondary">No admin changes yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {user.history.map((entry) => (
                <li key={entry.id} className="px-4 py-2.5">
                  <p className="font-medium text-text">{entry.action}</p>
                  <p className="text-xs text-secondary">
                    {entry.actorEmail} · {dateTime(entry.at)}
                    {typeof entry.details.reason === 'string' && entry.details.reason ? ` · “${entry.details.reason}”` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {grant && <GrantModal mode={grant} userId={user.id} email={user.email} onClose={() => setGrant(null)} onDone={reload} />}
      {notifyOpen && <NotifyModal userId={user.id} onClose={() => setNotifyOpen(false)} />}
      {dialog}
    </>
  )
}

function ResetValue({ value, onReset }: { value: number; onReset?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {value}
      {onReset && value > 0 && (
        <Button variant="ghost" size="sm" aria-label="Reset" title="Reset" onClick={onReset}>
          <RotateCcw className="size-3.5" aria-hidden />
        </Button>
      )}
    </span>
  )
}

function GrantModal({ mode, userId, email, onClose, onDone }: { mode: 'grant' | 'extend'; userId: string; email: string; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState(30)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const result = await act(() => adminApi.changeSubscription(userId, { action: mode, days, reason }), mode === 'grant' ? 'Pro given' : 'Pro extended')
    setSaving(false)
    if (result) {
      onDone()
      onClose()
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'grant' ? 'Give Clave Pro' : 'Extend Clave Pro'}
      description={`${email} gets Pro without paying. It’s marked as comped and recorded in the audit log.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="grant-form" loading={saving}>
            {mode === 'grant' ? 'Give Pro' : 'Extend'}
          </Button>
        </>
      }
    >
      <form id="grant-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Input label="Days" type="number" min={1} max={3650} required value={days} onChange={(event) => setDays(Number(event.target.value))} />
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90, 365].map((value) => (
            <Button key={value} type="button" variant={days === value ? 'tint' : 'secondary'} size="sm" onClick={() => setDays(value)}>
              {value} days
            </Button>
          ))}
        </div>
        <Textarea label="Reason (saved in the audit log)" rows={2} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Beta tester, support compensation" />
      </form>
    </Modal>
  )
}

function NotifyModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    const done = await act(() => adminApi.notifyUser(userId, { title, body }), 'Notification sent')
    setSending(false)
    if (done !== undefined) onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Send a notification"
      description="Appears in the user’s notifications (and as an email if they allow account emails)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="notify-form" loading={sending} disabled={!title.trim()}>
            Send
          </Button>
        </>
      }
    >
      <form id="notify-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Input label="Title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
        <Textarea label="Message" rows={3} maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} />
      </form>
    </Modal>
  )
}

function Notes({ user, reload }: { user: AdminUserDetail; reload: () => void }) {
  const { can, me } = useAdmin()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    const note = await act(() => adminApi.addNote(user.id, text.trim()), 'Note added')
    setSaving(false)
    if (note) {
      setText('')
      reload()
    }
  }
  return (
    <Panel title="Internal notes">
      {can('notes') && (
        <form onSubmit={(event) => void add(event)} className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <Textarea label="Add a note" rows={2} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Only staff can see notes." />
          <div>
            <Button type="submit" size="sm" loading={saving} disabled={!text.trim()}>
              Add note
            </Button>
          </div>
        </form>
      )}
      {user.notes.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-secondary">No notes.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {user.notes.map((note) => (
            <li key={note.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="whitespace-pre-wrap text-text">{note.text}</p>
                <p className="mt-0.5 text-xs text-secondary">
                  {note.authorEmail} · {dateTime(note.createdAt)}
                </p>
              </div>
              {(note.authorEmail === me.email || can('manage_users')) && (
                <Button variant="ghost" size="sm" aria-label="Delete note" onClick={() => void act(() => adminApi.deleteNote(user.id, note.id), 'Note deleted').then(reload)}>
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

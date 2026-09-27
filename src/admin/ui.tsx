import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AdminUser } from '@/admin/adminApi'
import { date, num } from '@/admin/lib'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/utils/cn'

// ─── Layout pieces ──────────────────────────────────────────────────────────────

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-editorial text-3xl font-medium tracking-tight text-text">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function StatCard({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'neutral' | 'primary' | 'warning' }) {
  return (
    <Card padding="sm" className={cn('flex flex-col gap-1 shadow-none', tone === 'primary' && 'border-primary/25 bg-tint', tone === 'warning' && 'border-warning/30')}>
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-text tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  )
}

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card padding="none" className={cn('overflow-hidden shadow-none', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {action}
      </div>
      <div>{children}</div>
    </Card>
  )
}

/** Small accessible bar chart for 30-day series. */
export function BarChart({ points, label, format = num }: { points: Array<{ date: string; value: number }>; label: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const total = points.reduce((sum, p) => sum + p.value, 0)
  return (
    <figure className="px-4 py-3">
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`${label}: ${format(total)} in the last ${points.length} days`}>
        {points.map((p) => (
          <div
            key={p.date}
            title={`${date(p.date)}: ${format(p.value)}`}
            className="flex-1 rounded-t-[3px] bg-primary/70 transition-colors hover:bg-primary"
            style={{ height: `${Math.max(p.value > 0 ? 6 : 2, (p.value / max) * 100)}%`, opacity: p.value > 0 ? 1 : 0.25 }}
          />
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{date(points[0]?.date)}</span>
        <span className="font-medium text-secondary">{format(total)} total</span>
        <span>{date(points[points.length - 1]?.date)}</span>
      </figcaption>
    </figure>
  )
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-secondary">
      <span>
        {total === 0 ? 'No results' : `${num((page - 1) * limit + 1)}–${num(Math.min(page * limit, total))} of ${num(total)}`}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>
}

// ─── Badges ─────────────────────────────────────────────────────────────────────

export function PlanBadge({ user }: { user: Pick<AdminUser, 'isPro' | 'proExpired' | 'compedByAdmin' | 'singleResumesBalance'> }) {
  if (user.isPro) return <Badge variant="primary">{user.compedByAdmin ? 'Pro (comped)' : 'Pro'}</Badge>
  if (user.proExpired) return <Badge variant="warning">Pro expired</Badge>
  return <Badge>{user.singleResumesBalance > 0 ? `Free · ${user.singleResumesBalance} credit${user.singleResumesBalance === 1 ? '' : 's'}` : 'Free'}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const variant = { active: 'success', suspended: 'error', paid: 'success', refunded: 'warning', refunding: 'warning', created: 'neutral', new: 'info', resolved: 'neutral' }[status] as
    | 'success'
    | 'error'
    | 'warning'
    | 'neutral'
    | 'info'
    | undefined
  return (
    <Badge variant={variant ?? 'neutral'} dot>
      {status === 'created' ? 'pending' : status}
    </Badge>
  )
}

export function RoleBadge({ role, owner }: { role: string; owner?: boolean }) {
  if (role === 'user') return null
  return <Badge variant={role === 'admin' ? 'primary' : 'info'}>{owner ? 'Owner' : role === 'admin' ? 'Admin' : 'Support'}</Badge>
}

// ─── Confirm dialog ─────────────────────────────────────────────────────────────

interface ConfirmOptions {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  /** Ask for a reason (saved in the audit log). */
  reason?: boolean
  /** Require this exact text to be typed before confirming. */
  typeToConfirm?: string
  /** Extra fields rendered above the reason. */
  body?: ReactNode
}

/** Promise-based confirm dialog: `const reason = await confirm({...})` resolves null when cancelled. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const resolver = useRef<((value: string | null) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next)
    setReason('')
    setTyped('')
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (value: string | null) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const blocked = Boolean(options?.typeToConfirm && typed.trim().toLowerCase() !== options.typeToConfirm.toLowerCase())
  const dialog = options && (
    <Modal
      open
      onClose={() => close(null)}
      title={options.title}
      description={options.description}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(null)}>
            Cancel
          </Button>
          <Button variant={options.destructive ? 'destructive' : 'primary'} disabled={blocked} onClick={() => close(reason.trim())}>
            {options.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {options.body}
        {options.reason && (
          <Textarea label="Reason (saved in the audit log)" rows={2} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        )}
        {options.typeToConfirm && (
          <Input label={`Type ${options.typeToConfirm} to confirm`} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
        )}
      </div>
    </Modal>
  )
  return { confirm, dialog }
}

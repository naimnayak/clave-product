import { Bell, BellOff, Briefcase, FileText, ListChecks, ShieldCheck, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconButton } from '@/components/ui/IconButton'
import { fromHere, paths } from '@/routes/navigation'
import { listNotifications, markNotificationsRead } from '@/services/notifications.service'
import type { AppNotification } from '@/services/notifications.service'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/relativeTime'

const ICONS: Record<AppNotification['category'], LucideIcon> = {
  jobs: Briefcase,
  resumes: FileText,
  applications: ListChecks,
  product: Sparkles,
  account: ShieldCheck,
}
const POLL_MS = 60_000

/** Navbar bell: unread count, a panel with recent notifications, and mark-as-read. */
export function NotificationsBell() {
  const signedIn = useAuthStore((state) => state.user !== null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const navigate = useNavigate()
  const location = useLocation()

  const refresh = useCallback(async () => {
    try {
      const data = await listNotifications()
      setItems(data.items)
      setUnread(data.unreadCount)
    } catch {
      setItems((current) => current ?? [])
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    void refresh()
    const timer = setInterval(() => document.visibilityState === 'visible' && void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [refresh, signedIn])

  useEffect(() => {
    if (!open) return
    void refresh()
    const onPointerDown = (event: PointerEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false)
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, refresh])

  const markRead = async (ids: string[] = []) => {
    setItems((current) => current?.map((item) => (ids.length === 0 || ids.includes(item.id) ? { ...item, read: true } : item)) ?? null)
    setUnread((count) => (ids.length === 0 ? 0 : Math.max(0, count - ids.length)))
    try {
      setUnread((await markNotificationsRead(ids)).unreadCount)
    } catch {
      /* the next refresh corrects the count */
    }
  }

  const openItem = (item: AppNotification) => {
    if (!item.read) void markRead([item.id])
    setOpen(false)
    // Pages with their own Back (the editor, flows) return to where the notification was opened.
    if (item.link?.startsWith('/') && !item.link.startsWith('//')) navigate(item.link, { state: fromHere(location) })
  }

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        size="sm"
        className="relative"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span aria-hidden className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] leading-4 font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </IconButton>

      {open && (
        <div id={panelId} role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-24px)] overflow-hidden rounded-default border border-border bg-surface shadow-popover">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => void markRead()} className="text-xs font-medium text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {items === null ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <BellOff className="size-6 text-muted" aria-hidden />
              <p className="mt-2 text-sm font-medium text-text">You’re all caught up</p>
              <p className="mt-0.5 text-xs text-secondary">Resume updates, job matches and account notices appear here.</p>
            </div>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">
              {items.map((item) => {
                const Icon = ICONS[item.category] ?? Bell
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => openItem(item)} className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-background', !item.read && 'bg-primary/[0.035]')}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-control icon-tile">
                        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn('text-sm text-text', !item.read && 'font-semibold')}>{item.title}</span>
                          {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        </span>
                        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-secondary">{item.body}</span>}
                        <span className="mt-1 block text-[11px] text-muted">{formatRelativeTime(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t border-border px-4 py-2.5 text-right">
            <Link to={`${paths.settings}#notifications`} onClick={() => setOpen(false)} className="text-xs font-medium text-secondary hover:text-text">
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

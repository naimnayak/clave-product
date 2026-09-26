import { Laptop, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Session } from '@/hooks/useAccountSettings'
import { toast } from '@/store/toastStore'
import { formatRelativeTime } from '@/utils/relativeTime'

interface Props {
  sessions: Session[]
  onRevoke: (id: string) => Promise<void>
  onRevokeOthers: () => Promise<void>
  onClose: () => void
}

export function SessionsModal({ sessions, onRevoke, onRevokeOthers, onClose }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const others = sessions.filter((session) => !session.current)

  const run = async (key: string, action: () => Promise<void>, success: string, detail?: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(success, detail)
    } catch (error) {
      toast.error('Couldn’t sign that device out', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Active sessions"
      description="Browsers where you’re signed in to Clave. Signing a device out ends its session right away."
      footer={
        <>
          {others.length > 0 && (
            <Button variant="secondary" loading={busy === 'others'} onClick={() => void run('others', onRevokeOthers, 'Signed out of other devices')}>
              Sign out all other devices
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      {sessions.length === 0 ? (
        <p className="text-sm text-secondary">No active sessions found.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {sessions.map((session) => {
            const Icon = /iPhone|iPad|Android/.test(session.device) ? Smartphone : Laptop
            return (
              <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control icon-tile">
                  <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">
                    {session.device}
                    {session.current && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-deep">This device</span>}
                  </p>
                  <p className="text-xs text-secondary">{session.current ? 'Active now' : `Last active ${formatRelativeTime(session.lastActive)}`}</p>
                </div>
                {!session.current && (
                  <Button variant="secondary" size="sm" loading={busy === session.id} onClick={() => void run(session.id, () => onRevoke(session.id), 'Signed out', session.device)}>
                    Sign out
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

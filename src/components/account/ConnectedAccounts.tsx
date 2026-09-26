import { Link2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsRow } from '@/components/account/SettingsRow'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/store/toastStore'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8.1Z" />
      <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.1-4.5H2.3v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.3a11 11 0 0 0 0 9.8l3.6-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.3 7.1l3.6 2.8C6.700 7.300 9.100 5.400 12 5.400Z" />
    </svg>
  )
}

/** Google sign-in linked to this account through Firebase (link / unlink). */
export function ConnectedAccounts({ connected, onChange }: { connected: boolean; onChange: (connect: boolean) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      await onChange(!connected)
      toast.success(connected ? 'Google disconnected' : 'Google connected')
      setOpen(false)
    } catch (error) {
      toast.error(connected ? 'Couldn’t disconnect Google' : 'Couldn’t connect Google', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SettingsRow
        icon={Link2}
        title="Connected accounts"
        description="Manage your connected accounts and sign-in options."
        status={
          <span className="inline-flex items-center gap-2.5 sm:border-l sm:border-border sm:pl-4">
            <GoogleMark />
            <span className="text-left">
              <span className="block text-xs font-medium text-text">Google</span>
              <span className={connected ? 'block text-xs text-primary' : 'block text-xs text-muted'}>{connected ? 'Connected' : 'Not connected'}</span>
            </span>
          </span>
        }
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Manage
          </Button>
        }
      />
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Google"
          description={connected ? 'You can sign in to Clave with your Google account.' : 'Connect Google to sign in with one click.'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button variant={connected ? 'destructive' : 'primary'} loading={busy} onClick={() => void toggle()}>
                {connected ? 'Disconnect' : 'Connect Google'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-secondary">
            {connected
              ? 'Disconnecting removes Google as a sign-in option. You’ll still be able to sign in with your email and password.'
              : 'A Google window opens so you can choose the account to connect. Clave only receives your name, email address and profile photo.'}
          </p>
        </Modal>
      )}
    </>
  )
}

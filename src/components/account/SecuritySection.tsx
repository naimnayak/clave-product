import { Laptop, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { AccountSection } from '@/components/account/AccountSection'
import { SecurityIllustration } from '@/components/account/AccountIllustrations'
import { ChangePasswordModal } from '@/components/account/ChangePasswordModal'
import { ConnectedAccounts } from '@/components/account/ConnectedAccounts'
import { SessionsModal } from '@/components/account/SessionsModal'
import { SettingsRow } from '@/components/account/SettingsRow'
import { Button } from '@/components/ui/Button'
import type { useAccountSettings } from '@/hooks/useAccountSettings'
import { formatRelativeTime } from '@/utils/relativeTime'

type Props = ReturnType<typeof useAccountSettings>

export function SecuritySection({ settings, revokeSession, revokeOthers, setGoogle, markPasswordChanged }: Props) {
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const count = settings.sessions.length

  return (
    <>
      <AccountSection title="Login & Security" description="Keep your account secure and manage your login options." illustration={<SecurityIllustration />}>
        <div className="divide-y divide-border">
          <SettingsRow
            icon={LockKeyhole}
            title="Password"
            description={
              settings.hasPassword
                ? settings.passwordChangedAt
                  ? `Last changed ${formatRelativeTime(settings.passwordChangedAt)}`
                  : 'Set when you created your account'
                : 'You sign in with Google. To add a password, use “Forgot password” on the login page.'
            }
            action={
              settings.hasPassword && (
                <Button variant="secondary" size="sm" onClick={() => setPasswordOpen(true)}>
                  Change password
                </Button>
              )
            }
          />
          <ConnectedAccounts connected={settings.googleConnected} onChange={setGoogle} />
          <SettingsRow
            icon={Laptop}
            title="Active sessions"
            description="Manage devices where you’re signed in to your account."
            status={count ? `${count} active ${count === 1 ? 'session' : 'sessions'}` : undefined}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSessionsOpen(true)}>
                Manage sessions
              </Button>
            }
          />
        </div>
      </AccountSection>

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} onChanged={markPasswordChanged} />}
      {sessionsOpen && <SessionsModal sessions={settings.sessions} onRevoke={revokeSession} onRevokeOthers={revokeOthers} onClose={() => setSessionsOpen(false)} />}
    </>
  )
}

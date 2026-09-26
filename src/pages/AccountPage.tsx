import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { DangerZone } from '@/components/account/DangerZone'
import { ProfileInformation } from '@/components/account/ProfileInformation'
import { SecuritySection } from '@/components/account/SecuritySection'
import { SubscriptionSection } from '@/components/account/SubscriptionSection'
import { useAccountSettings } from '@/hooks/useAccountSettings'

/** Account = identity, sign-in, plan. Career details live on the Career Profile. */
export function AccountPage() {
  const account = useAccountSettings()

  return (
    <SettingsLayout>
      <div className="flex w-full flex-col gap-6">
        <h1 className="sr-only">Account</h1>

        <ProfileInformation emailVerified={account.settings.emailVerified} />
        <SecuritySection {...account} />
        <SubscriptionSection />
        <DangerZone />
      </div>
    </SettingsLayout>
  )
}

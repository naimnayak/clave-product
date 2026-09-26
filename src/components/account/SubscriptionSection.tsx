import { ArrowUp, Crown } from 'lucide-react'
import { useState } from 'react'
import { PlanDecoration } from '@/components/account/AccountIllustrations'
import { AccountSection } from '@/components/account/AccountSection'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getSubscription } from '@/services/subscription.service'
import type { Subscription } from '@/services/subscription.service'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'

type Panel = 'billing' | null

function usageLine(sub: Subscription): string {
  if (sub.isUnlimited) return 'Unlimited resumes, AI generation and tailoring.'
  const credits = sub.singleResumesBalance > 0 ? ` · ${sub.singleResumesBalance} resume credit${sub.singleResumesBalance === 1 ? '' : 's'}` : ''
  return `${Math.min(sub.resumesCreated, sub.resumesAllowance)} of ${sub.resumesAllowance} free resume${sub.resumesAllowance === 1 ? '' : 's'} used${credits}`
}

/** Plan and usage come from GET /api/subscriptions/current. Payments aren't connected yet, and billing says so. */
export function SubscriptionSection() {
  const [panel, setPanel] = useState<Panel>(null)
  const openUpgradeModal = useUpgradeModalStore((s) => s.openUpgradeModal)
  const subscription = useAsyncData(getSubscription)
  const sub = subscription.status === 'success' ? subscription.data : null
  const planName = sub?.isUnlimited ? 'Monthly Unlimited' : 'Free Plan'

  return (
    <>
      <AccountSection title="Subscription" description="Manage your plan and billing information.">
        <div className="relative flex flex-col gap-4 overflow-hidden rounded-default border border-primary/15 bg-tint p-4 sm:flex-row sm:items-center">
          <PlanDecoration />
          <div className="relative flex flex-1 items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-default bg-surface text-primary shadow-xs ring-1 ring-primary/15">
              <Crown className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="text-base font-semibold text-text">{planName}</p>
              <p className="mt-0.5 text-[13px] text-secondary">
                {sub ? usageLine(sub) : 'Build resumes, manage your career profile, and explore opportunities.'}
              </p>
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <Button size="sm" leadingIcon={<ArrowUp className="size-4" />} onClick={openUpgradeModal}>
              Upgrade to Pro
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPanel('billing')}>
              View billing
            </Button>
          </div>
        </div>
      </AccountSection>

      {panel === 'billing' && (
        <Modal
          open
          onClose={() => setPanel(null)}
          title="Billing"
          footer={<Button onClick={() => setPanel(null)}>Done</Button>}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Current plan</dt>
              <dd className="mt-0.5 font-medium text-text">{sub?.isUnlimited ? 'Monthly Unlimited' : 'Free'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Payment method</dt>
              <dd className="mt-0.5 font-medium text-text">None on file</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Invoices</dt>
              <dd className="mt-0.5 text-secondary">No invoices yet. Billing appears here once you upgrade.</dd>
            </div>
          </dl>
        </Modal>
      )}
    </>
  )
}

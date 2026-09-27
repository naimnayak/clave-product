import { ArrowUp, Crown } from 'lucide-react'
import { useState } from 'react'
import { PlanDecoration } from '@/components/account/AccountIllustrations'
import { AccountSection } from '@/components/account/AccountSection'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useSubscription } from '@/hooks/useSubscription'
import type { Subscription } from '@/services/subscription.service'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'

type Panel = 'billing' | null

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function usageLine(sub: Subscription): string {
  if (sub.isPro) {
    return `Personal job feed, unlimited resumes and mock interviews${sub.currentPeriodEnd ? ` · active until ${formatDate(sub.currentPeriodEnd)}` : ''}.`
  }
  const credits = sub.singleResumesBalance > 0 ? ` · ${sub.singleResumesBalance} resume credit${sub.singleResumesBalance === 1 ? '' : 's'}` : ''
  return `${Math.min(sub.resumesCreated, sub.resumesAllowance)} of ${sub.resumesAllowance} free resume${sub.resumesAllowance === 1 ? '' : 's'} used${credits}`
}

/** Plan and usage from GET /api/subscriptions/current. Upgrades go through Razorpay (UpgradeModal). */
export function SubscriptionSection() {
  const [panel, setPanel] = useState<Panel>(null)
  const openUpgradeModal = useUpgradeModalStore((s) => s.openUpgradeModal)
  const { subscription: sub } = useSubscription()
  const planName = sub?.isPro ? sub.planName || 'Clave Pro' : 'Free Plan'

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
              {sub?.isPro ? 'Extend Pro' : 'Upgrade to Pro'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPanel('billing')}>
              View billing
            </Button>
          </div>
        </div>
      </AccountSection>

      {panel === 'billing' && (
        <Modal open onClose={() => setPanel(null)} title="Billing" footer={<Button onClick={() => setPanel(null)}>Done</Button>}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Current plan</dt>
              <dd className="mt-0.5 font-medium text-text">{planName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{sub?.isPro ? 'Active until' : 'Payment method'}</dt>
              <dd className="mt-0.5 font-medium text-text">
                {sub?.isPro && sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'Razorpay (UPI, cards, net banking)'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Renewal</dt>
              <dd className="mt-0.5 text-secondary">
                Clave Pro is a 30-day pass with no auto-renewal. Extending adds 30 days to your current end date. Razorpay emails a receipt for every payment.
              </dd>
            </div>
          </dl>
        </Modal>
      )}
    </>
  )
}

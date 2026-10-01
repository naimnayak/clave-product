import { Crown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSubscription } from '@/hooks/useSubscription'
import { paths } from '@/routes/navigation'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'
import { cn } from '@/utils/cn'

/**
 * Top bar plan control: "Upgrade" for Free accounts, a crown for Clave Pro (links to the plan in Account).
 * Nothing renders until the plan has loaded, so Pro users never see "Upgrade" flash first.
 */
export function UpgradeButton({ className }: { className?: string }) {
  const { isPro, subscription } = useSubscription()
  const openUpgradeModal = useUpgradeModalStore((s) => s.openUpgradeModal)

  if (isPro === null) return <span aria-hidden className={cn('inline-block h-7 w-7', className)} />

  if (isPro) {
    const plan = subscription?.planName || 'Clave Pro'
    return (
      <Link
        to={paths.account}
        aria-label={`${plan}: view your plan`}
        title={plan}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-full bg-amber-400/15 text-amber-500 ring-1 ring-amber-400/40 transition-colors hover:bg-amber-400/25',
          className,
        )}
      >
        <Crown className="size-4" strokeWidth={2} aria-hidden />
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={openUpgradeModal}
      className={cn(
        'inline-flex h-7 cursor-pointer items-center justify-center rounded-control bg-[#064E3B] px-3 text-xs font-medium text-white shadow-2xs transition-all duration-150 hover:bg-[#056B4D] active:scale-[0.98]',
        className,
      )}
    >
      Upgrade
    </button>
  )
}

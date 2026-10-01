import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClaveLogo } from '@/components/brand/ClaveLogo'
import { NotificationsBell } from '@/components/navigation/NotificationsBell'
import { UpgradeButton } from '@/components/upgrade/UpgradeButton'
import { UserMenu } from '@/layouts/UserMenu'
import { paths } from '@/routes/navigation'

interface ResumeFlowMobileHeaderProps {
  onBack: () => void
}

/**
 * Reusable mobile header for all resume creation flows:
 * [ ← ] Clave logo                              Upgrade  Bell  Avatar
 *
 * Provides a comfortable ~40x40px touch target for ArrowLeft without text "Back",
 * ensuring full visual consistency across all 4 flows on mobile viewports.
 */
export function ResumeFlowMobileHeader({ onBack }: ResumeFlowMobileHeaderProps) {
  return (
    <div className="flex w-full items-center justify-between gap-2 md:hidden">
      {/* LEFT: 40x40px icon-only back arrow + Clave logo */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-text shadow-2xs transition-all hover:bg-neutral-100 active:scale-95 cursor-pointer -ml-1"
          aria-label="Go back"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>

        <Link to={paths.dashboard} aria-label="Clave home" className="rounded-control flex items-center">
          <ClaveLogo variant="compact" />
        </Link>
      </div>

      {/* RIGHT: Upgrade, Notification, Avatar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <UpgradeButton />

        <NotificationsBell />

        <UserMenu />
      </div>
    </div>
  )
}

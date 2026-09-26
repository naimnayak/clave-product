import { ArrowLeft, Menu } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { TemplateSearch } from '@/components/resumes/templates/TemplateSearch'
import { ResumeSearch } from '@/components/resumes/ResumeSearch'
import { BackToJobs } from '@/components/jobs/JobDetail'
import { JobsViewTabs } from '@/components/jobs/JobsViewTabs'
import { ClaveLogo } from '@/components/brand/ClaveLogo'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { IconButton } from '@/components/ui/IconButton'
import { NotificationsBell } from '@/components/navigation/NotificationsBell'
import { ResumeFlowMobileHeader } from '@/components/navigation/ResumeFlowMobileHeader'
import { UserMenu } from '@/layouts/UserMenu'
import { paths } from '@/routes/navigation'

import { useFlowNavStore } from '@/store/flowNavStore'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'

interface NavbarProps {
  onOpenNavigation: () => void
  navigationOpen: boolean
}

/** True for the resume creation flow routes where FlowShell is rendered. */
const isFlowRoute = (pathname: string) =>
  pathname.startsWith('/resumes/new/') || pathname === paths.createResume

export function Navbar({ onOpenNavigation, navigationOpen }: NavbarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onFlow = isFlowRoute(pathname)
  const backHandler = useFlowNavStore((s) => s.backHandler)
  const openUpgradeModal = useUpgradeModalStore((s) => s.openUpgradeModal)

  const handleBack = () => {
    if (backHandler) {
      backHandler()
    } else if (pathname === paths.createResume) {
      navigate(paths.resumes)
    } else {
      navigate(paths.createResume)
    }
  }

  return (
    <header className={`sticky top-0 z-10 flex h-(--navbar-height) shrink-0 items-center justify-between gap-3 bg-surface/95 backdrop-blur px-4 sm:px-6 lg:px-8 ${pathname === paths.assistant || pathname === paths.mockInterview ? 'md:hidden' : ''}`}>
      {/* On flow routes on mobile, render the dedicated reusable mobile header */}
      {onFlow ? (
        <ResumeFlowMobileHeader onBack={handleBack} />
      ) : (
        /* Regular mobile header: hamburger + logo */
        <div className="flex items-center gap-2 md:hidden">
          <IconButton
            label="Open navigation"
            aria-expanded={navigationOpen}
            aria-controls="mobile-navigation"
            onClick={onOpenNavigation}
            className="-ml-2"
          >
            <Menu className="size-5" aria-hidden />
          </IconButton>
          <Link to={paths.dashboard} aria-label="Clave home" className="rounded-control">
            <ClaveLogo variant="compact" />
          </Link>
        </div>
      )}

      {/* Flow routes: Back button in the navbar (desktop only) */}
      {onFlow && (
        <div className="hidden md:flex items-center">
          <button
            type="button"
            onClick={handleBack}
            className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </button>
        </div>
      )}

      {/* Page-specific centre content */}
      {pathname === paths.createFromTemplate && <TemplateSearch className="hidden max-w-md flex-1 md:block" />}
      {pathname === paths.resumes && <ResumeSearch className="hidden max-w-md flex-1 md:block" />}
      {(pathname === paths.settings || pathname === paths.account) && <SettingsNav className="hidden md:block" />}
      {pathname.startsWith(`${paths.jobs}/`) && <div className="hidden md:block"><BackToJobs variant="button" /></div>}
      {pathname === paths.jobs && <JobsViewTabs className="hidden md:flex" />}

      {/* Right: upgrade + notifications + user (desktop for all routes, mobile for non-flow routes) */}
      <div className={`ml-auto flex items-center gap-2 sm:gap-3 ${onFlow ? 'hidden md:flex' : ''}`}>
        <button
          type="button"
          onClick={openUpgradeModal}
          className="inline-flex h-7 items-center justify-center rounded-control bg-[#064E3B] px-3 text-xs font-medium text-white shadow-2xs transition-all duration-150 hover:bg-[#056B4D] active:scale-[0.98] cursor-pointer"
        >
          Upgrade
        </button>
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  )
}


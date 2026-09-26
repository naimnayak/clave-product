import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { UpgradeModal } from '@/components/upgrade/UpgradeModal'
import { MainContent } from '@/layouts/MainContent'
import { MobileDrawer } from '@/layouts/MobileDrawer'
import { Navbar } from '@/layouts/Navbar'
import { Sidebar } from '@/layouts/Sidebar'
import { paths } from '@/routes/navigation'

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // The Dashboard sits on a flat warm off-white: no wash of green behind it.
  const flat = useLocation().pathname === paths.dashboard
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  return (
    <div className={flat ? 'min-h-dvh bg-background' : 'min-h-dvh bg-canvas'}>
      {!flat && <AmbientBackground />}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 text-sm font-medium shadow-popover focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

      <div
        inert={drawerOpen}
        className="relative flex min-h-dvh flex-col md:pl-(--sidebar-rail-width) lg:pl-(--sidebar-width)"
      >
        <Navbar onOpenNavigation={() => setDrawerOpen(true)} navigationOpen={drawerOpen} />
        <MainContent />
      </div>

      <UpgradeModal />
    </div>
  )
}

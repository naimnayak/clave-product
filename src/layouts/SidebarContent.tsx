import { Plus } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ClaveLogo } from '@/components/brand/ClaveLogo'
import { SidebarBackdrop } from '@/components/layout/SidebarBackdrop'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { paths, primaryNav, settingsNav, useFromHere } from '@/routes/navigation'
import type { NavItem } from '@/routes/navigation'
import { cn } from '@/utils/cn'

interface SidebarContentProps {
  /** Icon-only rail used on tablet. */
  collapsed?: boolean
  onNavigate?: () => void
}

const linkClass = (active: boolean, collapsed: boolean | undefined) =>
  cn(
    'flex h-10 items-center gap-3 rounded-control text-sm font-medium transition-colors',
    collapsed ? 'justify-center' : 'px-3',
    active ? 'nav-active text-white' : 'text-sidebar-text hover:bg-white/5 hover:text-white',
  )

function SidebarLink({ item, collapsed, onNavigate }: { item: NavItem } & SidebarContentProps) {
  const { label, path, icon: Icon } = item
  const { pathname } = useLocation()

  const content = (active: boolean) => (
    <>
      <Icon className={cn('size-5 shrink-0', active && 'text-primary-on-dark')} strokeWidth={1.75} aria-hidden />
      {!collapsed && label}
    </>
  )

  // Account is a Settings page, so Settings stays highlighted there. NavLink can't be forced active, so use a Link.
  if (path === paths.settings && pathname === paths.account) {
    return (
      <Link
        to={path}
        onClick={onNavigate}
        aria-current="page"
        aria-label={collapsed ? label : undefined}
        title={collapsed ? label : undefined}
        className={linkClass(true, collapsed)}
      >
        {content(true)}
      </Link>
    )
  }

  return (
    <NavLink
      to={path}
      end={path === paths.dashboard}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={({ isActive }) => linkClass(isActive, collapsed)}
    >
      {({ isActive }) => content(isActive)}
    </NavLink>
  )
}

export function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const from = useFromHere()
  return (
    <div className="surface-dark relative isolate h-full overflow-hidden border-r border-white/5 bg-[#061a16]">
      <SidebarBackdrop />
      <div className="relative z-10 flex h-full flex-col">
      <div className={cn('flex h-(--navbar-height) shrink-0 items-center border-b border-white/5', collapsed ? 'justify-center' : 'px-6')}>
        <Link to={paths.dashboard} onClick={onNavigate} aria-label="Clave home" className="rounded-control">
          <ClaveLogo variant={collapsed ? 'icon' : 'full'} reverse />
        </Link>
      </div>

      <div className={cn('py-5', collapsed ? 'flex justify-center' : 'px-4')}>
        <Link
          to={paths.createResume}
          state={from}
          onClick={onNavigate}
          aria-label={collapsed ? 'Create Resume' : undefined}
          title={collapsed ? 'Create Resume' : undefined}
          className={cn(
            buttonStyles({ variant: 'primary', size: collapsed ? 'md' : 'lg', fullWidth: !collapsed, iconOnly: collapsed }),
            'font-semibold',
          )}
        >
          <Plus className="size-5" strokeWidth={2.25} aria-hidden />
          {!collapsed && 'Create Resume'}
        </Link>
      </div>

      <nav aria-label="Primary" className={cn('flex-1 overflow-y-auto', collapsed ? 'px-3' : 'px-4')}>
        <ul className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <li key={item.path}>
              <SidebarLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('shrink-0 border-t border-white/10 py-4', collapsed ? 'px-3' : 'px-4')}>
        <SidebarLink item={settingsNav} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      </div>
    </div>
  )
}

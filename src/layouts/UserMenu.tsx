import { BookOpen, LogOut, Moon, ShieldCheck, Sun, User, UserCog } from 'lucide-react'
import { ADMIN_HOST, adminUrl } from '@/admin/host'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { paths } from '@/routes/navigation'
import { useAuthStore } from '@/store/authStore'
import { resolveTheme, useThemeStore } from '@/store/themeStore'

export function UserMenu() {
  const { user } = useCurrentUser()
  const signOut = useAuthStore((state) => state.signOut)
  const name = user?.name ?? 'Account'
  // Quick Light/Dark switch; Settings → Appearance also offers "System".
  const preference = useThemeStore((state) => state.preference)
  const setPreference = useThemeStore((state) => state.setPreference)
  const isDark = resolveTheme(preference) === 'dark'

  return (
    <Dropdown
      label="Account menu"
      trigger={(triggerProps) => (
        <button
          type="button"
          aria-label="Open account menu"
          className="flex rounded-full transition-shadow hover:ring-4 hover:ring-primary/10"
          {...triggerProps}
        >
          <Avatar name={name} src={user?.avatarUrl} size="sm" />
        </button>
      )}
    >
      {user && (
        <>
          <DropdownLabel>
            <p className="text-sm font-medium text-text">{user.name}</p>
            <p className="text-xs text-secondary">{user.email}</p>
          </DropdownLabel>
          <DropdownSeparator />
        </>
      )}
      <DropdownItem to={paths.careerProfile} icon={User}>
        Career Profile
      </DropdownItem>
      <DropdownItem to={paths.account} icon={UserCog}>
        Account
      </DropdownItem>
      <DropdownItem to={paths.guide} icon={BookOpen}>
        User Guide
      </DropdownItem>
      {(user?.role === 'admin' || user?.role === 'support') &&
        (ADMIN_HOST ? (
          <DropdownItem icon={ShieldCheck} onSelect={() => window.open(adminUrl, '_blank', 'noopener')}>
            Admin panel
          </DropdownItem>
        ) : (
          <DropdownItem to={adminUrl} icon={ShieldCheck}>
            Admin panel
          </DropdownItem>
        ))}
      <DropdownItem icon={isDark ? Sun : Moon} hint={preference === 'system' ? `System · ${isDark ? 'Dark' : 'Light'}` : isDark ? 'Dark' : 'Light'} onSelect={() => setPreference(isDark ? 'light' : 'dark')}>
        {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem
        icon={LogOut}
        destructive
        onSelect={signOut}
      >
        Log out
      </DropdownItem>
    </Dropdown>
  )
}

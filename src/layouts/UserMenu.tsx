import { BookOpen, LogOut, Palette, ShieldCheck, User, UserCog } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { paths } from '@/routes/navigation'
import { useAuthStore } from '@/store/authStore'

export function UserMenu() {
  const { user } = useCurrentUser()
  const signOut = useAuthStore((state) => state.signOut)
  const name = user?.name ?? 'Account'

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
      {(user?.role === 'admin' || user?.role === 'support') && (
        <DropdownItem to={paths.admin} icon={ShieldCheck}>
          Admin panel
        </DropdownItem>
      )}
      <DropdownItem icon={Palette} hint="Light" disabled>
        Theme
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

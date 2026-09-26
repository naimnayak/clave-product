import { Monitor, Moon, Sun } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useThemeStore } from '@/store/themeStore'
import type { ThemePreference } from '@/store/themeStore'
import { cn } from '@/utils/cn'

const options: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]

/** Light, Dark, or follow the device setting. Applies instantly on this device. */
export function AppearanceControl() {
  const preference = useThemeStore((state) => state.preference)
  const setPreference = useThemeStore((state) => state.setPreference)

  // Arrow keys move between options, as expected for a radio group.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
    event.preventDefault()
    const index = options.findIndex((option) => option.id === preference)
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
    const next = options[(index + step + options.length) % options.length]
    setPreference(next.id)
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-id="${next.id}"]`)?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Appearance" onKeyDown={onKeyDown} className="inline-flex overflow-hidden rounded-control border border-border">
      {options.map(({ id, label, icon: Icon }) => {
        const checked = preference === id
        return (
          <button
            key={id}
            data-id={id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setPreference(id)}
            className={cn(
              'flex h-9 items-center gap-2 px-3.5 text-[13px] font-medium transition-colors',
              checked ? 'bg-tint text-primary-deep ring-1 ring-primary/25 ring-inset' : 'text-secondary hover:text-text',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}

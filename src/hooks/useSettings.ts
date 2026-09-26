import { useCallback, useEffect, useState } from 'react'
import { loadSettings, readSettings, writeSettings } from '@/services/settings.service'
import { toast } from '@/store/toastStore'
import type { UserSettings } from '@/types/settings'

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => readSettings())

  // Start from the local copy, then pick up changes saved on other devices.
  useEffect(() => {
    let active = true
    loadSettings().then(
      (loaded) => active && setSettings(loaded),
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [])

  const update = useCallback((patch: Partial<UserSettings> | ((current: UserSettings) => UserSettings)) => {
    setSettings((current) => {
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch }
      writeSettings(next).catch(() => toast.error('Couldn’t save your settings', 'Check your connection and try again.'))
      return next
    })
  }, [])

  return { settings, update }
}

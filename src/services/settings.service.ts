import { apiClient } from '@/services/apiClient'
import { useAuthStore } from '@/store/authStore'
import type { UserSettings } from '@/types/settings'

/**
 * Settings live on the account (GET/PUT /api/me/settings). A per-user localStorage copy keeps
 * readSettings() synchronous for the builder and the first render of the Settings page.
 */
const key = (userId: string) => `clave.settings.${userId}`

export const defaultSettings: UserSettings = {
  dateFormat: 'dmy',
  emailPreference: 'important',
  notifications: { jobs: true, resumes: true, applications: true, product: true },
  privacy: { personalizeAi: true, usageData: false },
  defaultTemplate: 'classic',
}

function merge(parsed: Partial<UserSettings>): UserSettings {
  return {
    ...defaultSettings,
    ...parsed,
    notifications: { ...defaultSettings.notifications, ...parsed.notifications },
    privacy: { ...defaultSettings.privacy, ...parsed.privacy },
  }
}

function cache(settings: UserSettings, userId: string) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(settings))
  } catch {
    /* storage unavailable: the server copy is still saved */
  }
}

export function readSettings(userId = useAuthStore.getState().user?.id ?? ''): UserSettings {
  try {
    const stored = localStorage.getItem(key(userId))
    if (stored) return merge(JSON.parse(stored) as Partial<UserSettings>)
  } catch {
    /* fall back to defaults */
  }
  return defaultSettings
}

/** Fetches the saved settings and refreshes the local copy. */
export async function loadSettings(userId = useAuthStore.getState().user?.id ?? ''): Promise<UserSettings> {
  const settings = merge(await apiClient.get<Partial<UserSettings>>('/me/settings'))
  cache(settings, userId)
  return settings
}

export async function writeSettings(settings: UserSettings, userId = useAuthStore.getState().user?.id ?? ''): Promise<void> {
  cache(settings, userId)
  await apiClient.put('/me/settings', settings)
}

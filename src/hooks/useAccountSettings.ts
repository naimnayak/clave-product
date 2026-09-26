import { useCallback, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { apiClient } from '@/services/apiClient'
import { linkGoogle, unlinkGoogle } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'

export interface Session {
  id: string
  device: string
  /** ISO timestamp of the last request from this device. */
  lastActive: string
  current: boolean
}

interface SecurityResponse {
  providers: string[]
  passwordUpdatedAt: string | null
  emailVerified: boolean
  sessions: Session[]
}

export interface AccountSettings {
  emailVerified: boolean
  hasPassword: boolean
  /** When the password was last set; null for Google-only accounts. */
  passwordChangedAt: string | null
  googleConnected: boolean
  sessions: Session[]
}

const initial = (): AccountSettings => {
  const providers = auth.currentUser?.providerData.map((p) => p.providerId) ?? []
  return {
    emailVerified: auth.currentUser?.emailVerified ?? useAuthStore.getState().user?.emailVerified ?? false,
    hasPassword: providers.includes('password'),
    passwordChangedAt: null,
    googleConnected: providers.includes('google.com'),
    sessions: [],
  }
}

/** Login & security state from GET /api/me/security (sign-in methods come from Firebase). */
export function useAccountSettings() {
  const [settings, setSettings] = useState<AccountSettings>(initial)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const data = await apiClient.get<SecurityResponse>('/me/security')
      setSettings({
        emailVerified: data.emailVerified,
        hasPassword: data.providers.includes('password'),
        passwordChangedAt: data.passwordUpdatedAt,
        googleConnected: data.providers.includes('google.com'),
        sessions: data.sessions,
      })
    } catch {
      /* keep what we have; the section still works with Firebase data */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const revokeSession = useCallback(async (id: string) => {
    await apiClient.delete(`/me/sessions/${encodeURIComponent(id)}`)
    setSettings((current) => ({ ...current, sessions: current.sessions.filter((s) => s.id !== id) }))
  }, [])

  const revokeOthers = useCallback(async () => {
    await apiClient.post('/me/sessions/revoke-others')
    setSettings((current) => ({ ...current, sessions: current.sessions.filter((s) => s.current) }))
  }, [])

  const setGoogle = useCallback(
    async (connect: boolean) => {
      await (connect ? linkGoogle() : unlinkGoogle())
      await reload()
    },
    [reload],
  )

  const markPasswordChanged = useCallback(() => {
    setSettings((current) => ({ ...current, passwordChangedAt: new Date().toISOString() }))
  }, [])

  return { settings, loading, reload, revokeSession, revokeOthers, setGoogle, markPasswordChanged }
}

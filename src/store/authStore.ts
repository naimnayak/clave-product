import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { setUnauthenticatedHandler } from '@/services/apiClient'
import * as authService from '@/services/auth.service'
import { useOnboardingStore } from '@/store/onboardingStore'
import { toast } from '@/store/toastStore'
import type { AuthSession, LoginInput, SignupInput } from '@/types/auth'
import type { User } from '@/types/user'

interface AuthState {
  user: User | null
  onboardingComplete: boolean
  /** Persist the session across browser restarts (localStorage) or only this tab (sessionStorage). */
  remember: boolean
  signIn: (input: LoginInput & { remember: boolean }) => Promise<void>
  signUp: (input: SignupInput) => Promise<void>
  signInWithGoogle: () => Promise<void>
  completeOnboarding: () => Promise<void>
  signOut: () => void
  /** Name and photo go to PUT /api/me; an email change sends a Firebase confirmation link. Resolves false on failure. */
  updateUser: (patch: Partial<Pick<User, 'name' | 'email' | 'avatarUrl'>>) => Promise<boolean>
  deleteAccount: () => Promise<void>
  /** Re-reads the account after a reload; signs out locally if Firebase no longer has a session. */
  restore: () => Promise<void>
}

const rememberAwareStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name, value) => {
    const remember = (JSON.parse(value) as { state?: { remember?: boolean } }).state?.remember
    const [target, other] = remember ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
    target.setItem(name, value)
    other.removeItem(name)
  },
  removeItem: (name) => {
    localStorage.removeItem(name)
    sessionStorage.removeItem(name)
  },
}

const fromSession = (session: AuthSession, remember: boolean) => ({
  user: session.user,
  onboardingComplete: session.onboardingComplete,
  remember,
})

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      const clear = () => {
        useOnboardingStore.getState().reset()
        set({ user: null, onboardingComplete: false })
      }

      return {
        user: null,
        onboardingComplete: false,
        remember: true,
        signIn: async ({ remember, ...credentials }) => {
          set(fromSession(await authService.login(credentials, remember), remember))
        },
        signUp: async (input) => {
          set(fromSession(await authService.signup(input), true))
        },
        signInWithGoogle: async () => {
          set(fromSession(await authService.continueWithGoogle(), true))
        },
        completeOnboarding: async () => {
          if (!get().user) return
          await authService.markOnboardingComplete()
          set({ onboardingComplete: true })
        },
        signOut: () => {
          clear()
          void authService.logout().catch(() => undefined)
        },
        updateUser: async ({ email, ...patch }) => {
          const previous = get().user
          if (!previous) return false
          set({ user: { ...previous, ...patch } })
          try {
            const body: { name?: string; avatarUrl?: string | null } = {}
            if (patch.name !== undefined && patch.name !== previous.name) body.name = patch.name
            if ('avatarUrl' in patch && patch.avatarUrl !== previous.avatarUrl) body.avatarUrl = patch.avatarUrl ?? null
            if (Object.keys(body).length > 0) set({ user: await authService.updateAccount(body) })
            if (email !== undefined && email.trim().toLowerCase() !== previous.email) await authService.requestEmailChange(email.trim().toLowerCase())
            return true
          } catch (error) {
            set({ user: previous })
            toast.error('Couldn’t update your account', error instanceof Error ? error.message : undefined)
            return false
          }
        },
        deleteAccount: async () => {
          if (!get().user) return
          await authService.deleteAccount()
          clear()
        },
        restore: async () => {
          try {
            const session = await authService.restoreSession()
            if (session) set(fromSession(session, get().remember))
            else if (get().user) clear()
          } catch {
            // Offline or API down: keep the cached session; API calls will surface errors.
          }
        },
      }
    },
    {
      name: 'clave.auth',
      storage: createJSONStorage(() => rememberAwareStorage),
      partialize: ({ user, onboardingComplete, remember }) => ({ user, onboardingComplete, remember }),
    },
  ),
)

// Any 401 from the API (revoked or deleted account) ends the local session.
setUnauthenticatedHandler(() => {
  if (useAuthStore.getState().user) useAuthStore.getState().signOut()
})

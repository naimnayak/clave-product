import { create } from 'zustand'
import { getSubscription } from '@/services/subscription.service'
import type { Subscription } from '@/services/subscription.service'
import { useAuthStore } from '@/store/authStore'

interface SubscriptionState {
  /** The signed-in user's plan, from GET /api/subscriptions/current. */
  subscription: Subscription | null
  userId: string | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  load: (force?: boolean) => Promise<Subscription | null>
  set: (subscription: Subscription) => void
}

/** One shared copy of the plan so gated pages and the upgrade flow agree, refreshed after a payment. */
export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  userId: null,
  status: 'idle',
  load: async (force = false) => {
    const userId = useAuthStore.getState().user?.id ?? null
    const state = get()
    if (!userId) return null
    if (!force && state.userId === userId && (state.status === 'ready' || state.status === 'loading')) return state.subscription
    set({ status: 'loading', userId, subscription: state.userId === userId ? state.subscription : null })
    try {
      const subscription = await getSubscription()
      if (useAuthStore.getState().user?.id === userId) set({ subscription, status: 'ready' })
      return subscription
    } catch {
      set({ status: 'error' })
      return null
    }
  },
  set: (subscription) => set({ subscription, status: 'ready', userId: useAuthStore.getState().user?.id ?? null }),
}))

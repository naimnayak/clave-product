import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'

/**
 * The signed-in user's plan. `isPro` is null until it has loaded, so gated pages can wait instead of
 * flashing the wrong view.
 */
export function useSubscription() {
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const subscription = useSubscriptionStore((state) => (state.userId === userId ? state.subscription : null))
  const status = useSubscriptionStore((state) => (state.userId === userId ? state.status : 'idle'))
  const load = useSubscriptionStore((state) => state.load)

  useEffect(() => {
    if (userId) void load()
  }, [userId, load])

  return {
    subscription,
    status,
    isPro: subscription ? subscription.isPro : status === 'error' ? false : null,
    refresh: () => load(true),
  }
}

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { paths } from '@/routes/navigation'
import { useAuthStore } from '@/store/authStore'

/** Only signed-in users pass; everyone else goes to /login and returns here afterwards. */
export function RequireAuth() {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!user) {
    return <Navigate to={paths.login} replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  }
  return <Outlet />
}

/** App screens need a finished profile setup; otherwise send the user to onboarding. */
export function RequireOnboarding() {
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete)
  return onboardingComplete ? <Outlet /> : <Navigate to={paths.onboarding} replace />
}

/** Onboarding is only for users who haven't finished it. */
export function OnboardingOnly() {
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete)
  return onboardingComplete ? <Navigate to={paths.dashboard} replace /> : <Outlet />
}

/**
 * Login / signup / forgot-password. Signed-in users are redirected, which also
 * handles post-auth navigation: setup incomplete -> /onboarding, otherwise the
 * page they originally asked for (or /dashboard).
 */
export function GuestOnly() {
  const user = useAuthStore((state) => state.user)
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete)
  const location = useLocation()

  if (!user) return <Outlet />

  const from = (location.state as { from?: string } | null)?.from
  return <Navigate to={onboardingComplete ? (from ?? paths.dashboard) : paths.onboarding} replace />
}

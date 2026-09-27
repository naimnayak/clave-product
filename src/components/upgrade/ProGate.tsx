import type { ReactNode } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { useSubscription } from '@/hooks/useSubscription'

interface ProGateProps {
  /** Rendered for Free users. */
  fallback: ReactNode
  /** Rendered while the plan loads; defaults to a spinner. Pass null to render nothing. */
  loading?: ReactNode
  children: ReactNode
}

/** Renders Pro-only content once the plan is known, so Pro endpoints are never called for Free users. */
export function ProGate({ fallback, loading, children }: ProGateProps) {
  const { isPro } = useSubscription()
  if (isPro === null) return <>{loading === undefined ? <LoadingState label="Loading…" /> : loading}</>
  return <>{isPro ? children : fallback}</>
}

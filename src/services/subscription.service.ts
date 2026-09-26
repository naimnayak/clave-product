import { apiClient } from '@/services/apiClient'

/** GET /api/subscriptions/current: plan and resume allowance, enforced on the server. */
export interface Subscription {
  plan: 'free' | 'monthly'
  status: 'active' | 'expired'
  currentPeriodEnd: string | null
  resumesCreated: number
  resumesAllowance: number
  singleResumesBalance: number
  isUnlimited: boolean
  canCreateResume: boolean
}

export async function getSubscription(): Promise<Subscription> {
  return apiClient.get<Subscription>('/subscriptions/current')
}

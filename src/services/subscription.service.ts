import { apiClient } from '@/services/apiClient'

export interface PlanLimits {
  /** null = unlimited */
  resumes?: number | null
  aiDaily?: number | null
  chatDaily?: number | null
  mockInterviews?: number | null
}

export interface PlanFeatures {
  jobs?: boolean
  jobPreview?: boolean
  chatMemory?: boolean
}

/** GET /api/subscriptions/current: plan and allowances, enforced on the server. */
export interface Subscription {
  plan: 'free' | 'monthly'
  planName: string
  isPro: boolean
  status: 'active' | 'expired'
  currentPeriodEnd: string | null
  resumesCreated: number
  resumesAllowance: number
  singleResumesBalance: number
  isUnlimited: boolean
  canCreateResume: boolean
  limitsEnforced: boolean
  limits: PlanLimits
  features: PlanFeatures
  mockInterviewsUsed: number
}

/** GET /api/subscriptions/plans: the catalog stored in MongoDB (`plans` collection). */
export interface Plan {
  id: 'free' | 'single' | 'monthly'
  name: string
  price: number
  currency: string
  interval: 'month' | 'one_time' | null
  description: string
  periodDays?: number
  limits?: PlanLimits
  features?: PlanFeatures
}

export async function getSubscription(): Promise<Subscription> {
  return apiClient.get<Subscription>('/subscriptions/current')
}

export async function getPlans(): Promise<Record<string, Plan>> {
  return apiClient.get<Record<string, Plan>>('/subscriptions/plans')
}

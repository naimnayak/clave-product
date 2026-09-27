import { apiClient } from '@/services/apiClient'
import type { Plan } from '@/services/subscription.service'
import type { Resume } from '@/types/resume'

/** Typed client for /api/admin (backend/app/api/admin.py). */

export type StaffRole = 'admin' | 'support'
export type Permission = 'view' | 'support' | 'notes' | 'manage_users' | 'billing' | 'plans' | 'roles' | 'broadcast' | 'delete_users'

export interface AdminMe {
  uid: string
  email: string
  role: StaffRole
  owner: boolean
  permissions: Permission[]
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface DailyPoint {
  date: string
  value: number
}

export interface Overview {
  users: { total: number; new7d: number; new30d: number; active7d: number; suspended: number }
  subscriptions: { pro: number; proExpiring7d: number; comped: number; withCredits: number }
  revenue: { currency: string; thisMonth: number; allTime: number; paymentsThisMonth: number; refundedThisMonth: number }
  usage: { resumesTotal: number; resumes7d: number; aiActionsToday: number; chatMessagesToday: number; openChats: number; jobDescriptions: number }
  jobs: { active: number; apifyResultsThisMonth: number; apifyMonthlyLimit: number; apifyEstimatedCostUsd: number; feedEnabled: boolean }
  support: { openMessages: number; feedback7d: number }
  series: { signups: DailyPoint[]; revenue: DailyPoint[] }
}

export interface AdminUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  provider: string
  emailVerified: boolean
  role: 'user' | StaffRole
  owner: boolean
  status: 'active' | 'suspended'
  plan: 'free' | 'monthly'
  isPro: boolean
  proExpired: boolean
  currentPeriodEnd: string | null
  compedByAdmin: boolean
  singleResumesBalance: number
  resumesCreated: number
  onboardingComplete: boolean
  createdAt: string | null
  lastLoginAt: string | null
}

export interface AdminPayment {
  id: string
  uid: string
  userEmail: string | null
  plan: 'single' | 'monthly'
  amount: number
  currency: string
  status: 'created' | 'paid' | 'refunding' | 'refunded'
  paymentId: string | null
  refundId: string | null
  refundedAmount: number | null
  createdAt: string | null
  paidAt: string | null
  refundedAt: string | null
}

export interface AdminNote {
  id: string
  text: string
  authorEmail: string | null
  createdAt: string | null
}

export interface AuditEntry {
  id: string
  at: string | null
  actorEmail: string | null
  actorRole?: string
  action: string
  target?: string | null
  details: Record<string, unknown>
  ip?: string | null
}

export interface AdminUserDetail extends AdminUser {
  suspendedReason: string | null
  suspendedAt: string | null
  usage: Record<string, number>
  counts: Record<'resumes' | 'applications' | 'savedJobs' | 'jobDescriptions' | 'mockInterviews' | 'deviceClaims' | 'activeSessions', number>
  jobFeed: { lastRefreshAt: string | null; nextRefreshAt: string | null; scheduledLeft: number; jdSearchesLeft: number; queries: string[]; location: string; lastError: string | null } | null
  resumes: Resume[]
  payments: AdminPayment[]
  notes: AdminNote[]
  history: AuditEntry[]
}

export interface AdminPlan extends Plan {
  active: boolean
  updatedAt: string | null
}

export interface SupportMessage {
  id: string
  name: string
  email: string
  topic: string
  message: string
  status: 'new' | 'resolved'
  createdAt: string | null
  resolvedAt: string | null
  resolvedBy: string | null
}

export interface FeedbackItem {
  id: string
  uid: string | null
  email: string
  message: string
  page: string
  rating: number | null
  createdAt: string | null
}

export interface JobStats {
  active: number
  bySource: Record<string, number>
  feedEnabled: boolean
  linkedinEnabled: boolean
  sources: string[]
  apify: { resultsThisMonth: number; monthlyLimit: number; estimatedCostUsd: number }
  feedUsersThisMonth: number
  caps: { resultsPerSearch: number; refreshDays: number; scheduledPerMonth: number; jdSearchesPerMonth: number }
  recentIngestRuns: Array<{ startedAt: string | null; created: number; fetched: number; errors: string[] }>
  latestJobs: Array<{ id: string; title: string; company: string; source: string; active: boolean; postedAt: string | null }>
}

export type UserFilters = {
  q?: string
  plan?: 'pro' | 'free' | 'expired' | 'credits'
  status?: 'active' | 'suspended'
  role?: StaffRole
  sort?: 'newest' | 'oldest' | 'lastLogin' | 'name' | 'proEnd'
  page?: number
  limit?: number
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const text = search.toString()
  return text ? `?${text}` : ''
}

const u = (uid: string) => `/admin/users/${encodeURIComponent(uid)}`

export const adminApi = {
  me: () => apiClient.get<AdminMe>('/admin/me'),
  overview: () => apiClient.get<Overview>('/admin/overview'),

  users: (filters: UserFilters) => apiClient.get<Paged<AdminUser>>(`/admin/users${qs(filters)}`),
  exportUsers: (filters: UserFilters) =>
    apiClient.download(`/admin/users/export.csv${qs({ q: filters.q, plan: filters.plan, status: filters.status })}`, `clave-users-${new Date().toISOString().slice(0, 10)}.csv`),
  user: (uid: string) => apiClient.get<AdminUserDetail>(u(uid)),
  changeSubscription: (uid: string, body: { action: 'grant' | 'extend' | 'revoke'; days?: number; reason?: string }) =>
    apiClient.post<AdminUser>(`${u(uid)}/subscription`, body),
  changeCredits: (uid: string, delta: number, reason = '') => apiClient.post<AdminUser>(`${u(uid)}/credits`, { delta, reason }),
  resetUsage: (uid: string, what: 'resumes' | 'mockInterviews' | 'aiToday' | 'deviceClaims', reason = '') =>
    apiClient.post<AdminUser>(`${u(uid)}/reset`, { what, reason }),
  setStatus: (uid: string, status: 'active' | 'suspended', reason = '') => apiClient.post<AdminUser>(`${u(uid)}/status`, { status, reason }),
  setRole: (uid: string, role: 'user' | StaffRole) => apiClient.post<AdminUser>(`${u(uid)}/role`, { role }),
  addNote: (uid: string, text: string) => apiClient.post<AdminNote>(`${u(uid)}/notes`, { text }),
  deleteNote: (uid: string, noteId: string) => apiClient.delete(`${u(uid)}/notes/${encodeURIComponent(noteId)}`),
  notifyUser: (uid: string, body: { title: string; body: string; link?: string }) => apiClient.post(`${u(uid)}/notify`, body),
  refreshFeed: (uid: string) => apiClient.post<{ query?: string; created: number; errors: string[] }>(`${u(uid)}/refresh-feed`, {}, 120_000),
  deleteUser: (uid: string, confirmEmail: string, reason = '') => apiClient.post(`${u(uid)}/delete`, { confirmEmail, reason }),

  plans: () => apiClient.get<AdminPlan[]>('/admin/plans'),
  updatePlan: (id: string, body: Partial<Pick<AdminPlan, 'name' | 'description' | 'price' | 'periodDays' | 'active' | 'limits' | 'features'>>) =>
    apiClient.put<AdminPlan>(`/admin/plans/${id}`, body),

  payments: (filters: { status?: string; plan?: string; q?: string; page?: number; limit?: number }) =>
    apiClient.get<Paged<AdminPayment>>(`/admin/payments${qs(filters)}`),
  refund: (orderId: string, body: { amount?: number; revokePlan: boolean; reason: string }) =>
    apiClient.post<AdminPayment>(`/admin/payments/${encodeURIComponent(orderId)}/refund`, body, 60_000),

  jobStats: () => apiClient.get<JobStats>('/admin/jobs/stats'),
  setJobActive: (jobId: string, active: boolean) => apiClient.post(`/admin/jobs/${encodeURIComponent(jobId)}/active`, { active }),

  messages: (status: 'new' | 'resolved' | 'all', page = 1) => apiClient.get<Paged<SupportMessage>>(`/admin/support/messages${qs({ status, page })}`),
  setMessageStatus: (id: string, status: 'new' | 'resolved') => apiClient.post(`/admin/support/messages/${encodeURIComponent(id)}/status`, { status }),
  feedback: (page = 1) => apiClient.get<Paged<FeedbackItem>>(`/admin/support/feedback${qs({ page })}`),

  broadcast: (body: { title: string; body: string; link?: string; audience: 'all' | 'pro' | 'free' }) => apiClient.post<{ sent: number }>('/admin/broadcast', body, 60_000),

  audit: (filters: { action?: string; target?: string; page?: number }) => apiClient.get<Paged<AuditEntry>>(`/admin/audit${qs(filters)}`),
}

import { Briefcase, FileText, LayoutDashboard, MessagesSquare, Settings, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const paths = {
  landing: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  resumes: '/resumes',
  createResume: '/resumes/new',
  createWithAi: '/resumes/new/ai',
  tailorResume: '/resumes/new/tailor',
  createManual: '/resumes/new/manual',
  createFromTemplate: '/resumes/new/template',
  importResume: '/resumes/import',
  jobs: '/jobs',
  assistant: '/ai-assistant',
  mockInterview: '/ai-mock-interview',
  settings: '/settings',
  careerProfile: '/profile',
  account: '/account',
  guide: '/guide',
  upgrade: '/upgrade',
  contact: '/contact',
  howItWorks: '/how-it-works',
  pricing: '/pricing',
  about: '/about',
  admin: '/admin',
} as const

export const resumeEditRoute = '/resumes/:resumeId/edit'
export const resumePath = (id: string) => `/resumes/${encodeURIComponent(id)}/edit`
export const jobPath = (id: string) => `/jobs/${encodeURIComponent(id)}`

// ─── Back navigation ──────────────────────────────────────────────────────────

/** Router state for links that open a page with its own Back button: where to return to. */
export interface FromState {
  from?: string
}

type LocationLike = { pathname: string; search: string; hash: string; state?: unknown }

/** `state` for a Link/navigate call so the destination's Back returns to the current page. */
export const fromHere = (location: LocationLike): FromState => ({ from: `${location.pathname}${location.search}${location.hash}` })

/** Hook form of fromHere for components that render links. */
export const useFromHere = (): FromState => fromHere(useLocation())

/** Only same-app paths: never an external or protocol-relative URL. */
const isAppPath = (value: unknown): value is string => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')

/** Where Back should go from this location: the page that opened it, else the fallback. */
export function backTarget(location: LocationLike, fallback: string): string {
  const from = (location.state as FromState | null | undefined)?.from
  return isAppPath(from) ? from : fallback
}

/**
 * Back for in-app Back buttons. When this page was opened from another app page, step back through
 * history (so the browser's own Back button doesn't loop); otherwise go to the fallback, replacing the
 * current entry, e.g. after a deep link or a reload.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    const from = (location.state as FromState | null | undefined)?.from
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (isAppPath(from) && index > 0) navigate(-1)
    else navigate(backTarget(location, fallback), { replace: true })
  }, [fallback, location, navigate])
}

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const primaryNav: NavItem[] = [
  { label: 'Dashboard', path: paths.dashboard, icon: LayoutDashboard },
  { label: 'Resumes', path: paths.resumes, icon: FileText },
  { label: 'Jobs', path: paths.jobs, icon: Briefcase },
  { label: 'AI Assistant', path: paths.assistant, icon: Sparkles },
  { label: 'AI Mock Interview', path: paths.mockInterview, icon: MessagesSquare },
]

export const settingsNav: NavItem = { label: 'Settings', path: paths.settings, icon: Settings }

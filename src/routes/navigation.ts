import { Briefcase, FileText, LayoutDashboard, MessagesSquare, Settings, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
} as const

export const resumePath = (id: string) => `/resumes/${id}/edit`
export const jobPath = (id: string) => `/jobs/${id}`

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

/**
 * Facts every policy page relies on. Edit them here once and every page updates.
 * Fields left empty are simply not shown, so nothing is invented.
 */
export const legalInfo = {
  product: 'Clave',
  operator: 'Atelier Devs',
  /** Registered or postal address for legal notices. Required for the Grievance page under Indian IT Rules. */
  address: '',
  /** City whose courts have jurisdiction, e.g. "Mumbai, Maharashtra". */
  jurisdiction: '',
  grievanceOfficer: 'Grievance Officer',
  supportEmail: 'support@clave.app',
  generalEmail: 'hello@clave.app',
  website: 'clave.app',
  effectiveDate: 'September 26, 2026',
  lastUpdated: 'September 26, 2026',
  replyDays: 2,
  grievanceAckHours: 24,
  grievanceResolveDays: 15,
  uploadRetentionDays: 7,
  notificationRetentionDays: 90,
  sessionRetentionDays: 60,
  singlePrice: 49,
  monthlyPrice: 199,
  monthlyDays: 30,
} as const

export interface LegalPageLink {
  path: string
  title: string
  short: string
}

export const legalPages: LegalPageLink[] = [
  { path: '/legal/privacy', title: 'Privacy Policy', short: 'Privacy Policy' },
  { path: '/legal/terms', title: 'Terms of Service', short: 'Terms of Service' },
  { path: '/legal/cookies', title: 'Cookie & Local Storage Policy', short: 'Cookie Policy' },
  { path: '/legal/refunds', title: 'Refund & Cancellation Policy', short: 'Refunds & Cancellation' },
  { path: '/legal/acceptable-use', title: 'Acceptable Use Policy', short: 'Acceptable Use' },
  { path: '/legal/ai', title: 'AI Use Disclosure', short: 'AI Use Disclosure' },
  { path: '/legal/grievance', title: 'Grievance Redressal', short: 'Grievance Redressal' },
]

export const legalPaths = {
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  cookies: '/legal/cookies',
  refunds: '/legal/refunds',
  acceptableUse: '/legal/acceptable-use',
  ai: '/legal/ai',
  grievance: '/legal/grievance',
} as const

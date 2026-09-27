export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
  /** From Firebase Authentication. */
  emailVerified?: boolean
  /** Admin panel access: 'admin' (everything) or 'support' (read-only plus the support inbox). */
  role?: 'user' | 'support' | 'admin'
}

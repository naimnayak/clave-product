export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
  /** From Firebase Authentication. */
  emailVerified?: boolean
}

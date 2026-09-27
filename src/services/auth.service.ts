import { FirebaseError } from 'firebase/app'
import {
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  linkWithPopup,
  signInWithPopup,
  signOut,
  unlink,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { ApiError, apiClient, rotateSessionId } from '@/services/apiClient'
import type { AuthSession, LoginInput, SignupInput } from '@/types/auth'
import type { User } from '@/types/user'

/**
 * Sign-in runs through Firebase Authentication (project ats-resume-grader). After every sign-in the
 * backend is told via POST /api/auth/sync, which creates or refreshes the Clave account record.
 */
interface ApiUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  emailVerified: boolean
  onboardingComplete: boolean
  role?: User['role']
}

const toUser = (user: ApiUser): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl ?? undefined,
  emailVerified: user.emailVerified,
  role: user.role ?? 'user',
})

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in instead.',
  'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Can’t reach the sign-in service. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/cancelled-popup-request': 'Google sign-in was closed before it finished.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/account-exists-with-different-credential': 'This email is already registered with a password. Log in with email instead.',
  'auth/requires-recent-login': 'For your security, log out and back in before making this change.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/operation-not-allowed': 'This sign-in method isn’t enabled for Clave yet.',
  'auth/unauthorized-domain': 'This website isn’t authorized for sign-in yet.',
}

function friendly(error: unknown): Error {
  if (error instanceof FirebaseError) return new Error(MESSAGES[error.code] ?? 'Something went wrong. Please try again.')
  if (error instanceof Error) return error
  return new Error('Something went wrong. Please try again.')
}

async function syncSession(name?: string): Promise<AuthSession> {
  const result = await apiClient.post<{ user: ApiUser; onboardingComplete: boolean }>('/auth/sync', name ? { name } : {})
  return { user: toUser(result.user), onboardingComplete: result.onboardingComplete }
}

/** Signs in with Firebase, then syncs the account with the backend. */
async function withSync(signIn: () => Promise<unknown>, name?: string): Promise<AuthSession> {
  rotateSessionId()
  try {
    await signIn()
    return await syncSession(name)
  } catch (error) {
    // Don't leave a Firebase session behind when the backend rejected the sign-in.
    if (error instanceof ApiError) await signOut(auth).catch(() => undefined)
    throw friendly(error)
  }
}

export async function login({ email, password }: LoginInput, remember = true): Promise<AuthSession> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
  return withSync(() => signInWithEmailAndPassword(auth, email.trim(), password))
}

export async function signup({ name, email, password }: SignupInput): Promise<AuthSession> {
  await setPersistence(auth, browserLocalPersistence)
  return withSync(async () => {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(credential.user, { displayName: name.trim() })
    void sendEmailVerification(credential.user).catch(() => undefined)
  }, name.trim())
}

export async function continueWithGoogle(): Promise<AuthSession> {
  await setPersistence(auth, browserLocalPersistence)
  return withSync(() => signInWithPopup(auth, googleProvider))
}

/** Restores the backend session for a Firebase user who is already signed in (page reload). */
export async function restoreSession(): Promise<AuthSession | null> {
  await auth.authStateReady()
  return auth.currentUser ? syncSession() : null
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (error) {
    // Never reveal whether an account exists for this email.
    if (error instanceof FirebaseError && error.code === 'auth/user-not-found') return
    throw friendly(error)
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await apiClient.post('/me/onboarding')
}

export async function updateAccount(patch: { name?: string; avatarUrl?: string | null }): Promise<User> {
  return toUser(await apiClient.put<ApiUser>('/me', patch))
}

/** Firebase emails a confirmation link; the address changes once the user opens it. */
export async function requestEmailChange(newEmail: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Log in again to change your email.')
  try {
    await verifyBeforeUpdateEmail(auth.currentUser, newEmail)
  } catch (error) {
    throw friendly(error)
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) throw new Error('Log in again to change your password.')
  if (!user.providerData.some((provider) => provider.providerId === 'password')) {
    throw new Error('You sign in with Google, so there’s no Clave password to change.')
  }
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
    await updatePassword(user, newPassword)
    await reportPasswordChanged()
  } catch (error) {
    if (error instanceof FirebaseError && ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(error.code)) {
      throw new Error('Your current password is incorrect.')
    }
    throw friendly(error)
  }
}

export async function logout(): Promise<void> {
  // End this device's session on the server first (while the token is still valid), then sign out.
  if (auth.currentUser) await apiClient.post('/auth/logout').catch(() => undefined)
  await signOut(auth)
  rotateSessionId()
}

/** Deletes all Clave data and the Firebase login (server side), then clears the local session. */
export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/me')
  await signOut(auth).catch(() => undefined)
  rotateSessionId()
}

/** Tells the backend the password changed (security notification). */
export async function reportPasswordChanged(): Promise<void> {
  await apiClient.post('/me/security/password-changed').catch(() => undefined)
}

export function signInProviders(): string[] {
  return auth.currentUser?.providerData.map((provider) => provider.providerId) ?? []
}

/** Links Google to the signed-in account so either sign-in method works. */
export async function linkGoogle(): Promise<void> {
  if (!auth.currentUser) throw new Error('Log in again to connect Google.')
  try {
    await linkWithPopup(auth.currentUser, googleProvider)
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/credential-already-in-use') {
      throw new Error('That Google account is already used by another Clave account.')
    }
    if (error instanceof FirebaseError && error.code === 'auth/provider-already-linked') return
    throw friendly(error)
  }
}

/** Disconnects Google. Refused when it's the only way to sign in. */
export async function unlinkGoogle(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Log in again to disconnect Google.')
  if (!user.providerData.some((provider) => provider.providerId === 'password')) {
    throw new Error('Google is your only sign-in method. Set a password first (use “Forgot password” on the login page), then disconnect Google.')
  }
  try {
    await unlink(user, 'google.com')
  } catch (error) {
    throw friendly(error)
  }
}

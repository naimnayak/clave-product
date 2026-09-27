import { auth } from '@/lib/firebase'
import { toast } from '@/store/toastStore'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'

/**
 * Fetch wrapper for the FastAPI backend (backend/). Adds the Firebase ID token, unwraps the
 * `{ data }` envelope and turns `{ error: { code, message } }` responses into ApiError.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const DEFAULT_TIMEOUT_MS = 20_000
/** AI endpoints usually answer in 2-10 s; allow for slow models and retries. */
export const AI_TIMEOUT_MS = 90_000

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

let onUnauthenticated: (() => void) | null = null

/**
 * A random id per browser sign-in, sent as X-Clave-Session so Account → Active sessions can list and
 * sign out devices. It rotates on every sign-in and sign-out.
 */
const SESSION_KEY = 'clave.session-id'

export function sessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function rotateSessionId(): void {
  localStorage.setItem(SESSION_KEY, crypto.randomUUID())
}

/**
 * A random id for this browser that never rotates, sent as X-Clave-Device. The backend caps free resumes
 * per device (and per device + network), so other devices on the same Wi-Fi are never affected.
 */
const DEVICE_KEY = 'clave.device-id'

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return '' // storage blocked: the backend falls back to network + browser signature
  }
}

/** The auth store registers how to sign out when the backend rejects the session. */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  form?: FormData
  timeoutMs?: number
  /** Return the response body as a Blob (file downloads) instead of unwrapping JSON. */
  blob?: boolean
}

async function idToken(forceRefresh: boolean): Promise<string | null> {
  await auth.authStateReady()
  return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null
}

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, form, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  const headers: Record<string, string> = { 'X-Clave-Session': sessionId() }
  const device = deviceId()
  if (device) headers['X-Clave-Device'] = device
  const token = await idToken(retried)
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    })
  } catch {
    throw controller.signal.aborted
      ? new ApiError(0, 'TIMEOUT', 'This is taking longer than expected. Please try again.')
      : new ApiError(0, 'NETWORK_ERROR', 'Can’t reach Clave right now. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 204) return undefined as T
  if (options.blob && response.ok) return (await response.blob()) as T
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string; details?: unknown } } | null
  if (response.ok) return (payload?.data ?? null) as T

  const error = new ApiError(
    response.status,
    payload?.error?.code ?? 'ERROR',
    payload?.error?.message ?? `Request failed (${response.status}).`,
    payload?.error?.details,
  )
  // An expired token is refreshed once; any other auth failure ends the session.
  if (error.code === 'TOKEN_EXPIRED' && !retried) return request<T>(path, options, true)
  if (error.code === 'ACCOUNT_SUSPENDED') toast.error('Account suspended', error.message)
  if (response.status === 401) onUnauthenticated?.()
  // Actions the plan doesn't cover open the upgrade modal. Pro-only pages check the plan before loading,
  // so a background GET never pops the modal on its own.
  if (error.code === 'PLAN_LIMIT_REACHED' || (error.code === 'PRO_REQUIRED' && method !== 'GET')) {
    useUpgradeModalStore.getState().openUpgradeModal()
  }
  throw error
}

export const apiClient = {
  get: <T>(path: string, timeoutMs?: number) => request<T>(path, { timeoutMs }),
  post: <T>(path: string, body: unknown = {}, timeoutMs?: number) => request<T>(path, { method: 'POST', body, timeoutMs }),
  put: <T>(path: string, body: unknown, timeoutMs?: number) => request<T>(path, { method: 'PUT', body, timeoutMs }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
  /** GET a file and save it through the browser. */
  download: async (path: string, fileName: string) => {
    const blob = await request<Blob>(path, { blob: true, timeoutMs: 60_000 })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },
  upload: <T>(path: string, file: File, timeoutMs = 60_000) => {
    const form = new FormData()
    form.append('file', file)
    return request<T>(path, { method: 'POST', form, timeoutMs })
  },
}

/** A 404 from the API means "not there (for you)"; callers that expect null use this. */
export async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

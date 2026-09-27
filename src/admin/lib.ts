import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { AdminMe, Permission } from '@/admin/adminApi'
import { ApiError } from '@/services/apiClient'
import { toast } from '@/store/toastStore'

/** Admin panel hooks, context and formatters (kept apart from components for fast refresh). */

// ─── Staff context ──────────────────────────────────────────────────────────────

export const AdminContext = createContext<AdminMe | null>(null)

/** The signed-in staff member and a permission check (the server enforces the same rules). */
export function useAdmin() {
  const me = useContext(AdminContext)
  if (!me) throw new Error('useAdmin must be used inside the admin panel')
  return { me, can: (permission: Permission) => me.permissions.includes(permission) }
}

// ─── Data loading ───────────────────────────────────────────────────────────────

type Query<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: T }

/** Loads `load()` whenever `key` changes; `reload()` fetches again and keeps the old data on screen. */
export function useQuery<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<Query<T>>({ status: 'loading' })
  const loader = useRef(load)
  useEffect(() => {
    loader.current = load
  })
  const run = useCallback(() => {
    let active = true
    loader.current().then(
      (data) => active && setState({ status: 'success', data }),
      (error: unknown) => active && setState({ status: 'error', message: error instanceof Error ? error.message : 'Couldn’t load this.' }),
    )
    return () => {
      active = false
    }
  }, [])
  useEffect(() => run(), [run, key])
  return { state, reload: run }
}

/** Runs an admin action with a success toast, and an error toast instead of throwing. */
export async function act<T>(action: () => Promise<T>, success: string): Promise<T | undefined> {
  try {
    const result = await action()
    toast.success(success)
    return result
  } catch (error) {
    toast.error('That didn’t work', error instanceof ApiError || error instanceof Error ? error.message : undefined)
    return undefined
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────────

const inrFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const numberFormat = new Intl.NumberFormat('en-IN')

export const inr = (value: number) => inrFormat.format(value)
export const num = (value: number) => numberFormat.format(value)
export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export function ago(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days < 60 ? `${days} d ago` : date(iso)
}

export const tableClass = 'w-full text-left text-sm [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-medium [&_th]:text-secondary [&_td]:px-4 [&_td]:py-2.5 [&_tbody_tr]:border-t [&_tbody_tr]:border-border'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

/** Appearance is a per-device choice (Settings → General → Appearance), kept in localStorage. */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'light',
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'clave.theme' },
  ),
)

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export const resolveTheme = (preference: ThemePreference): 'light' | 'dark' =>
  preference === 'system' ? (darkQuery().matches ? 'dark' : 'light') : preference

/**
 * Marketing, legal and sign-in pages are designed for one look, so they always render light.
 * Keep in sync with the inline script in index.html that applies the theme before first paint.
 */
export const LIGHT_ONLY_PREFIXES = ['/login', '/signup', '/forgot-password', '/about', '/pricing', '/contact', '/how-it-works', '/legal']

export const isLightOnlyPath = (pathname: string) => pathname === '/' || LIGHT_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

export function applyTheme(preference: ThemePreference, pathname: string): void {
  const theme = isLightOnlyPath(pathname) ? 'light' : resolveTheme(preference)
  document.documentElement.dataset.theme = theme
}

export function watchSystemTheme(onChange: () => void): () => void {
  const query = darkQuery()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

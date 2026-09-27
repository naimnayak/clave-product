/**
 * Where the admin panel lives.
 *
 * Production sets VITE_ADMIN_HOST (e.g. admin.atelierdevs.tech): the panel is served at the root of that
 * host only, and /admin on the main site sends people there. Without it (local development) the panel
 * is at /admin on the same host. The API enforces the same split (ADMIN_HOST in backend/.env).
 */
export const ADMIN_HOST: string = (import.meta.env.VITE_ADMIN_HOST ?? '').trim().toLowerCase()

export const onAdminHost = ADMIN_HOST !== '' && window.location.hostname.toLowerCase() === ADMIN_HOST

const ADMIN_BASE = onAdminHost ? '' : '/admin'

/** A route inside the admin panel, e.g. adminPath('/users'). */
export const adminPath = (sub = '') => `${ADMIN_BASE}${sub}` || '/'

/** Where "Admin panel" links point from the main app. */
export const adminUrl = ADMIN_HOST ? `https://${ADMIN_HOST}` : '/admin'

/** The main Clave app, as seen from the admin host. */
export const mainAppUrl = onAdminHost ? `https://${ADMIN_HOST.replace(/^admin\./, '')}/dashboard` : '/dashboard'

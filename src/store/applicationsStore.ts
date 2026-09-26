import { create } from 'zustand'
import { listApplications, removeApplication, setApplicationStatus } from '@/services/applications.service'
import type { Application, ApplicationStatus } from '@/services/applications.service'
import { toast } from '@/store/toastStore'

interface ApplicationsState {
  /** userId -> (jobId -> application). Loaded from GET /api/applications once per visit. */
  byUser: Record<string, Record<string, Application>>
  loaded: Record<string, boolean>
  load: (userId: string) => Promise<void>
  setStatus: (userId: string, job: { id: string; title: string; company: string }, status: ApplicationStatus) => Promise<boolean>
  remove: (userId: string, jobId: string) => Promise<void>
}

/** Application tracker shared by the Jobs tabs and the job detail actions. Updates are optimistic. */
export const useApplicationsStore = create<ApplicationsState>((set, get) => {
  const put = (userId: string, next: Record<string, Application>) => set({ byUser: { ...get().byUser, [userId]: next } })

  return {
    byUser: {},
    loaded: {},
    load: async (userId) => {
      if (!userId || get().loaded[userId]) return
      set({ loaded: { ...get().loaded, [userId]: true } })
      try {
        const list = await listApplications()
        put(userId, Object.fromEntries(list.map((app) => [app.jobId, app])))
      } catch {
        set({ loaded: { ...get().loaded, [userId]: false } })
      }
    },
    setStatus: async (userId, job, status) => {
      const previous = get().byUser[userId] ?? {}
      const now = new Date().toISOString()
      const existing = previous[job.id]
      put(userId, {
        ...previous,
        [job.id]: { jobId: job.id, status, title: job.title, company: job.company, notes: existing?.notes ?? '', appliedAt: existing?.appliedAt ?? now, updatedAt: now },
      })
      try {
        const saved = await setApplicationStatus(job.id, status)
        put(userId, { ...(get().byUser[userId] ?? {}), [job.id]: saved })
        return true
      } catch {
        put(userId, previous)
        toast.error('Couldn’t update your application', 'Please try again.')
        return false
      }
    },
    remove: async (userId, jobId) => {
      const previous = get().byUser[userId] ?? {}
      const next = { ...previous }
      delete next[jobId]
      put(userId, next)
      try {
        await removeApplication(jobId)
      } catch {
        put(userId, previous)
        toast.error('Couldn’t remove it from your tracker', 'Please try again.')
      }
    },
  }
})

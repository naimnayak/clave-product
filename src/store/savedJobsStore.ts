import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSavedJobs, saveJob, unsaveJob } from '@/services/job.service'
import { toast } from '@/store/toastStore'

interface SavedJobsState {
  /** userId -> (jobId -> ISO date saved). A local copy of GET /api/jobs/saved. */
  byUser: Record<string, Record<string, string>>
  /** Users whose list was refreshed from the API during this visit. */
  loaded: Record<string, boolean>
  load: (userId: string) => Promise<void>
  toggle: (userId: string, jobId: string) => boolean
}

/** Saved jobs shared by the Dashboard and Jobs. Toggles update instantly and sync to the API. */
export const useSavedJobsStore = create<SavedJobsState>()(
  persist(
    (set, get) => {
      const put = (userId: string, saved: Record<string, string>) => set({ byUser: { ...get().byUser, [userId]: saved } })

      return {
        byUser: {},
        loaded: {},
        load: async (userId) => {
          if (!userId || get().loaded[userId]) return
          set({ loaded: { ...get().loaded, [userId]: true } })
          try {
            put(userId, await getSavedJobs())
          } catch {
            set({ loaded: { ...get().loaded, [userId]: false } })
          }
        },
        toggle: (userId, jobId) => {
          const previous = get().byUser[userId] ?? {}
          const next = { ...previous }
          const nowSaved = !(jobId in next)
          if (nowSaved) next[jobId] = new Date().toISOString()
          else delete next[jobId]
          put(userId, next)
          ;(nowSaved ? saveJob(jobId) : unsaveJob(jobId)).catch(() => {
            put(userId, previous)
            toast.error(nowSaved ? 'Couldn’t save this job' : 'Couldn’t remove this job', 'Please try again.')
          })
          return nowSaved
        },
      }
    },
    { name: 'clave.saved-jobs', partialize: ({ byUser }) => ({ byUser }) },
  ),
)

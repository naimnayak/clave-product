import { useEffect, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useSavedJobsStore } from '@/store/savedJobsStore'
import { toast } from '@/store/toastStore'
import type { Job } from '@/types/job'

const none: Record<string, string> = {}

export function useSavedJobs() {
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const stored = useSavedJobsStore((state) => state.byUser[userId])
  const load = useSavedJobsStore((state) => state.load)
  const toggleInStore = useSavedJobsStore((state) => state.toggle)
  const saved = stored ?? none

  useEffect(() => {
    void load(userId)
  }, [load, userId])

  return useMemo(
    () => ({
      /** jobId -> ISO date saved */
      saved,
      isSaved: (jobId: string) => jobId in saved,
      toggle: (job: Job) => {
        if (toggleInStore(userId, job.id)) toast.success('Job saved', `${job.title} at ${job.company}`)
      },
    }),
    [saved, toggleInStore, userId],
  )
}

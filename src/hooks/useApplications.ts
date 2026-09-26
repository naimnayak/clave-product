import { useEffect, useMemo } from 'react'
import type { Application } from '@/services/applications.service'
import { useApplicationsStore } from '@/store/applicationsStore'
import { useAuthStore } from '@/store/authStore'

const none: Record<string, Application> = {}

export function useApplications() {
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const stored = useApplicationsStore((state) => state.byUser[userId])
  const load = useApplicationsStore((state) => state.load)
  const setStatus = useApplicationsStore((state) => state.setStatus)
  const remove = useApplicationsStore((state) => state.remove)
  const applications = stored ?? none

  useEffect(() => {
    void load(userId)
  }, [load, userId])

  return useMemo(
    () => ({
      /** jobId -> application */
      applications,
      setStatus: (job: { id: string; title: string; company: string }, status: Application['status']) => setStatus(userId, job, status),
      remove: (jobId: string) => remove(userId, jobId),
    }),
    [applications, remove, setStatus, userId],
  )
}

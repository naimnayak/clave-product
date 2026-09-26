import { apiClient } from '@/services/apiClient'

export type ApplicationStatus = 'applied' | 'interviewing' | 'rejected'

export interface Application {
  jobId: string
  status: ApplicationStatus
  title: string
  company: string
  notes: string
  appliedAt: string
  updatedAt: string
}

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  interviewing: 'Interviewing',
  rejected: 'Not selected',
}

export const listApplications = () => apiClient.get<Application[]>('/applications')

export const setApplicationStatus = (jobId: string, status: ApplicationStatus) =>
  apiClient.put<Application>(`/applications/${encodeURIComponent(jobId)}`, { status })

export const removeApplication = (jobId: string) => apiClient.delete(`/applications/${encodeURIComponent(jobId)}`)

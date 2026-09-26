import { apiClient } from '@/services/apiClient'
import type { Resume } from '@/types/resume'

/** Resume library (GET/PATCH/DELETE /api/resumes). Each mutation returns the updated list. */

export async function listResumes(): Promise<Resume[]> {
  return apiClient.get<Resume[]>('/resumes')
}

export async function renameResume(id: string, name: string): Promise<Resume[]> {
  await apiClient.patch(`/resumes/${encodeURIComponent(id)}`, { name })
  return listResumes()
}

export async function duplicateResume(id: string): Promise<Resume[]> {
  await apiClient.post(`/resumes/${encodeURIComponent(id)}/duplicate`)
  return listResumes()
}

export async function deleteResume(id: string): Promise<Resume[]> {
  await apiClient.delete(`/resumes/${encodeURIComponent(id)}`)
  return listResumes()
}

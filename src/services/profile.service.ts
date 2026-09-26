import { apiClient } from '@/services/apiClient'
import type { ProfileData } from '@/types/profile'
import { emptyProfile } from '@/utils/profile'

/** Career Profile (GET/PUT /api/profile). The backend identifies the user from the auth token. */

/** Fills fields added after a profile was saved so older records still render. */
const normalize = (data: ProfileData): ProfileData => ({ ...emptyProfile(), ...data })

export async function getProfile(): Promise<ProfileData | null> {
  const data = await apiClient.get<ProfileData | null>('/profile')
  return data ? normalize(data) : null
}

export async function saveProfile(data: ProfileData): Promise<void> {
  await apiClient.put('/profile', data)
}

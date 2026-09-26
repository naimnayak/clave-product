import { apiClient } from '@/services/apiClient'

export interface AppNotification {
  id: string
  category: 'jobs' | 'resumes' | 'applications' | 'product' | 'account'
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
}

export const listNotifications = () => apiClient.get<{ items: AppNotification[]; unreadCount: number }>('/notifications')

/** Marks the given notifications as read, or all of them when `ids` is empty. */
export const markNotificationsRead = (ids: string[] = []) => apiClient.post<{ unreadCount: number }>('/notifications/read', { ids })

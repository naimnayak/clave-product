import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatReply {
  reply: string
  suggestedActions: string[]
  /** Whether the Career Profile was used (Settings → Privacy → Personalize AI). */
  personalized: boolean
}

export interface AiUsage {
  limit: number
  used: number
}

/** POST /api/ai/chat with the recent conversation so replies stay in context. */
export async function sendChat(message: string, history: ChatTurn[]): Promise<ChatReply> {
  return apiClient.post<ChatReply>('/ai/chat', { message, history: history.slice(-12) }, AI_TIMEOUT_MS)
}

export async function getAiUsage(): Promise<AiUsage> {
  return apiClient.get<AiUsage>('/ai/usage')
}

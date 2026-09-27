import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatMessage extends ChatTurn {
  id: string
  suggestions: string[]
  createdAt: string | null
}

/**
 * The open conversation, stored on the server so it continues across days and devices. It closes 48 hours
 * after it starts (or on "New chat"); its key points are then kept as the assistant's memory.
 */
export interface ChatSession {
  id: string
  messages: ChatMessage[]
  personalized: boolean
  createdAt: string | null
  closesAt: string | null
}

export interface ChatReply {
  reply: string
  suggestedActions: string[]
  /** Whether the user's profile, resume and memory were used (Settings → Privacy → Personalize AI). */
  personalized: boolean
  session: ChatSession
}

export interface AiUsage {
  /** AI actions (generation, tailoring, rewrites, interviews) */
  limit: number
  used: number
  /** Assistant messages, counted separately */
  chatLimit: number
  chatUsed: number
  isPro: boolean
}

export interface AssistantMemory {
  facts: string[]
  summary: string
  updatedAt: string | null
}

export async function getChatSession(): Promise<ChatSession | null> {
  return apiClient.get<ChatSession | null>('/ai/chat/session')
}

/** POST /api/ai/chat. The server keeps the history; only the new message is sent. */
export async function sendChat(message: string): Promise<ChatReply> {
  return apiClient.post<ChatReply>('/ai/chat', { message }, AI_TIMEOUT_MS)
}

/** "New chat": closes the open conversation (its key points are remembered). */
export async function endChatSession(): Promise<void> {
  await apiClient.post('/ai/chat/session/end', {}, AI_TIMEOUT_MS)
}

export async function getAiUsage(): Promise<AiUsage> {
  return apiClient.get<AiUsage>('/ai/usage')
}

export async function getAssistantMemory(): Promise<AssistantMemory> {
  return apiClient.get<AssistantMemory>('/ai/memory')
}

export async function clearAssistantMemory(): Promise<void> {
  await apiClient.delete('/ai/memory')
}

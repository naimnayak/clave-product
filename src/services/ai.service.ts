import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'

export type AiAction = 'improve' | 'rewrite' | 'concise' | 'impact'

export const aiActionLabels: Record<AiAction, string> = {
  improve: 'Improve wording',
  rewrite: 'Rewrite',
  concise: 'Make more concise',
  impact: 'Add measurable impact',
}

interface AiContext {
  role?: string
  skills?: string[]
  /** Summaries are prose; bullets get action-verb treatment. */
  kind?: 'summary'
}

/**
 * POST /api/ai/transform (AI model). The backend keeps every fact, never invents numbers ("impact" adds
 * a [placeholder] instead), and drafts a summary from the role and skills when the text is empty.
 */
export async function transformText(text: string, action: AiAction, context: AiContext = {}): Promise<string> {
  const result = await apiClient.post<{ text: string }>(
    '/ai/transform',
    { text, action, context: { role: context.role ?? '', skills: context.skills ?? [], kind: context.kind ?? null } },
    AI_TIMEOUT_MS,
  )
  return result.text
}

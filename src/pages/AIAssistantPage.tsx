import { ArrowUp, BriefcaseBusiness, FileText, HelpCircle, RotateCcw, Sparkles, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { CapabilityCard } from '@/components/assistant/CapabilityCard'
import { FormattedReply } from '@/components/assistant/FormattedReply'
import { Button } from '@/components/ui/Button'
import { linkStyles } from '@/components/ui/linkStyles'
import { LoadingState } from '@/components/ui/LoadingState'
import { paths } from '@/routes/navigation'
import { ApiError } from '@/services/apiClient'
import { endChatSession, getAiUsage, getChatSession, sendChat } from '@/services/assistant.service'
import type { AiUsage, ChatSession, ChatTurn } from '@/services/assistant.service'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'

const capabilities = [
  {
    icon: HelpCircle,
    title: 'Ask Career Questions',
    description: 'Get answers grounded in your career profile, experience, and goals.',
    prompts: ['What skills should I learn for product roles?', 'How can I switch to a UI/UX career?', 'What do recruiters look for in my profile?'],
  },
  {
    icon: FileText,
    title: 'Improve Your Resume',
    description: 'Get suggestions for stronger bullets, summaries, skills, and job-specific content.',
    prompts: ['How can I make my experience sound stronger?', 'Which skills should my resume highlight?', 'How do I make my resume ATS-friendly?'],
  },
  {
    icon: BriefcaseBusiness,
    title: 'Understand Opportunities',
    description: 'Break down job descriptions and understand how they connect to your profile.',
    prompts: ['Which roles fit my profile best?', 'How do I read a job description quickly?', 'How should I prepare for my next interview?'],
  },
]

interface Message extends ChatTurn {
  id: string
  suggestions?: string[]
}

const toMessages = (session: ChatSession | null): Message[] =>
  (session?.messages ?? []).map(({ id, role, content, suggestions }) => ({ id, role, content, suggestions }))

/**
 * AI career assistant. The conversation lives on the server: it carries on across days and devices for
 * 48 hours, then its key points become the assistant's memory for the next conversation.
 */
export function AIAssistantPage() {
  const firstName = useAuthStore((state) => state.user?.name.split(' ')[0] ?? '')
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingSession, setLoadingSession] = useState(true)
  const [closesAt, setClosesAt] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<{ message: string; retry?: string }>()
  const [usage, setUsage] = useState<AiUsage | null>(null)
  const [personalized, setPersonalized] = useState<boolean | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let active = true
    getAiUsage().then((value) => active && setUsage(value), () => undefined)
    getChatSession()
      .then((session) => {
        if (!active) return
        setMessages(toMessages(session))
        setClosesAt(session?.closesAt ?? null)
        if (session) setPersonalized(session.personalized)
      })
      .catch(() => undefined)
      .finally(() => active && setLoadingSession(false))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const ask = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || sending) return
      setError(undefined)
      setDraft('')
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: message }])
      setSending(true)
      try {
        const reply = await sendChat(message)
        setPersonalized(reply.personalized)
        setMessages(toMessages(reply.session))
        setClosesAt(reply.session.closesAt)
        setUsage((current) => (current ? { ...current, chatUsed: current.chatUsed + 1 } : current))
      } catch (err) {
        setMessages((current) => current.slice(0, -1))
        setDraft(message)
        setError({
          message: err instanceof ApiError ? err.message : 'The assistant couldn’t answer right now. Please try again.',
          retry: err instanceof ApiError && err.code === 'AI_DAILY_LIMIT_REACHED' ? undefined : message,
        })
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    },
    [sending],
  )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void ask(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void ask(draft)
    }
  }

  const reset = async () => {
    setResetting(true)
    try {
      await endChatSession()
      setMessages([])
      setClosesAt(null)
      setError(undefined)
    } catch {
      setError({ message: 'Couldn’t start a new chat. Please try again.' })
    } finally {
      setResetting(false)
      inputRef.current?.focus()
    }
  }

  const remaining = usage ? Math.max(0, usage.chatLimit - usage.chatUsed) : null
  const continuesUntil = closesAt ? new Date(closesAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null
  const last = messages[messages.length - 1]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-deep uppercase shadow-xs">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            AI Career Assistant
          </p>
          <h1 className="mt-3 font-editorial text-3xl font-medium tracking-tight text-text sm:text-4xl">
            Your career, <span className="text-primary">with more clarity.</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-secondary">
            Ask about resumes, job search, career direction or interviews. When{' '}
            <Link to={`${paths.settings}#privacy`} className={linkStyles}>Personalize AI</Link> is on, answers use your{' '}
            <Link to={paths.careerProfile} className={linkStyles}>Career Profile</Link>, resumes, applications and what you’ve told the assistant before.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            loading={resetting}
            disabled={sending}
            leadingIcon={<RotateCcw className="size-4" />}
            onClick={() => void reset()}
            title="Ends this conversation. The assistant keeps its key points in memory."
          >
            New chat
          </Button>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <section aria-label="Conversation" className="flex min-h-[520px] flex-col rounded-large border border-border bg-surface shadow-card lg:h-[calc(100dvh-230px)]">
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
            {loadingSession ? (
              <LoadingState label="Opening your conversation…" />
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-default icon-tile">
                  <Sparkles className="size-6" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="mt-4 text-lg font-semibold text-text">{firstName ? `Hi ${firstName}, how can I help?` : 'How can I help?'}</p>
                <p className="mt-1 max-w-sm text-sm text-secondary">Pick a question on the right or ask your own.</p>
              </div>
            ) : (
              <ol className="flex flex-col gap-5">
                {messages.map((message) => (
                  <li key={message.id} className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}>
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        message.role === 'user' ? 'bg-chip text-secondary' : 'icon-tile',
                      )}
                    >
                      {message.role === 'user' ? <UserRound className="size-4" /> : <Sparkles className="size-4" />}
                    </span>
                    <div className={cn('max-w-[85%] text-sm leading-relaxed', message.role === 'user' ? 'rounded-default bg-primary px-4 py-2.5 text-on-primary' : 'text-text')}>
                      <span className="sr-only">{message.role === 'user' ? 'You said:' : 'Assistant:'}</span>
                      {message.role === 'user' ? <p className="whitespace-pre-wrap">{message.content}</p> : <FormattedReply text={message.content} />}
                    </div>
                  </li>
                ))}
                {sending && (
                  <li className="flex gap-3">
                    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full icon-tile">
                      <Sparkles className="size-4" />
                    </span>
                    <p className="flex items-center gap-1 pt-1.5 text-sm text-secondary" role="status">
                      Thinking
                      <span className="inline-flex gap-0.5" aria-hidden>
                        <span className="size-1 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
                        <span className="size-1 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
                        <span className="size-1 animate-bounce rounded-full bg-muted" />
                      </span>
                    </p>
                  </li>
                )}
              </ol>
            )}
            {!sending && last?.role === 'assistant' && last.suggestions && last.suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 pl-11" aria-label="Suggested follow-ups">
                {last.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-secondary transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-border p-3 sm:p-4">
            {error && (
              <p role="alert" className="mb-2 flex flex-wrap items-center gap-2 rounded-control border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
                {error.message}
                {error.retry && (
                  <button type="button" onClick={() => void ask(error.retry!)} className="font-medium underline">
                    Try again
                  </button>
                )}
              </p>
            )}
            <div className="flex items-end gap-2 rounded-default border border-border bg-background p-2 focus-within:border-primary">
              <label htmlFor="assistant-input" className="sr-only">
                Ask the assistant
              </label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about your resume, a job, or your next step…"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none"
              />
              <Button type="submit" size="sm" loading={sending} disabled={!draft.trim()} aria-label="Send message">
                <ArrowUp className="size-4" aria-hidden />
              </Button>
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted">
              <span>
                AI can make mistakes. Check important details.
                {continuesUntil ? ` This chat continues until ${continuesUntil}, then the assistant remembers the key points.` : ''}
              </span>
              {remaining !== null && <span>{remaining} message{remaining === 1 ? '' : 's'} left today</span>}
            </p>
          </form>
        </section>

        <aside aria-label="Things you can ask" className="flex flex-col gap-4">
          {capabilities.map((capability) => (
            <CapabilityCard key={capability.title} {...capability} onPick={(prompt) => void ask(prompt)} disabled={sending} />
          ))}
          {personalized === false && (
            <p className="text-xs text-secondary">
              Answers aren’t using your Career Profile.{' '}
              <Link to={`${paths.settings}#privacy`} className={linkStyles}>Turn on Personalize AI</Link> for advice about you.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

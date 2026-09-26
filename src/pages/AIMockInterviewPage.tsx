import { ArrowRight, CheckCircle2, ChevronDown, CircleAlert, History, Lightbulb, MessagesSquare, RotateCcw, Target, Trash2, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Select } from '@/components/ui/Select'
import { TagInput } from '@/components/ui/TagInput'
import { Textarea } from '@/components/ui/Textarea'
import { ApiError } from '@/services/apiClient'
import { answerQuestion, deleteInterview, getInterview, listInterviews, startInterview } from '@/services/interview.service'
import type { InterviewEvaluation, InterviewSession } from '@/services/interview.service'
import { getProfile } from '@/services/profile.service'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/relativeTime'

const LEVELS = [
  ['internship', 'Internship'],
  ['entry', 'Entry level (0–1 yrs)'],
  ['junior', 'Junior (1–3 yrs)'],
  ['mid', 'Mid level (3–5 yrs)'],
] as const
const PROFILE_LEVEL: Record<string, string> = { student: 'internship', fresher: 'entry', early: 'junior', experienced: 'mid' }
const LENGTHS = [3, 5, 8]

const scoreTone = (score: number) => (score >= 75 ? 'text-primary' : score >= 55 ? 'text-warning' : 'text-error')
const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : 'Something went wrong. Please try again.')

function ScoreRing({ score, size = 'lg' }: { score: number; size?: 'lg' | 'sm' }) {
  const radius = size === 'lg' ? 34 : 18
  const circumference = 2 * Math.PI * radius
  const box = (radius + 6) * 2
  return (
    <div className="relative shrink-0" style={{ width: box, height: box }} role="img" aria-label={`Score ${score} out of 100`}>
      <svg width={box} height={box} className="-rotate-90">
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" strokeWidth={size === 'lg' ? 7 : 4} className="stroke-border" />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={size === 'lg' ? 7 : 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className={cn('transition-all duration-700', score >= 75 ? 'stroke-primary' : score >= 55 ? 'stroke-warning' : 'stroke-error')}
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center font-semibold tabular-nums', size === 'lg' ? 'text-xl' : 'text-xs', scoreTone(score))}>{score}</span>
    </div>
  )
}

function Feedback({ evaluation }: { evaluation: InterviewEvaluation }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={evaluation.score} />
        <p className="text-sm leading-relaxed text-secondary">{evaluation.summary}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
            <CheckCircle2 className="size-4 text-primary" aria-hidden /> What worked
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-secondary">
            {evaluation.whatWorked.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
            <TrendingUp className="size-4 text-warning" aria-hidden /> What to improve
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-secondary">
            {evaluation.improvementPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/** Setup form plus recent practice sessions. */
function Setup({ onStarted, onOpen }: { onStarted: (session: InterviewSession) => void; onOpen: (id: string) => void }) {
  const [role, setRole] = useState('')
  const [level, setLevel] = useState<string>('entry')
  const [skills, setSkills] = useState<string[]>([])
  const [length, setLength] = useState(5)
  const [roleError, setRoleError] = useState<string>()
  const [starting, setStarting] = useState(false)
  const [recent, setRecent] = useState<InterviewSession[] | null>(null)

  useEffect(() => {
    getProfile().then(
      (profile) => {
        if (!profile) return
        setRole((current) => current || profile.targetRoles[0] || '')
        if (profile.experienceLevel) setLevel(PROFILE_LEVEL[profile.experienceLevel] ?? 'entry')
        setSkills((current) => (current.length ? current : profile.skills.slice(0, 3)))
      },
      () => undefined,
    )
    listInterviews().then(setRecent, () => setRecent([]))
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!role.trim()) return setRoleError('Tell us which role you’re interviewing for.')
    setRoleError(undefined)
    setStarting(true)
    try {
      onStarted(await startInterview({ role: role.trim(), level, focusSkills: skills, totalQuestions: length }))
    } catch (error) {
      toast.error('Couldn’t start the interview', errorMessage(error))
      setStarting(false)
    }
  }

  const remove = async (id: string) => {
    setRecent((current) => current?.filter((s) => s.sessionId !== id) ?? null)
    await deleteInterview(id).catch(() => toast.error('Couldn’t delete that session'))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Card padding="none" className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-text">Set up your practice interview</h2>
        <p className="mt-1 text-sm text-secondary">An AI interviewer asks one question at a time and gives feedback on every answer.</p>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
          <Input label="Role" placeholder="e.g. Frontend Developer" value={role} onChange={(e) => setRole(e.target.value)} error={roleError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select label="Questions" value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {LENGTHS.map((n) => (
                <option key={n} value={n}>
                  {n} questions (about {n * 3} min)
                </option>
              ))}
            </Select>
          </div>
          <TagInput label="Skills to focus on (optional)" hint="Press Enter after each one." placeholder="e.g. React" value={skills} onChange={setSkills} />
          <div>
            <Button type="submit" size="lg" loading={starting}>
              Start interview
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
      </Card>

      <aside aria-label="Recent practice" className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-text">
          <History className="size-4 text-muted" aria-hidden /> Recent practice
        </p>
        {recent === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-secondary">Your practice sessions will appear here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((session) => (
              <li key={session.sessionId} className="flex items-center gap-3 rounded-default border border-border bg-surface p-3">
                {session.answeredCount > 0 ? <ScoreRing score={session.overallScore} size="sm" /> : <span className="flex size-12 shrink-0 items-center justify-center text-xs text-muted">—</span>}
                <button type="button" onClick={() => onOpen(session.sessionId)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-text">{session.role}</p>
                  <p className="text-xs text-secondary">
                    {session.completed ? 'Completed' : `${session.answeredCount} of ${session.totalQuestions} answered`} · {formatRelativeTime(session.createdAt)}
                  </p>
                </button>
                <button type="button" aria-label={`Delete ${session.role} practice`} onClick={() => void remove(session.sessionId)} className="rounded-control p-1.5 text-muted hover:bg-background hover:text-error">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

function Active({ session, onUpdate, onFinish }: { session: InterviewSession; onUpdate: (s: InterviewSession) => void; onFinish: () => void }) {
  const questions = session.questions ?? []
  const answers = session.answers ?? []
  // The question being answered is the first without an answer; after answering, show that answer's feedback.
  const [viewing, setViewing] = useState(Math.min(answers.length, questions.length - 1))
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPoints, setShowPoints] = useState(false)
  const [error, setError] = useState<string>()

  const question = questions[viewing]
  const answered = answers[viewing]
  const isLast = viewing + 1 >= session.totalQuestions

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (answer.trim().length < 10) return setError('Write a fuller answer (at least a sentence) to get useful feedback.')
    setError(undefined)
    setSubmitting(true)
    try {
      const updated = await answerQuestion(session.sessionId, answer.trim())
      onUpdate(updated)
      setAnswer('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    setShowPoints(false)
    if (isLast) onFinish()
    else setViewing((v) => v + 1)
  }

  if (!question) return <LoadingState label="Preparing your next question…" />

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          Question <span className="font-semibold text-text">{viewing + 1}</span> of {session.totalQuestions} · {session.role}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: session.totalQuestions }, (_, i) => (
            <span key={i} className={cn('h-1 w-6 rounded-full', i < answers.length ? 'bg-primary' : i === viewing ? 'bg-primary/40' : 'bg-border')} />
          ))}
        </div>
      </div>

      <Card padding="none" className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {question.category && <Badge variant="primary">{question.category}</Badge>}
          {question.difficulty && <Badge>{question.difficulty}</Badge>}
        </div>
        <h2 className="mt-3 text-lg leading-snug font-semibold text-text">{question.question}</h2>

        {answered ? (
          <div className="mt-5 flex flex-col gap-5">
            <div className="rounded-default bg-background p-4">
              <p className="text-xs font-semibold text-muted uppercase">Your answer</p>
              <p className="mt-1.5 text-sm whitespace-pre-wrap text-text">{answered.answer}</p>
            </div>
            <Feedback evaluation={answered.evaluation} />
            {question.expectedKeyPoints.length > 0 && (
              <div>
                <button type="button" aria-expanded={showPoints} onClick={() => setShowPoints((v) => !v)} className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <Lightbulb className="size-4" aria-hidden />
                  What a strong answer covers
                  <ChevronDown className={cn('size-4 transition-transform', showPoints && 'rotate-180')} aria-hidden />
                </button>
                {showPoints && (
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-secondary">
                    {question.expectedKeyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div>
              <Button onClick={next}>
                {isLast ? 'See your results' : 'Next question'}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-3">
            <Textarea
              label="Your answer"
              hint="Answer as you would out loud. Use an example from your experience where you can."
              rows={8}
              maxLength={5000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              error={error}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={submitting}>
                Submit answer
              </Button>
              <span className="text-xs text-muted">{submitting ? 'The AI interviewer is reviewing your answer…' : `${answer.trim().split(/\s+/).filter(Boolean).length} words`}</span>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}

function Results({ session, onRestart }: { session: InterviewSession; onRestart: () => void }) {
  const answers = session.answers ?? []
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Card padding="none" className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
        <ScoreRing score={session.overallScore} />
        <h2 className="text-xl font-semibold text-text">Interview complete</h2>
        <p className="max-w-md text-sm text-secondary">
          {session.role} · {answers.length} question{answers.length === 1 ? '' : 's'}. Review the feedback below, then practice again to build confidence.
        </p>
        <Button leadingIcon={<RotateCcw className="size-4" />} onClick={onRestart} className="mt-2">
          Practice again
        </Button>
      </Card>
      <ol className="flex flex-col gap-4">
        {answers.map((row) => (
          <li key={row.questionIndex}>
            <Card padding="none" className="p-5">
              <p className="text-xs font-semibold text-muted uppercase">Question {row.questionIndex}</p>
              <p className="mt-1 text-sm font-semibold text-text">{row.question}</p>
              <div className="mt-4">
                <Feedback evaluation={row.evaluation} />
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** AI mock interview: set up → answer questions one by one with feedback → results. ?session=<id> resumes one. */
export function AIMockInterviewPage() {
  const [params, setParams] = useSearchParams()
  const sessionId = params.get('session')
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [finished, setFinished] = useState(false)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    if (!sessionId || session?.sessionId === sessionId) return
    let active = true
    setLoadError(undefined)
    getInterview(sessionId).then(
      (loaded) => {
        if (!active) return
        setSession(loaded)
        setFinished(loaded.completed)
      },
      (error: unknown) => active && setLoadError(errorMessage(error)),
    )
    return () => {
      active = false
    }
  }, [sessionId, session?.sessionId])

  const open = useCallback((id: string) => setParams({ session: id }), [setParams])
  const restart = () => {
    setSession(null)
    setFinished(false)
    setParams({})
  }

  let body
  if (!sessionId) {
    body = (
      <Setup
        onStarted={(started) => {
          setSession(started)
          setFinished(false)
          setParams({ session: started.sessionId })
        }}
        onOpen={open}
      />
    )
  } else if (loadError) {
    body = (
      <Card padding="none" className="flex items-start gap-3 p-5 text-sm text-error">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p>{loadError}</p>
          <button type="button" onClick={restart} className="mt-2 font-medium underline">Start a new interview</button>
        </div>
      </Card>
    )
  } else if (!session) {
    body = <LoadingState label="Opening your interview…" />
  } else if (finished && session.completed) {
    body = <Results session={session} onRestart={restart} />
  } else {
    body = <Active key={session.sessionId} session={session} onUpdate={setSession} onFinish={() => setFinished(true)} />
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-deep uppercase shadow-xs">
            <MessagesSquare className="size-3.5 text-primary" aria-hidden />
            AI Mock Interview
          </p>
          <h1 className="mt-3 font-editorial text-3xl font-medium tracking-tight text-text sm:text-4xl">
            Practice before you <span className="text-primary">walk in.</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-secondary">Realistic questions for the role you want, with feedback on clarity, structure and relevance after every answer.</p>
        </div>
        {sessionId && (
          <Button variant="secondary" size="sm" leadingIcon={<Target className="size-4" />} onClick={restart}>
            New interview
          </Button>
        )}
      </header>
      {body}
    </div>
  )
}

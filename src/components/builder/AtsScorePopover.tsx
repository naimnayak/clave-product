import { ChevronDown, Sparkles, TrendingUp } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { reviewResume } from '@/services/atsReview.service'
import type { AtsReview } from '@/services/atsReview.service'
import type { AtsResult } from '@/utils/ats'
import { cn } from '@/utils/cn'

const scoreColor = (score: number) =>
  score >= 80 ? { text: 'text-primary', bg: 'bg-primary', ring: 'ring-primary/20', light: 'bg-primary/8' }
  : score >= 65 ? { text: 'text-warning', bg: 'bg-warning', ring: 'ring-warning/20', light: 'bg-warning/8' }
  : { text: 'text-error', bg: 'bg-error', ring: 'ring-error/20', light: 'bg-error/8' }

const REVIEW_FACTORS: Array<[keyof AtsReview['factors'], string]> = [
  ['keywordMatch', 'Keyword match'],
  ['skillsMatch', 'Skills match'],
  ['experienceMatch', 'Experience relevance'],
  ['formatting', 'Formatting'],
  ['sectionCompleteness', 'Section completeness'],
]

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="mt-1.5 h-1 rounded-full bg-border" aria-hidden>
      <div className={cn('h-full rounded-full transition-all duration-300', className ?? 'bg-primary/60')} style={{ width: `${value}%` }} />
    </div>
  )
}

interface Props {
  result: AtsResult
  /** Enables the AI review, which analyzes the saved resume. */
  resumeId?: string
  /** Runs before the AI review so it sees the latest edits (the editor saves first). */
  beforeReview?: () => Promise<unknown>
}

export function AtsScorePopover({ result, resumeId, beforeReview }: Props) {
  const [open, setOpen] = useState(false)
  const [jobDescription, setJobDescription] = useState('')
  const [showJd, setShowJd] = useState(false)
  const [review, setReview] = useState<AtsReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const jdId = useId()
  const colors = scoreColor(result.total)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const runReview = async () => {
    if (!resumeId) return
    setReviewing(true)
    setError('')
    try {
      await beforeReview?.()
      setReview(await reviewResume(resumeId, jobDescription.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI review didn’t work this time. Please try again.')
    } finally {
      setReviewing(false)
    }
  }

  const reviewColors = review ? scoreColor(review.score) : colors

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-control border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-background',
          open ? 'bg-background' : 'bg-surface',
        )}
      >
        <TrendingUp className={cn('size-3.5 shrink-0', colors.text)} aria-hidden />
        <span className="hidden text-secondary sm:inline">ATS</span>
        <span className={cn('font-semibold tabular-nums', colors.text)}>
          {result.total}
          <span className="font-normal text-muted">/100</span>
        </span>
        <ChevronDown className={cn('size-3.5 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="ATS score breakdown"
          className="absolute right-0 z-30 mt-2 max-h-[calc(100dvh-96px)] w-88 max-w-[calc(100vw-32px)] overflow-y-auto rounded-default border border-border bg-surface p-4 shadow-popover"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text">ATS Score</p>
            <span className={cn('rounded-full px-3 py-1 text-sm font-bold tabular-nums', colors.light, colors.text)}>{result.total}/100</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-border" aria-hidden>
            <div className={cn('h-full rounded-full transition-all duration-500', colors.bg)} style={{ width: `${result.total}%` }} />
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {result.factors.map((factor) => (
              <li key={factor.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text">{factor.label}</span>
                  <span className="tabular-nums text-secondary">{factor.score}%</span>
                </div>
                <Bar value={factor.score} />
                <p className="mt-1 text-xs text-secondary">{factor.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">An instant estimate based on general best practices. It updates as you type.</p>

          {resumeId && (
            <div className="mt-4 border-t border-border pt-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                  <Sparkles className="size-3.5 text-primary" aria-hidden />
                  AI review
                </p>
                {review && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums', reviewColors.light, reviewColors.text)}>{review.score}/100</span>}
              </div>

              {!review && (
                <p className="mt-1 text-xs text-secondary">An AI model reads your resume the way an ATS and a recruiter would, and suggests what to fix.</p>
              )}

              <button type="button" onClick={() => setShowJd((v) => !v)} className="mt-2 text-xs font-medium text-primary hover:underline" aria-expanded={showJd} aria-controls={jdId}>
                {showJd ? 'Hide job description' : 'Compare with a job description (optional)'}
              </button>
              {showJd && (
                <textarea
                  id={jdId}
                  aria-label="Job description"
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  maxLength={10000}
                  rows={4}
                  placeholder="Paste the job description…"
                  className="mt-2 w-full resize-y rounded-control border border-border bg-background px-3 py-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-none"
                />
              )}

              <Button size="sm" variant={review ? 'secondary' : 'primary'} loading={reviewing} onClick={runReview} className="mt-3 w-full">
                {review ? 'Run the review again' : 'Get AI review'}
              </Button>
              {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}

              {review && (
                <div className="mt-4 flex flex-col gap-4">
                  {review.summary && <p className="text-sm text-secondary">{review.summary}</p>}
                  <ul className="flex flex-col gap-2.5">
                    {REVIEW_FACTORS.map(([key, label]) => (
                      <li key={key}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-text">{label}</span>
                          <span className="tabular-nums text-secondary">{review.factors[key]}%</span>
                        </div>
                        <Bar value={review.factors[key]} />
                      </li>
                    ))}
                  </ul>
                  {review.missingKeywords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text">Missing keywords</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {review.missingKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-warning/30 bg-warning/8 px-2 py-0.5 text-xs text-warning">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-muted">Add only the ones you genuinely have.</p>
                    </div>
                  )}
                  {review.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-text">Suggestions</p>
                      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs text-secondary">
                        {review.suggestions.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

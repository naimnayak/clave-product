import { Check, Sparkles } from 'lucide-react'
import type { Job } from '@/types/job'
import type { MatchReasons } from '@/utils/jobMatchReasons'

export function MatchSection({ job, reasons }: { job: Job; reasons: MatchReasons }) {
  return (
    <section aria-labelledby="match-title" className="flex items-start gap-4 rounded-large border border-primary/25 bg-linear-to-br from-primary/20 via-primary/12 to-primary/6 p-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-default bg-surface text-primary shadow-xs ring-1 ring-primary/20">
        <Sparkles className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 id="match-title" className="font-editorial text-xl font-medium tracking-tight text-text">
          Why this role matches you
        </h2>
        <p className="mt-1 text-sm text-secondary">
          {job.matchPercent >= 85 ? 'Your Career Profile aligns strongly with the core skills required for this role.' : 'Your Career Profile lines up well with several skills this role asks for.'}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Matching skills">
          {reasons.matchingSkills.map((skill) => (
            <li key={skill} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-surface px-3 py-1 text-[13px] font-medium text-primary-deep">
              <Check className="size-3.5 text-primary" strokeWidth={2.5} aria-hidden />
              {skill}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

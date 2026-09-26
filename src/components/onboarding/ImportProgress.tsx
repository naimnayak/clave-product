import { Check, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/utils/cn'

interface ImportProgressProps {
  stages: string[]
  current: string
  detail?: string
}

/** Calm, simulated progress: finished steps get a check, the active one spins. */
export function ImportProgress({ stages, current, detail }: ImportProgressProps) {
  const activeIndex = Math.max(stages.indexOf(current), 0)

  return (
    <Card padding="none" className="p-6 sm:p-8">
      <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-lg font-semibold text-text">{current}</p>
        {detail && <p className="mt-1 text-sm text-secondary">{detail}</p>}
      </div>
      <ol className="mx-auto mt-6 flex max-w-xs flex-col gap-2.5">
        {stages.map((stage, index) => (
          <li
            key={stage}
            className={cn('flex items-center gap-3 text-sm', index > activeIndex ? 'text-muted' : 'text-secondary')}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full',
                index < activeIndex ? 'bg-primary text-on-primary' : 'border border-border',
              )}
              aria-hidden
            >
              {index < activeIndex && <Check className="size-3" strokeWidth={3} />}
            </span>
            {stage}
          </li>
        ))}
      </ol>
    </Card>
  )
}

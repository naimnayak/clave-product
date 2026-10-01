import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { createPaths } from '@/components/resumes/createPaths'
import { useFromHere } from '@/routes/navigation'
import { cn } from '@/utils/cn'

interface ResumeCreationChoiceProps {
  /** "detailed" also shows what each path does before the editor opens. */
  variant?: 'compact' | 'detailed'
  /** Tighter tiles for the library header. */
  compact?: boolean
  className?: string
}

/** The four creation paths. Each leads to its own preparation flow, not straight to the editor. */
export function ResumeCreationChoice({ variant = 'compact', compact, className }: ResumeCreationChoiceProps) {
  // Each flow's Back returns here (the library or the Create a Resume page).
  const from = useFromHere()
  return (
    <ul className={cn('grid gap-3', className)}>
      {createPaths.map(({ id, title, description, flow, to, icon: Icon, featured }) => (
        <li key={id}>
          <Link
            to={to}
            state={from}
            className={cn(
              'group flex h-full rounded-default border transition-all hover:-translate-y-px hover:shadow-card',
              compact ? 'flex-col items-start gap-2.5 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-3.5' : 'items-center gap-4 p-4',
              featured ? 'border-primary/30 bg-tint shadow-xs hover:border-primary/60' : 'border-border bg-surface shadow-xs hover:border-primary/40',
            )}
          >
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-control', featured ? 'bg-brand text-on-primary shadow-brand' : 'icon-tile')}>
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-text">
                {title}
                {featured && <Badge variant="primary">AI</Badge>}
              </span>
              <span className="mt-1 block text-xs leading-snug text-secondary">{description}</span>
              {variant === 'detailed' && <span className="mt-2 block text-xs text-muted">{flow}</span>}
            </span>
            {!compact && (
              <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text" aria-hidden />
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

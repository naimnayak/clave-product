import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'match'

const variants: Record<BadgeVariant, { badge: string; dot: string }> = {
  neutral: { badge: 'bg-chip text-secondary ring-1 ring-inset ring-border', dot: 'bg-muted' },
  primary: { badge: 'bg-primary/10 text-primary-deep ring-1 ring-inset ring-primary/20', dot: 'bg-primary' },
  success: { badge: 'bg-success/10 text-success ring-1 ring-inset ring-success/20', dot: 'bg-success' },
  warning: { badge: 'bg-warning/10 text-warning ring-1 ring-inset ring-warning/20', dot: 'bg-warning' },
  error: { badge: 'bg-error/10 text-error ring-1 ring-inset ring-error/20', dot: 'bg-error' },
  info: { badge: 'bg-info/10 text-info ring-1 ring-inset ring-info/20', dot: 'bg-info' },
  match: { badge: 'bg-brand font-semibold text-on-primary shadow-xs', dot: 'bg-white' },
}

interface BadgeProps {
  variant?: BadgeVariant
  dot?: boolean
  className?: string
  children: ReactNode
}

export function Badge({ variant = 'neutral', dot, className, children }: BadgeProps) {
  const styles = variants[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        styles.badge,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', styles.dot)} aria-hidden />}
      {children}
    </span>
  )
}

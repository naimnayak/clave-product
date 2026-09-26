import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'tint' | 'ghost' | 'destructive' | 'inverse' | 'outlineDark'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-all duration-160 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 aria-busy:cursor-progress'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-primary shadow-brand hover:brightness-95 active:brightness-90',
  tint: 'border border-primary/25 bg-primary/5 text-primary-deep hover:bg-primary/10',
  inverse: 'bg-white text-primary-deep shadow-sm hover:bg-white/90',
  outlineDark: 'border border-white/20 bg-white/5 text-white hover:bg-white/10',
  secondary: 'border border-border bg-surface text-text shadow-xs hover:border-primary/30 hover:bg-tint',
  ghost: 'text-secondary hover:bg-text/5 hover:text-text',
  destructive: 'bg-error text-white shadow-xs hover:bg-error-deep',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

const iconOnlySizes: Record<ButtonSize, string> = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
}

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Square, padding-free button for a lone icon. */
  iconOnly?: boolean
}

/** Shared with anchors/router links so a link can look exactly like a Button. */
export function buttonStyles({ variant = 'primary', size = 'md', fullWidth, iconOnly }: ButtonStyleOptions = {}) {
  return cn(base, variants[variant], (iconOnly ? iconOnlySizes : sizes)[size], fullWidth && 'w-full')
}

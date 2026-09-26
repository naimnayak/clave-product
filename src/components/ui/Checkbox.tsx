import { Check } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { cn } from '@/utils/cn'

interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  label: string
  description?: string
}

export function Checkbox({ label, description, className, disabled, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-0.5 flex size-4 shrink-0">
        <input
          type="checkbox"
          disabled={disabled}
          className="peer size-4 cursor-[inherit] appearance-none rounded-[4px] border border-muted bg-surface transition-colors checked:border-primary checked:bg-primary hover:border-secondary checked:hover:bg-primary-deep"
          {...props}
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto size-3 text-on-primary opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden
        />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-text">{label}</span>
        {description && <span className="text-sm text-secondary">{description}</span>}
      </span>
    </label>
  )
}

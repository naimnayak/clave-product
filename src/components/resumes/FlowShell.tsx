import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { useFlowNavStore } from '@/store/flowNavStore'

interface FlowShellProps {
  title: string
  description?: string
  step?: { current: number; total: number; label: string }
  /** Use the editorial serif for the title (sparingly, for the main statement of a screen). */
  editorial?: boolean
  children: ReactNode
  /** @deprecated – kept for compatibility */
  backTo?: string
  /** Custom back handler for this step. If omitted, Navbar Back navigates to previous page. */
  onBack?: () => void
}

/** Shared frame for the creation flows: step indicator, title, and content. */
export function FlowShell({ title, description, step, editorial, children, onBack }: FlowShellProps) {
  const setBackHandler = useFlowNavStore((s) => s.setBackHandler)

  useEffect(() => {
    setBackHandler(onBack ?? null)
    return () => {
      setBackHandler(null)
    }
  }, [onBack, setBackHandler])
  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className={
              editorial
                ? 'font-editorial text-3xl font-medium tracking-tight text-text sm:text-4xl'
                : 'text-2xl font-semibold tracking-tight text-text sm:text-3xl'
            }
          >
            {title}
          </h1>
          {description && <p className="mt-1.5 max-w-3xl text-[15px] text-secondary">{description}</p>}
        </div>

        {step && (
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={step.total}
            aria-valuenow={step.current}
            aria-valuetext={`Step ${step.current} of ${step.total}: ${step.label}`}
            className="flex items-center gap-2.5 shrink-0 pt-1.5"
          >
            <span className="text-xs text-secondary">
              Step {step.current} of {step.total} <span aria-hidden>·</span> {step.label}
            </span>
            <span className="flex gap-1.5" aria-hidden>
              {Array.from({ length: step.total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-[3.5px] w-5 rounded-full transition-colors',
                    i < step.current ? 'bg-primary' : 'bg-border'
                  )}
                />
              ))}
            </span>
          </div>
        )}
      </header>

      {children}
    </div>
  )
}

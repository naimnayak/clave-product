import { X } from 'lucide-react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Field } from '@/components/ui/Field'

interface TagInputProps {
  label?: string
  /** Accessible name when the visible label lives outside the field. */
  ariaLabel?: string
  hint?: string
  error?: string
  placeholder?: string
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

/** Type and press Enter or comma to add; Backspace on an empty field removes the last tag. */
export function TagInput({ label, ariaLabel, hint, error, placeholder, value, onChange, className }: TagInputProps) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const tag = raw.trim()
    setDraft('')
    if (!tag || value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(control) => (
        <div
          className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-control border bg-surface px-2 py-1.5 transition-colors focus-within:ring-2 ${
            error
              ? 'border-error focus-within:ring-error/20'
              : 'border-border hover:border-muted focus-within:border-primary focus-within:ring-primary/20'
          }`}
        >
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pr-1 pl-2.5 text-sm text-primary-deep"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((existing) => existing !== tag))}
                className="flex size-5 items-center justify-center rounded-full hover:bg-primary/15"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <input
            {...control}
            aria-label={ariaLabel}
            value={draft}
            placeholder={value.length === 0 ? placeholder : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => add(draft)}
            className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-text outline-none placeholder:text-muted"
          />
        </div>
      )}
    </Field>
  )
}

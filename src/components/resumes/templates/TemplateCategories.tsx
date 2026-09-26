import { templateCategories } from '@/mocks/templates.mock'
import { cn } from '@/utils/cn'

export type CategoryFilter = (typeof templateCategories)[number]

/** Pill filters; scrolls sideways on narrow screens. */
export function TemplateCategories({ value, onChange }: { value: CategoryFilter; onChange: (value: CategoryFilter) => void }) {
  return (
    <div role="group" aria-label="Template categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {templateCategories.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={value === category}
          onClick={() => onChange(category)}
          className={cn(
            'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            value === category ? 'bg-brand text-on-primary shadow-xs' : 'border border-border bg-surface text-text hover:border-primary/30',
          )}
        >
          {category}
        </button>
      ))}
    </div>
  )
}

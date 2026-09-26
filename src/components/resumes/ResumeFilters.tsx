import { ArrowUpDown, LayoutGrid, List } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { cn } from '@/utils/cn'

export type ResumeFilter = 'all' | 'base' | 'tailored' | 'draft' | 'recent'
export type ResumeSort = 'updated' | 'ats' | 'name'
export type ResumeView = 'grid' | 'list'

const filterLabels: Record<ResumeFilter, string> = { all: 'All', base: 'Base', tailored: 'Tailored', draft: 'Drafts', recent: 'Recently Updated' }

interface Props {
  filter: ResumeFilter
  onFilter: (filter: ResumeFilter) => void
  sort: ResumeSort
  onSort: (sort: ResumeSort) => void
  view: ResumeView
  onView: (view: ResumeView) => void
}

export function ResumeFilters({ filter, onFilter, sort, onSort, view, onView }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Filter resumes" className="flex flex-wrap items-center gap-2">
        {(Object.keys(filterLabels) as ResumeFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === value ? 'bg-brand text-on-primary shadow-xs' : 'border border-border bg-surface text-text hover:border-primary/30',
            )}
          >
            {filterLabels[value]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div role="group" aria-label="Layout" className="flex rounded-control bg-chip p-1 ring-1 ring-inset ring-border">
          {(
            [
              ['grid', LayoutGrid, 'Grid view'],
              ['list', List, 'List view'],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={view === value}
              onClick={() => onView(value)}
              className={cn('flex size-8 items-center justify-center rounded-[8px] transition-colors', view === value ? 'bg-surface text-primary shadow-xs' : 'text-muted hover:text-text')}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-secondary">
          <ArrowUpDown className="size-4 text-muted" aria-hidden />
          <span className="hidden sm:inline">Sort by:</span>
          <Select aria-label="Sort resumes" value={sort} onChange={(event) => onSort(event.target.value as ResumeSort)} className="w-40">
            <option value="updated">Last Updated</option>
            <option value="ats">ATS score</option>
            <option value="name">Name</option>
          </Select>
        </div>
      </div>
    </div>
  )
}

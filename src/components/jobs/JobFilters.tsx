import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { ALL, countActiveFilters, defaultFilters, experienceOptions, minMatchOptions, postedOptions, workTypeLabels } from '@/utils/jobFilters'
import type { JobFilterValues } from '@/utils/jobFilters'

interface FilterSelectProps {
  label: string
  allLabel: string
  value: string
  options: Array<string | [string, string]>
  onChange: (value: string) => void
  /** Hide the visible label (the row of controls is self-explanatory). */
  bare?: boolean
}

function FilterSelect({ label, allLabel, value, options, onChange, bare }: FilterSelectProps) {
  return (
    <Select {...(bare ? { 'aria-label': label } : { label })} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value={ALL}>{allLabel}</option>
      {options.map((option) => {
        const [optionValue, text] = Array.isArray(option) ? option : [option, option]
        return (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        )
      })}
    </Select>
  )
}

const workTypeOptions = Object.entries(workTypeLabels) as Array<[string, string]>
const modalKeys: Array<keyof JobFilterValues> = ['posted', 'minMatch']

function FiltersModal({ values, onApply, onClose }: { values: JobFilterValues; onApply: (v: JobFilterValues) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(values)
  const set = (patch: Partial<JobFilterValues>) => setDraft((current) => ({ ...current, ...patch }))

  return (
    <Modal
      open
      onClose={onClose}
      title="More filters"
      footer={
        <>
          <Button variant="ghost" onClick={() => setDraft({ ...draft, ...Object.fromEntries(modalKeys.map((key) => [key, defaultFilters[key]])) })}>
            Clear
          </Button>
          <Button
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            Apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FilterSelect label="Posted" allLabel="Any time" value={draft.posted} options={postedOptions} onChange={(posted) => set({ posted })} />
        <FilterSelect label="Minimum match" allLabel="Any match" value={draft.minMatch} options={minMatchOptions} onChange={(minMatch) => set({ minMatch })} />
      </div>
    </Modal>
  )
}

interface JobFiltersProps {
  filters: JobFilterValues
  onChange: (filters: JobFilterValues) => void
  /** Cities offered in the "All locations" menu. */
  locations: string[]
  /** Role families offered in the "All roles" menu. */
  roles: string[]
}

/** Role / Location / Experience / Work type, plus More filters. */
export function JobFilters({ filters, onChange, locations, roles }: JobFiltersProps) {
  const [open, setOpen] = useState(false)
  const set = (patch: Partial<JobFilterValues>) => onChange({ ...filters, ...patch })
  const moreCount = countActiveFilters({ ...defaultFilters, posted: filters.posted, minMatch: filters.minMatch })

  return (
    <>
      <FilterSelect bare label="Role" allLabel="All roles" value={filters.role} options={roles} onChange={(role) => set({ role })} />
      <Select aria-label="Location" value={filters.location} onChange={(event) => set({ location: event.target.value })}>
        <option value="">All locations</option>
        {locations.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </Select>
      <FilterSelect bare label="Experience" allLabel="Any experience" value={filters.experience} options={experienceOptions} onChange={(experience) => set({ experience })} />
      <FilterSelect bare label="Work type" allLabel="Any work type" value={filters.workType} options={workTypeOptions} onChange={(workType) => set({ workType })} />
      <Button variant="secondary" leadingIcon={<SlidersHorizontal className="size-4" />} onClick={() => setOpen(true)}>
        More filters
        {moreCount > 0 && <Badge variant="primary">{moreCount}</Badge>}
      </Button>
      {open && <FiltersModal values={filters} onApply={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}

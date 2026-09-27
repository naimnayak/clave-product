import { Save } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { adminApi } from '@/admin/adminApi'
import type { AdminPlan } from '@/admin/adminApi'
import { act, dateTime, useAdmin, useQuery } from '@/admin/lib'
import { PageHeader } from '@/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Toggle } from '@/components/ui/Toggle'
import type { PlanFeatures, PlanLimits } from '@/services/subscription.service'

const LIMITS: Array<[keyof PlanLimits, string, string]> = [
  ['resumes', 'Resumes (lifetime)', 'Saved resumes, uploads included.'],
  ['aiDaily', 'AI actions per day', 'Generation, tailoring, ATS, rewrites, interviews.'],
  ['chatDaily', 'Assistant messages per day', 'Career assistant chat.'],
  ['mockInterviews', 'Mock interviews', 'Sessions a user can start.'],
]

const FEATURES: Array<[keyof PlanFeatures, string]> = [
  ['jobs', 'Personal job feed'],
  ['jobPreview', 'Jobs preview (top 3, company hidden)'],
  ['chatMemory', 'Assistant memory'],
]

export function PlansPage() {
  const { state, reload } = useQuery(adminApi.plans, 'plans')
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plans & pricing"
        description="Changes apply immediately: new prices to new checkouts, limits to everyone on the plan. Every change is in the audit log."
      />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <EmptyState title="Couldn’t load plans" description={state.message} />}
      {state.status === 'success' && (
        <div className="grid gap-4 xl:grid-cols-3">
          {state.data.map((plan) => (
            <PlanEditor key={`${plan.id}-${plan.updatedAt}`} plan={plan} onSaved={reload} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Limits are edited as text so an empty box means "unlimited" (null). */
const toText = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

function PlanEditor({ plan, onSaved }: { plan: AdminPlan; onSaved: () => void }) {
  const { can } = useAdmin()
  const editable = can('plans')
  const [name, setName] = useState(plan.name)
  const [description, setDescription] = useState(plan.description)
  const [price, setPrice] = useState(String(plan.price))
  const [periodDays, setPeriodDays] = useState(String(plan.periodDays ?? 30))
  const [active, setActive] = useState(plan.active)
  const [limits, setLimits] = useState<Record<string, string>>(Object.fromEntries(LIMITS.map(([key]) => [key, toText(plan.limits?.[key])])))
  const [features, setFeatures] = useState<PlanFeatures>({ jobs: false, jobPreview: true, chatMemory: true, ...plan.features })
  const [saving, setSaving] = useState(false)
  const hasLimits = plan.id !== 'single'

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const body: Parameters<typeof adminApi.updatePlan>[1] = { name, description, price: Number(price), active }
    if (plan.id === 'monthly') body.periodDays = Number(periodDays)
    if (hasLimits) {
      body.limits = Object.fromEntries(Object.entries(limits).map(([key, value]) => [key, value.trim() === '' ? null : Number(value)])) as PlanLimits
      body.features = features
    }
    setSaving(true)
    const saved = await act(() => adminApi.updatePlan(plan.id, body), `${name} saved`)
    setSaving(false)
    if (saved) onSaved()
  }

  return (
    <Card padding="none" className="flex flex-col overflow-hidden shadow-none">
      <form onSubmit={(event) => void save(event)} className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text">{plan.name}</h2>
            <Badge>{plan.id}</Badge>
            {!plan.active && <Badge variant="warning">Hidden</Badge>}
          </div>
          <span className="text-xs text-muted">Updated {dateTime(plan.updatedAt)}</span>
        </div>

        <fieldset disabled={!editable} className="flex flex-1 flex-col gap-4 px-4 py-4">
          <Input label="Name" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
          <Input label="Description" maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (₹)"
              type="number"
              min={plan.id === 'free' ? 0 : 1}
              max={plan.id === 'free' ? 0 : 100000}
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              hint={plan.id === 'single' ? 'One-time, per resume' : plan.id === 'monthly' ? 'One-time, per period' : 'Always free'}
            />
            {plan.id === 'monthly' && (
              <Input label="Period (days)" type="number" min={1} max={366} required value={periodDays} onChange={(event) => setPeriodDays(event.target.value)} />
            )}
          </div>

          {hasLimits && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-wide text-secondary uppercase">Limits (empty = unlimited)</p>
              {LIMITS.map(([key, label, hint]) => (
                <Input
                  key={key}
                  label={label}
                  hint={hint}
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={limits[key]}
                  onChange={(event) => setLimits((current) => ({ ...current, [key]: event.target.value }))}
                />
              ))}
              <p className="mt-1 text-xs font-semibold tracking-wide text-secondary uppercase">Features</p>
              {FEATURES.map(([key, label]) => (
                <Toggle key={key} label={label} checked={Boolean(features[key])} disabled={!editable} onChange={(checked) => setFeatures((current) => ({ ...current, [key]: checked }))} />
              ))}
            </div>
          )}

          {plan.id !== 'free' && <Toggle label="Available to buy" checked={active} disabled={!editable} onChange={setActive} />}
        </fieldset>

        {editable && (
          <div className="border-t border-border px-4 py-3">
            <Button type="submit" size="sm" loading={saving} leadingIcon={<Save className="size-4" />}>
              Save {plan.name}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

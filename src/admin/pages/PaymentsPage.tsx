import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminApi } from '@/admin/adminApi'
import { adminPath } from '@/admin/host'
import type { AdminPayment } from '@/admin/adminApi'
import { act, dateTime, inr, tableClass, useAdmin, useQuery } from '@/admin/lib'
import { Pagination, PageHeader, StatusBadge, TableScroll } from '@/admin/ui'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

export function PaymentsPage() {
  const { can } = useAdmin()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [refunding, setRefunding] = useState<AdminPayment | null>(null)
  const filters = { status: params.get('status') ?? '', plan: params.get('plan') ?? '', q: params.get('q') ?? '', page: Number(params.get('page') ?? 1) || 1, limit: 25 }
  const { state, reload } = useQuery(() => adminApi.payments(filters), JSON.stringify(filters))

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Payments" description="Every Razorpay order. Pending orders were opened but never paid." />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          set('q', search.trim())
        }}
        className="grid gap-2.5 sm:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]"
      >
        <SearchInput label="Search payments" placeholder="Email, order ID or payment ID, then Enter" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select aria-label="Status" value={filters.status} onChange={(event) => set('status', event.target.value)}>
          <option value="">Any status</option>
          <option value="paid">Paid</option>
          <option value="created">Pending</option>
          <option value="refunded">Refunded</option>
        </Select>
        <Select aria-label="Plan" value={filters.plan} onChange={(event) => set('plan', event.target.value)}>
          <option value="">Any plan</option>
          <option value="monthly">Clave Pro</option>
          <option value="single">Single resume</option>
        </Select>
      </form>

      <Card padding="none" className="overflow-hidden shadow-none">
        {state.status === 'loading' && <LoadingState />}
        {state.status === 'error' && <EmptyState title="Couldn’t load payments" description={state.message} />}
        {state.status === 'success' && (
          <>
            {state.data.items.length === 0 ? (
              <EmptyState title="No payments" description="Payments appear here once Razorpay is connected and users check out." />
            ) : (
              <TableScroll>
                <table className={tableClass}>
                  <thead className="bg-background/60">
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">User</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Order / payment</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((payment) => (
                      <tr key={payment.id}>
                        <td className="whitespace-nowrap text-secondary">{dateTime(payment.paidAt ?? payment.createdAt)}</td>
                        <td>
                          <Link to={adminPath(`/users/${encodeURIComponent(payment.uid)}`)} className="text-primary-deep hover:underline">
                            {payment.userEmail ?? payment.uid}
                          </Link>
                        </td>
                        <td>{payment.plan === 'monthly' ? 'Clave Pro' : 'Single resume'}</td>
                        <td className="whitespace-nowrap tabular-nums">
                          {inr(payment.amount)}
                          {payment.refundedAmount ? <span className="block text-xs text-warning">−{inr(payment.refundedAmount)} refunded</span> : null}
                        </td>
                        <td>
                          <StatusBadge status={payment.status} />
                        </td>
                        <td className="font-mono text-[11px] text-secondary">
                          {payment.id}
                          {payment.paymentId && <span className="block">{payment.paymentId}</span>}
                        </td>
                        <td className="text-right">
                          {can('billing') && payment.status === 'paid' && (
                            <Button variant="secondary" size="sm" onClick={() => setRefunding(payment)}>
                              Refund
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
            <Pagination page={state.data.page} limit={state.data.limit} total={state.data.total} onPage={(page) => set('page', String(page))} />
          </>
        )}
      </Card>
      {refunding && <RefundModal payment={refunding} onClose={() => setRefunding(null)} onDone={reload} />}
    </div>
  )
}

function RefundModal({ payment, onClose, onDone }: { payment: AdminPayment; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(payment.amount))
  const [revokePlan, setRevokePlan] = useState(true)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const value = Number(amount)
  const invalid = !(value > 0 && value <= payment.amount)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const result = await act(() => adminApi.refund(payment.id, { amount: value === payment.amount ? undefined : value, revokePlan, reason }), 'Refund issued')
    setSaving(false)
    if (result) {
      onDone()
      onClose()
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Refund this payment"
      description={`Refunds ${payment.userEmail ?? payment.uid} through Razorpay. Money usually reaches them in 5–7 working days.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="refund-form" variant="destructive" loading={saving} disabled={invalid}>
            Refund {Number.isFinite(value) ? inr(value) : ''}
          </Button>
        </>
      }
    >
      <form id="refund-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Input
          label="Amount (₹)"
          type="number"
          step="0.01"
          min={1}
          max={payment.amount}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          hint={`Paid ${inr(payment.amount)}. Lower it for a partial refund.`}
          error={invalid ? `Enter an amount up to ${inr(payment.amount)}` : undefined}
        />
        <Checkbox
          label={payment.plan === 'monthly' ? 'Take back the 30 days of Pro' : 'Take back the resume credit'}
          description="Recommended for full refunds."
          checked={revokePlan}
          onChange={(event) => setRevokePlan(event.target.checked)}
        />
        <Textarea label="Reason (saved in the audit log)" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </form>
    </Modal>
  )
}

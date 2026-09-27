import { Megaphone } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { adminApi } from '@/admin/adminApi'
import { act, num } from '@/admin/lib'
import { PageHeader, useConfirm } from '@/admin/ui'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

const AUDIENCES = { all: 'Everyone', pro: 'Clave Pro members', free: 'Free users' } as const

export function BroadcastPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [audience, setAudience] = useState<keyof typeof AUDIENCES>('all')
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState<number | null>(null)
  const { confirm, dialog } = useConfirm()
  const linkInvalid = link !== '' && !/^\/[A-Za-z0-9/_\-?=&.]*$/.test(link)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const ok = await confirm({ title: `Send to ${AUDIENCES[audience].toLowerCase()}?`, description: `“${title}” appears in their notifications right away. It can’t be unsent.`, confirmLabel: 'Send announcement' })
    if (ok === null) return
    setSending(true)
    const result = await act(() => adminApi.broadcast({ title, body, link: link || undefined, audience }), 'Announcement sent')
    setSending(false)
    if (result) {
      setLastSent(result.sent)
      setTitle('')
      setBody('')
      setLink('')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Broadcast" description="Send an in-app announcement to a group of users. It respects each user’s “Product updates” notification setting and never sends email." />
      <Card className="max-w-2xl shadow-none">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <Select label="Audience" value={audience} onChange={(event) => setAudience(event.target.value as keyof typeof AUDIENCES)}>
            {Object.entries(AUDIENCES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input label="Title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Your job feed now includes Internshala" />
          <Textarea label="Message" rows={3} maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} />
          <Input
            label="Link inside Clave (optional)"
            placeholder="/jobs"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            hint="A path in the app, like /jobs or /pricing."
            error={linkInvalid ? 'Use a path that starts with /' : undefined}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" loading={sending} disabled={!title.trim() || linkInvalid} leadingIcon={<Megaphone className="size-4" />}>
              Send announcement
            </Button>
            {lastSent !== null && <p className="text-sm text-secondary">Last announcement reached {num(lastSent)} users.</p>}
          </div>
        </form>
      </Card>
      {dialog}
    </div>
  )
}

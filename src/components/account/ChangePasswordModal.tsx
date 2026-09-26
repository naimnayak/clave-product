import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { changePassword } from '@/services/auth.service'
import { toast } from '@/store/toastStore'

/** Re-checks the current password with Firebase, then sets the new one. */
export function ChangePasswordModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const found: Record<string, string> = {}
    if (!current) found.current = 'Enter your current password.'
    if (next.length < 8) found.next = 'Use at least 8 characters.'
    else if (next === current) found.next = 'Choose a password you haven’t used here.'
    if (confirm !== next) found.confirm = 'Passwords don’t match.'
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      await changePassword(current, next)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      if (message.includes('current password')) setErrors({ current: message })
      else toast.error('Couldn’t change your password', message)
      setSaving(false)
      return
    }
    onChanged()
    toast.success('Password changed')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Update password
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Input label="Current password" type="password" autoComplete="current-password" value={current} error={errors.current} onChange={(event) => setCurrent(event.target.value)} />
        <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={next} error={errors.next} onChange={(event) => setNext(event.target.value)} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(event) => setConfirm(event.target.value)} />
      </form>
    </Modal>
  )
}

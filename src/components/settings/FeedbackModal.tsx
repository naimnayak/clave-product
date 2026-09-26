import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { ApiError, apiClient } from '@/services/apiClient'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const RATINGS = [
  [1, 'Frustrating'],
  [2, 'Needs work'],
  [3, 'Okay'],
  [4, 'Good'],
  [5, 'Love it'],
] as const

/** Sends product feedback to the Clave team (POST /api/feedback). */
export function FeedbackModal({ onClose, page = 'settings' }: { onClose: () => void; page?: string }) {
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (message.trim().length < 3) return setError('Tell us a little more.')
    setSending(true)
    try {
      await apiClient.post('/feedback', { message: message.trim(), page, rating })
      toast.success('Thanks for the feedback', 'We read every message.')
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t send it. Please try again.')
      setSending(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Share feedback"
      description="What’s working, what isn’t, and what would make Clave better for you?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={sending} onClick={() => void send()}>
            Send feedback
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="text-sm font-medium text-text">How is Clave working for you? (optional)</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RATINGS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={rating === value}
                onClick={() => setRating(rating === value ? null : value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  rating === value ? 'border-primary bg-primary/10 font-medium text-primary-deep' : 'border-border text-secondary hover:border-primary/40',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Textarea
          label="Your feedback"
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            if (error) setError(undefined)
          }}
          error={error}
        />
      </div>
    </Modal>
  )
}

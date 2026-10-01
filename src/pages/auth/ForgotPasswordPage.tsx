import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthHeading, FormError } from '@/components/auth/AuthParts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { linkStyles } from '@/components/ui/linkStyles'
import { paths } from '@/routes/navigation'
import { requestPasswordReset } from '@/services/auth.service'
import { isValidEmail } from '@/utils/validation'

/** Keeps the router state, so signing in still returns to the page that asked for it. */
function BackToLogin() {
  const { state } = useLocation()
  return (
    <Link to={paths.login} state={state} className={`inline-flex items-center gap-2 text-sm ${linkStyles}`}>
      <ArrowLeft className="size-4" aria-hidden />
      Back to Log in
    </Link>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isValidEmail(email)) {
      setError(email.trim() ? 'Enter a valid email address.' : 'Enter your email address.')
      return
    }
    setError(undefined)
    setFormError(undefined)
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      setFormError('We couldn’t send the reset link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <>
        <span className="mb-6 flex size-12 items-center justify-center rounded-default icon-tile">
          <MailCheck className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <AuthHeading
          title="Check your email"
          description={`If an account exists for ${email.trim()}, we’ve sent a link to reset your password.`}
        />
        <div className="flex flex-col items-start gap-4">
          <Button variant="secondary" onClick={() => setSent(false)}>
            Use a different email
          </Button>
          <BackToLogin />
        </div>
      </>
    )
  }

  return (
    <>
      <AuthHeading title="Reset your password" description="Enter your email and we’ll send you a link to reset it." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
        />
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>
      <div className="mt-8"><BackToLogin /></div>
    </>
  )
}

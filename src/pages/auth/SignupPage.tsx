import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthDivider, AuthHeading, FormError, GoogleButton } from '@/components/auth/AuthParts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { linkStyles } from '@/components/ui/linkStyles'
import { legalPaths } from '@/components/legal/legalInfo'
import { paths } from '@/routes/navigation'
import { useAuthStore } from '@/store/authStore'
import { isValidEmail } from '@/utils/validation'

const MIN_PASSWORD_LENGTH = 8

export function SignupPage() {
  const { state: routerState } = useLocation()
  const signUp = useAuthStore((state) => state.signUp)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState<'form' | 'google' | null>(null)

  // On success the guard around this route sends new users to /onboarding.
  const run = async (kind: 'form' | 'google', action: () => Promise<void>) => {
    setPending(kind)
    setFormError(undefined)
    try {
      await action()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
      setPending(null)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Enter your name.'
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.'
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    setErrors(next)
    if (Object.keys(next).length > 0) return

    void run('form', () => signUp({ name, email, password }))
  }

  return (
    <>
      <AuthHeading title="Create your account" description="Start building your next resume in a few minutes." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />
        <Input
          label="Name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Button type="submit" size="lg" fullWidth loading={pending === 'form'} disabled={pending === 'google'}>
          Create account
        </Button>
      </form>
      <AuthDivider />
      <GoogleButton
        onClick={() => void run('google', signInWithGoogle)}
        loading={pending === 'google'}
        disabled={pending === 'form'}
      />
      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        By creating an account, you agree to Clave’s{' '}
        <Link to={legalPaths.terms} target="_blank" rel="noopener" className={linkStyles}>
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link to={legalPaths.privacy} target="_blank" rel="noopener" className={linkStyles}>
          Privacy Policy
        </Link>
        , and confirm you are 18 or older.
      </p>
      <p className="mt-6 text-center text-sm text-secondary">
        Already have an account?{' '}
        <Link to={paths.login} state={routerState} className={linkStyles}>
          Log in
        </Link>
      </p>
    </>
  )
}

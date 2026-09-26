import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthDivider, AuthHeading, FormError, GoogleButton } from '@/components/auth/AuthParts'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { linkStyles } from '@/components/ui/linkStyles'
import { legalPaths } from '@/components/legal/legalInfo'
import { paths } from '@/routes/navigation'
import { useAuthStore } from '@/store/authStore'
import { isValidEmail } from '@/utils/validation'

export function LoginPage() {
  const signIn = useAuthStore((state) => state.signIn)
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState<'form' | 'google' | null>(null)

  // On success the guard around this route redirects, so we only reset state on failure.
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
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    void run('form', () => signIn({ email, password, remember }))
  }

  return (
    <>
      <AuthHeading title="Welcome back" description="Log in to continue building your next." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormError message={formError} />
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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <Link to={paths.forgotPassword} className={`text-sm ${linkStyles}`}>
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={pending === 'form'} disabled={pending === 'google'}>
          Log in
        </Button>
      </form>
      <AuthDivider />
      <GoogleButton
        onClick={() => void run('google', signInWithGoogle)}
        loading={pending === 'google'}
        disabled={pending === 'form'}
      />
      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        By continuing, you agree to Clave’s{' '}
        <Link to={legalPaths.terms} target="_blank" rel="noopener" className={linkStyles}>
          Terms
        </Link>{' '}
        and{' '}
        <Link to={legalPaths.privacy} target="_blank" rel="noopener" className={linkStyles}>
          Privacy Policy
        </Link>
        .
      </p>
      <p className="mt-6 text-center text-sm text-secondary">
        New to Clave?{' '}
        <Link to={paths.signup} className={linkStyles}>
          Sign up
        </Link>
      </p>
    </>
  )
}

import { Check, CircleAlert, FileText, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ImportProgress } from '@/components/onboarding/ImportProgress'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { linkStyles } from '@/components/ui/linkStyles'
import { paths } from '@/routes/navigation'
import { ApiError } from '@/services/apiClient'
import { importLinkedIn, isValidLinkedInUrl, validateResumeFile } from '@/services/import.service'
import { useAuthStore } from '@/store/authStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { cn } from '@/utils/cn'

const STAGES = ['Reading your resume…', 'Extracting your career information…']
const IMPORTS = ['Experience', 'Education', 'Skills', 'Certifications', 'Profile links']
const HOW_TO = [
  'Open your profile on linkedin.com.',
  'Click “Resources” (or “More”) under your name, then “Save to PDF”.',
  'Upload the PDF LinkedIn downloads (usually called Profile.pdf).',
]

export function ImportLinkedInPage() {
  const user = useAuthStore((state) => state.user)
  const setDraft = useOnboardingStore((state) => state.setDraft)
  const navigate = useNavigate()

  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fieldError, setFieldError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [importing, setImporting] = useState(false)
  const [stage, setStage] = useState(STAGES[0])
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const pick = (selected: File | undefined) => {
    if (!selected) return
    const problem = validateResumeFile(selected)
    setFormError(problem ?? undefined)
    setFile(problem ? null : selected)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files[0])
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return
    if (!file) {
      setFormError('Choose the PDF you saved from LinkedIn.')
      return
    }
    if (url.trim() && !isValidLinkedInUrl(url)) {
      setFieldError('Enter a LinkedIn profile link, like linkedin.com/in/your-name, or leave it empty.')
      return
    }
    setFieldError(undefined)
    setFormError(undefined)
    setStage(STAGES[0])
    setImporting(true)
    try {
      const data = await importLinkedIn(file, url, { name: user.name, email: user.email }, setStage)
      if (!mounted.current) return
      setDraft(data, 'linkedin')
      navigate(`${paths.onboarding}/review`)
    } catch (error) {
      if (!mounted.current) return
      setFormError(error instanceof ApiError && error.status < 500 ? error.message : 'We couldn’t read that PDF. Try again, or import a resume instead.')
      setImporting(false)
    }
  }

  if (importing) {
    return (
      <>
        <OnboardingHeader title="Importing your profile" step={1} />
        <ImportProgress stages={STAGES} current={stage} detail={file?.name} />
      </>
    )
  }

  return (
    <>
      <OnboardingHeader
        title="Import from LinkedIn"
        description="Save your LinkedIn profile as a PDF and Clave will bring in the essentials for you to review."
        step={1}
        backTo={paths.onboarding}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card padding="none" className="p-5 sm:p-6">
          <p className="text-sm font-semibold text-text">How to get your LinkedIn PDF</p>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-secondary">
            {HOW_TO.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Card>
        <Card padding="none" className="p-5 sm:p-6">
          <p className="text-sm font-semibold text-text">What we’ll import</p>
          <ul className="mt-3 grid gap-2">
            {IMPORTS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-secondary">
                <Check className="size-4 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-control border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {formError}
          </p>
        )}

        <label
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center rounded-default border border-dashed px-6 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
            dragging ? 'border-primary bg-primary/5' : 'border-muted bg-surface hover:border-secondary',
          )}
        >
          <input
            type="file"
            accept=".pdf"
            className="sr-only"
            aria-label="LinkedIn profile PDF"
            onChange={(event) => {
              pick(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <span className="flex size-11 items-center justify-center rounded-default icon-tile">
            {file ? <FileText className="size-5" strokeWidth={1.75} aria-hidden /> : <Upload className="size-5" strokeWidth={1.75} aria-hidden />}
          </span>
          <span className="mt-3 text-sm font-semibold text-text">{file ? file.name : 'Drop your LinkedIn PDF here'}</span>
          <span className="mt-1 text-sm text-secondary">
            {file ? 'Click to choose a different file' : <>or <span className={linkStyles}>browse files</span></>}
          </span>
        </label>

        <Input
          label="LinkedIn profile link (optional)"
          placeholder="linkedin.com/in/your-name"
          hint="Added to your profile links."
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          error={fieldError}
        />
        <div>
          <Button type="submit" size="lg">
            Import profile
          </Button>
        </div>
      </form>

      <p className="mt-6 text-sm text-secondary">
        Prefer another way?{' '}
        <Link to={`${paths.onboarding}/import-resume`} className={linkStyles}>
          Import a resume
        </Link>{' '}
        or{' '}
        <Link to={`${paths.onboarding}/manual`} className={linkStyles}>
          build manually
        </Link>
        .
      </p>
    </>
  )
}

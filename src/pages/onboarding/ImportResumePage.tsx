import { CircleAlert, FileText, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ImportProgress } from '@/components/onboarding/ImportProgress'
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader'
import { ProfileSections } from '@/components/onboarding/ProfileSections'
import { Button } from '@/components/ui/Button'
import { linkStyles } from '@/components/ui/linkStyles'
import { paths } from '@/routes/navigation'
import { ApiError } from '@/services/apiClient'
import { RESUME_ACCEPT, extractResume, validateResumeFile } from '@/services/import.service'
import { useAuthStore } from '@/store/authStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import { cn } from '@/utils/cn'

const STAGES = ['Reading your resume…', 'Extracting your career information…']

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ImportResumePage() {
  const user = useAuthStore((state) => state.user)
  const { draft, source, setDraft, updateDraft, reset } = useOnboardingStore()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<'idle' | 'extracting' | 'done'>(source === 'resume' && draft ? 'done' : 'idle')
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState(STAGES[0])
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const handleFile = async (selected: File | undefined) => {
    if (!selected || !user) return
    const problem = validateResumeFile(selected)
    if (problem) {
      setError(problem)
      return
    }
    setError(undefined)
    setFile(selected)
    setStage(STAGES[0])
    setPhase('extracting')
    try {
      const data = await extractResume(selected, { name: user.name, email: user.email }, setStage)
      if (!mounted.current) return
      setDraft(data, 'resume')
      setPhase('done')
    } catch (error) {
      if (!mounted.current) return
      setError(error instanceof ApiError && error.status < 500 ? error.message : 'We couldn’t read that file. Try again, or build your profile manually.')
      setPhase('idle')
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  if (phase === 'extracting') {
    return (
      <>
        <OnboardingHeader title="Importing your resume" step={1} />
        <ImportProgress stages={STAGES} current={stage} detail={file ? `${file.name} · ${formatSize(file.size)}` : undefined} />
      </>
    )
  }

  if (phase === 'done' && draft) {
    return (
      <>
        <OnboardingHeader
          title="Here’s what we found"
          description="Check the details below and edit anything that looks off. Anything missing can be added now or later."
          step={1}
          backTo={paths.onboarding}
        />
        <ProfileSections draft={draft} onChange={updateDraft} />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              setFile(null)
              setPhase('idle')
            }}
          >
            Upload a different file
          </Button>
          <Button size="lg" onClick={() => navigate(`${paths.onboarding}/review`)}>
            Continue
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <OnboardingHeader
        title="Import your resume"
        description="Upload the resume you already have and Clave will pull out the details for you to review."
        step={1}
        backTo={paths.onboarding}
      />

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-control border border-error/20 bg-error/5 px-3 py-2.5 text-sm text-error">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
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
          'flex cursor-pointer flex-col items-center rounded-default border border-dashed px-6 py-12 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
          dragging ? 'border-primary bg-primary/5' : 'border-muted bg-surface hover:border-secondary',
        )}
      >
        <input
          type="file"
          accept={RESUME_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <span className="flex size-12 items-center justify-center rounded-default icon-tile">
          <Upload className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="mt-4 text-base font-semibold text-text">Drag and drop your resume here</span>
        <span className="mt-1 text-sm text-secondary">
          or <span className={linkStyles}>browse files</span>
        </span>
        <span className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted">
          <FileText className="size-3.5" aria-hidden />
          PDF or DOCX · up to 5 MB
        </span>
      </label>

      <p className="mt-6 text-sm text-secondary">
        Don’t have one handy?{' '}
        <Link to={`${paths.onboarding}/import-linkedin`} className={linkStyles}>
          Import LinkedIn
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

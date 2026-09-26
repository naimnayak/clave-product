import { CircleAlert, FileText, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ImportProgress } from '@/components/onboarding/ImportProgress'
import { FlowShell } from '@/components/resumes/FlowShell'
import { linkStyles } from '@/components/ui/linkStyles'
import { paths, resumePath } from '@/routes/navigation'
import { ApiError } from '@/services/apiClient'
import { createResumeFromUpload, formatFileSize } from '@/services/resumeUpload.service'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const STAGES = ['Uploading your resume…', 'Reading every section with AI…', 'Saving it to your library…']
const MAX_BYTES = 10 * 1024 * 1024

/** /resumes/import: upload a PDF/DOCX, parse it, save it as a base resume and open it in the editor. */
export function UploadResumePage() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const handle = async (selected: File | undefined) => {
    if (!selected) return
    const extension = selected.name.split('.').pop()?.toLowerCase()
    if (extension !== 'pdf' && extension !== 'docx') return setError('Please upload a PDF or DOCX file.')
    if (selected.size === 0) return setError('This file looks empty. Try a different one.')
    if (selected.size > MAX_BYTES) return setError('This file is larger than 10 MB. Try a smaller one.')
    setError(undefined)
    setFile(selected)
    setStage(STAGES[0])
    // The request is one call; the stages give a sense of progress while it runs.
    timers.current = [setTimeout(() => setStage(STAGES[1]), 1200), setTimeout(() => setStage(STAGES[2]), 5500)]
    try {
      const created = await createResumeFromUpload(selected)
      toast.success('Resume imported', 'Check the details, then tailor it or download it.')
      navigate(resumePath(created.id), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'We couldn’t read that file. Try again.')
      setStage(null)
    } finally {
      timers.current.forEach(clearTimeout)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void handle(event.dataTransfer.files[0])
  }

  if (stage) {
    return (
      <FlowShell title="Importing your resume" description="This usually takes a few seconds.">
        <ImportProgress stages={STAGES} current={stage} detail={file ? `${file.name} · ${formatFileSize(file.size)}` : undefined} />
      </FlowShell>
    )
  }

  return (
    <FlowShell
      title="Import an existing resume"
      description="Upload the resume you already have. Clave turns it into an editable resume you can tailor and download. Importing your own resume doesn’t use up your plan’s resume allowance."
    >
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
          'flex cursor-pointer flex-col items-center rounded-default border border-dashed px-6 py-14 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
          dragging ? 'border-primary bg-primary/5' : 'border-muted bg-surface hover:border-secondary',
        )}
      >
        <input
          type="file"
          accept=".pdf,.docx"
          className="sr-only"
          aria-label="Resume file"
          onChange={(event) => {
            void handle(event.target.files?.[0])
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
          PDF or DOCX · up to 10 MB
        </span>
      </label>
      <p className="mt-6 text-sm text-secondary">
        Want to start fresh instead?{' '}
        <Link to={paths.createResume} className={linkStyles}>
          Create a new resume
        </Link>
        .
      </p>
    </FlowShell>
  )
}

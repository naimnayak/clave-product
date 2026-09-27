import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Briefcase, Building2, Check, CheckCircle, Clock, FileText, Info, Loader2, Trash2, Upload, X } from 'lucide-react'
import { ResumePreview } from '@/components/builder/ResumePreview'
import { ImportProgress } from '@/components/onboarding/ImportProgress'
import { FlowShell } from '@/components/resumes/FlowShell'
import { ResumeThumbnail } from '@/components/resumes/ResumeThumbnail'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { LoadingState } from '@/components/ui/LoadingState'
import { resumePath } from '@/routes/navigation'
import { useSubscription } from '@/hooks/useSubscription'
import { getJobById, getRecommendedJobs, jobToDescription } from '@/services/job.service'
import { listResumes } from '@/services/resume.service'
import { createResumeFromDocument, getResumeDocument } from '@/services/resumeDocument.service'
import { createResumeFromUpload } from '@/services/resumeUpload.service'
import type { UploadedResumeInfo } from '@/services/resumeUpload.service'
import { analyzeJobDescription, applyChanges, jobMatch } from '@/services/tailor.service'
import type { TailorAnalysis } from '@/services/tailor.service'
import { toast } from '@/store/toastStore'
import type { Job } from '@/types/job'
import type { Resume } from '@/types/resume'
import type { ResumeDocument } from '@/types/resumeDocument'
import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/relativeTime'

type Step = 'select' | 'job' | 'analyzing' | 'review'

const STAGES = ['Reading the job description…', 'Comparing it with your resume…', 'Preparing recommendations…']

/** Select a resume → add a job → AI analysis → review recommended changes → editor with a tailored copy. */
export function TailorResumeFlow() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [resumes, setResumes] = useState<Resume[] | null>(null)
  const [step, setStep] = useState<Step>('select')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('resume'))
  const [source, setSource] = useState<ResumeDocument | null>(null)
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [description, setDescription] = useState('')
  const [jdError, setJdError] = useState<string>()
  const [stage, setStage] = useState(STAGES[0])
  const [analysis, setAnalysis] = useState<TailorAnalysis | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedResume, setUploadedResume] = useState<UploadedResumeInfo | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingName, setUploadingName] = useState('')
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let active = true
    listResumes().then(
      (list) => {
        if (!active) return
        setResumes(list)
        setSelectedId((current) => (current && list.some((r) => r.id === current) ? current : (list[0]?.id ?? null)))
      },
      () => {
        if (!active) return
        toast.error('Couldn’t load your resumes', 'You can still upload one to tailor.')
        setResumes([])
      },
    )
    return () => {
      active = false
    }
  }, [])

  // "Tailor Resume" on a job listing links here with ?job=<id>: prefill the job step from the listing.
  const jobParam = params.get('job')
  useEffect(() => {
    if (!jobParam) return
    let active = true
    getJobById(jobParam)
      .then((found) => {
        if (!active || !found) return
        setTitle((current) => current || found.job.title)
        setCompany((current) => current || found.job.company)
        setDescription((current) => current || jobToDescription(found.job, found.detail))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [jobParam])

  // Shortcut chips on the job step: the user's best-matching real listings.
  const [matches, setMatches] = useState<Job[]>([])
  const { isPro } = useSubscription()
  useEffect(() => {
    if (!isPro) return // job listings are a Clave Pro feature
    let active = true
    getRecommendedJobs(4)
      .then((list) => active && setMatches(list))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [isPro])

  const pickMatch = async (job: Job) => {
    setTitle(job.title)
    setCompany(job.company)
    setJdError(undefined)
    const found = await getJobById(job.id).catch(() => null)
    if (found) setDescription(jobToDescription(found.job, found.detail))
  }

  const handleTriggerUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['pdf', 'docx', 'doc'].includes(extension)) {
      toast.error('Unsupported file format', 'Please upload a PDF or DOCX file.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', 'Please upload a resume under 10 MB.')
      return
    }

    setIsUploading(true)
    setUploadingName(file.name)
    try {
      const result = await createResumeFromUpload(file)
      setUploadedResume(result)
      setSelectedId(result.id)
      toast.success('Resume uploaded successfully', 'Ready to tailor for your target role.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Please try again.'
      toast.error('Upload failed', msg)
    } finally {
      setIsUploading(false)
      setUploadingName('')
    }
  }

  const handleRemoveUpload = () => {
    setUploadedResume(null)
    if (selectedId === uploadedResume?.id) {
      setSelectedId(resumes?.[0]?.id ?? null)
    }
  }

  const tailored = useMemo(() => (source && analysis ? applyChanges(source, analysis, accepted) : null), [source, analysis, accepted])
  const matchBefore = source && analysis ? jobMatch(source, analysis.keywords.all) : 0
  const matchAfter = tailored && analysis ? jobMatch(tailored, analysis.keywords.all) : 0

  if (!resumes) return <LoadingState label="Loading your resumes…" />

  const startTailoring = async (id: string, customDoc?: ResumeDocument) => {
    setLoadingResumeId(id)
    setSelectedId(id)
    try {
      let doc: ResumeDocument | null = customDoc ?? null
      if (!doc) {
        doc = await getResumeDocument(id)
      }
      if (!doc) {
        toast.error('Couldn’t open that resume')
        return
      }
      setSource(doc)
      setStep('job')
    } catch {
      toast.error('Could not load the resume', 'Please try again.')
    } finally {
      setLoadingResumeId(null)
    }
  }

  const analyze = async () => {
    if (!source) return
    if (!description.trim()) {
      setJdError('Paste the job description to continue.')
      return
    }
    setJdError(undefined)
    setIsAnalyzing(true)

    // Smooth button state feedback before advancing to progress stage
    await new Promise((resolve) => setTimeout(resolve, 400))
    setStage(STAGES[0])
    setStep('analyzing')

    // The mock analysis has fixed timing; advance the visible stage alongside it.
    const timers = [setTimeout(() => setStage(STAGES[1]), 800), setTimeout(() => setStage(STAGES[2]), 1600)]
    try {
      const result = await analyzeJobDescription(
        {
          resumeId: source.id,
          jobTitle: title,
          company,
          jobDescription: description,
        },
        source
      )
      setAnalysis(result)
      setAccepted(new Set(result.changes.map((c) => c.id)))
      setStep('review')
    } catch {
      toast.error('Couldn’t analyze the job', 'Please try again.')
      setStep('job')
    } finally {
      timers.forEach(clearTimeout)
      setIsAnalyzing(false)
    }
  }

  const confirm = async () => {
    if (!tailored || !analysis || !source) return
    setBusy(true)
    try {
      const label = analysis.company || analysis.jobTitle
      const created = await createResumeFromDocument(tailored, {
        type: 'tailored',
        tailoredFor: analysis.company || undefined,
        name: `${source.name} · ${label}`,
      })
      navigate(resumePath(created.id), { replace: true })
    } catch {
      toast.error('Couldn’t create the tailored resume', 'Please try again.')
      setBusy(false)
    }
  }

  const toggle = (id: string) =>
    setAccepted((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (step === 'review' && analysis && tailored) {
    return (
      <FlowShell
        title="Review recommended changes"
        description={`Tailoring “${source?.name}” for ${analysis.jobTitle}${analysis.company ? ` at ${analysis.company}` : ''} (your original resume stays untouched).`}
        step={{ current: 3, total: 3, label: 'Review changes' }}
        onBack={() => setStep('job')}
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="flex flex-col gap-8">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Match with this job</p>
              <p className="mt-1 flex items-baseline gap-2 text-text">
                <span className="text-lg text-secondary">{matchBefore}%</span>
                <span aria-hidden className="text-muted">→</span>
                <span className="text-3xl font-semibold tracking-tight">{matchAfter}%</span>
              </p>
              <p className="mt-1 text-sm text-secondary">Updates as you choose changes. Based on the job’s key terms.</p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-text">Keywords</h2>
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Keywords in the job description">
                {analysis.keywords.matched.map((k) => (
                  <Badge key={k} variant="success">
                    {k}
                  </Badge>
                ))}
                {analysis.keywords.missing.map((k) => (
                  <Badge key={k} variant="warning">
                    {k}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Green: already on your resume. Amber: missing.</p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-text">Recommended changes</h2>
              {analysis.changes.length === 0 ? (
                <p className="mt-3 text-sm text-secondary">Your resume already fits this job well. No changes needed.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-4">
                  {analysis.changes.map((change) => (
                    <li key={change.id}>
                      <Checkbox label={change.title} description={change.description} checked={accepted.has(change.id)} onChange={() => toggle(change.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" loading={busy} onClick={confirm}>
                {accepted.size > 0 ? 'Apply changes & open editor' : 'Open copy in editor'}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setStep('job')} disabled={busy}>
                Change job
              </Button>
            </div>
          </div>

          <div className="rounded-default bg-border/40 p-3 sm:p-5">
            <ResumePreview doc={tailored} />
          </div>
        </div>
      </FlowShell>
    )
  }

  if (step === 'analyzing') {
    return (
      <FlowShell title="Analyzing the job" step={{ current: 3, total: 3, label: 'Analyzing' }} onBack={() => setStep('job')}>
        <div className="mx-auto max-w-lg">
          <ImportProgress stages={STAGES} current={stage} detail={title || company || undefined} />
        </div>
      </FlowShell>
    )
  }

  if (step === 'job') {
    return (
      <FlowShell
        editorial
        title="Add the job"
        description={`Paste the job description you’re applying for. Clave will compare it with “${source?.name || 'Untitled Resume'}”.`}
        step={{ current: 2, total: 3, label: 'Add the job' }}
        onBack={() => setStep('select')}
      >
        <div className="w-full">
          {/* Shortcut: one of the user's job matches */}
          {matches.length > 0 && <div className="mt-1">
            <p className="text-[14px] font-semibold text-text">From your job matches</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              {matches.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => void pickMatch(job)}
                  className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13.5px] font-medium text-text shadow-xs transition-all duration-150 hover:border-primary hover:bg-primary/[0.04] hover:text-primary active:scale-[0.99] cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-primary" />
                  <span>
                    {job.title} · {job.company}
                  </span>
                </button>
              ))}
            </div>
          </div>}

          {/* Job information */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Job title */}
            <div>
              <label htmlFor="job-title-input" className="block text-[14px] font-semibold text-text mb-2">
                Job title
              </label>
              <div className="relative flex h-12 w-full items-center rounded-[8px] border border-border bg-surface shadow-xs transition-all duration-150 hover:border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Briefcase className="ml-3.5 h-[18px] w-[18px] shrink-0 text-muted pointer-events-none" />
                <input
                  id="job-title-input"
                  type="text"
                  placeholder="e.g. Product Designer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-full w-full bg-transparent pl-3 pr-9 text-[15px] text-text placeholder:text-muted focus:outline-none"
                />
                {title && (
                  <button
                    type="button"
                    onClick={() => setTitle('')}
                    className="absolute right-3 inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-neutral-100 hover:text-text transition-colors cursor-pointer"
                    aria-label="Clear job title"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Company */}
            <div>
              <label htmlFor="company-name-input" className="block text-[14px] font-semibold text-text mb-2">
                Company
              </label>
              <div className="relative flex h-12 w-full items-center rounded-[8px] border border-border bg-surface shadow-xs transition-all duration-150 hover:border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Building2 className="ml-3.5 h-[18px] w-[18px] shrink-0 text-muted pointer-events-none" />
                <input
                  id="company-name-input"
                  type="text"
                  placeholder="e.g. Kite & Co."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-full w-full bg-transparent pl-3 pr-9 text-[15px] text-text placeholder:text-muted focus:outline-none"
                />
                {company && (
                  <button
                    type="button"
                    onClick={() => setCompany('')}
                    className="absolute right-3 inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-neutral-100 hover:text-text transition-colors cursor-pointer"
                    aria-label="Clear company name"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Job description */}
          <div className="mt-6">
            <label htmlFor="job-description-input" className="block text-[14px] font-semibold text-text mb-2">
              Job description
            </label>
            <div
              className={cn(
                'relative flex flex-col rounded-[12px] border bg-surface shadow-xs transition-all duration-150',
                jdError
                  ? 'border-error focus-within:border-error focus-within:ring-1 focus-within:ring-error'
                  : 'border-border hover:border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
              )}
            >
              {/* Top utility row */}
              <div className="flex h-11 items-center justify-between border-b border-background px-4">
                <div className="flex items-center gap-2 text-[14px] text-secondary">
                  <FileText className="h-4 w-4 text-muted" />
                  <span>Paste job description here...</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDescription('')
                    setJdError(undefined)
                    textareaRef.current?.focus()
                  }}
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-secondary hover:bg-neutral-100 hover:text-text transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted" />
                  <span>Clear</span>
                </button>
              </div>

              {/* Textarea Area & Empty State Guidance */}
              <div
                onClick={() => textareaRef.current?.focus()}
                className="relative min-h-[300px] p-4 flex-1 cursor-text"
              >
                {!description && (
                  <div className="pointer-events-none absolute inset-x-4 top-4 select-none space-y-3.5 pt-0.5 text-[14px] text-muted">
                    <p className="text-muted">Paste the full job description here...</p>
                    <div className="space-y-2 pt-1 text-[13.5px] text-muted">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <span>Include responsibilities, requirements, and preferred skills</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <span>The more details you provide, the better the analysis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <span>You can also try one of the sample jobs above</span>
                      </div>
                    </div>
                  </div>
                )}

                <textarea
                  id="job-description-input"
                  ref={textareaRef}
                  rows={12}
                  value={description}
                  maxLength={10000}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (jdError) setJdError(undefined)
                  }}
                  className="relative z-10 w-full min-h-[260px] resize-y bg-transparent text-[14px] leading-relaxed text-text focus:outline-none"
                />

                {/* Character counter */}
                <div className="pointer-events-none absolute right-4 bottom-3 z-10 text-xs text-muted">
                  {description.length.toLocaleString()}/10,000
                </div>
              </div>
            </div>

            {/* Error Message */}
            {jdError && (
              <p className="mt-2 text-xs font-medium text-error">
                {jdError}
              </p>
            )}
          </div>

          {/* Analyze CTA */}
          <div className="mt-6 flex flex-col items-start gap-2.5">
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={analyze}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-primary px-6 text-[15px] font-medium text-on-primary shadow-xs transition-all duration-150 hover:bg-primary-deep active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Analyzing job…</span>
                </>
              ) : (
                <>
                  <span>Analyze job</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <Info className="h-3.5 w-3.5 text-muted shrink-0" />
              <span>Clave will analyze this job and show how it matches with your resume.</span>
            </div>
          </div>
        </div>
      </FlowShell>
    )
  }

  return (
    <FlowShell
      editorial
      title="Tailor an existing resume"
      description="Choose a resume to adapt for a specific job. Your original resume stays unchanged."
      step={{ current: 1, total: 3, label: 'Choose a resume' }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="w-full space-y-6">
        {/* Upload an existing resume option above saved resume cards */}
        {isUploading ? (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/[0.02] p-5">
            <div className="flex items-center gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary animate-pulse">
                <Upload className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text truncate">Uploading {uploadingName}…</p>
                <p className="text-xs text-muted">Parsing experience, skills, and structure for tailoring</p>
              </div>
            </div>
          </div>
        ) : uploadedResume ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-secondary uppercase tracking-wider">Uploaded Base Resume</span>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleTriggerUpload}
                  className="font-medium text-primary hover:underline"
                >
                  Replace file
                </button>
                <span className="text-border">·</span>
                <button
                  type="button"
                  onClick={handleRemoveUpload}
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>

            <article className="group relative flex items-start gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-primary/50 hover:bg-primary/[0.015] hover:shadow-xs">
              <div className="flex h-[100px] w-[80px] shrink-0 flex-col items-center justify-center rounded-md border border-border/80 bg-background text-primary shadow-2xs">
                <FileText className="size-8" aria-hidden />
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {uploadedResume.fileType}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-text">{uploadedResume.fileName}</h3>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Uploaded
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary">
                    <span className="font-semibold uppercase text-[11px] tracking-wide text-muted">{uploadedResume.fileType}</span>
                    <span>·</span>
                    <span>{uploadedResume.fileSizeFormatted}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      <CheckCircle className="size-3" aria-hidden /> Ready for tailoring
                    </span>
                  </div>

                  {uploadedResume.atsScore !== undefined && (
                    <div className="mt-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <CheckCircle className="size-3" aria-hidden />
                        {uploadedResume.atsScore} ATS
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom row: metadata on left, Tailor button on bottom right */}
                <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <span className="text-xs text-muted">
                    {uploadedResume.fileType.toUpperCase()} · {uploadedResume.fileSizeFormatted}
                  </span>

                  <button
                    type="button"
                    disabled={loadingResumeId !== null}
                    onClick={() => void startTailoring(uploadedResume.id, uploadedResume.document)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-on-primary shadow-2xs transition-all hover:bg-primary-deep hover:shadow-xs group-hover:bg-primary-deep focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                  >
                    {loadingResumeId === uploadedResume.id ? 'Loading…' : (
                      <>
                        Tailor
                        <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          </div>
        ) : (
          /* Empty upload option banner above saved cards */
          <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-4 sm:p-5 transition-colors hover:border-primary/40">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Upload className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text">Upload an existing resume</h3>
                  <p className="mt-0.5 text-xs text-secondary leading-relaxed">
                    Don't have a resume in Clave yet?<br className="hidden sm:inline" /> Upload your current resume and use it as the base for tailoring.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleTriggerUpload}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-surface px-4 py-2 text-xs sm:text-sm font-medium text-primary transition-colors hover:bg-primary/5 hover:border-primary"
                >
                  <Upload className="size-4" aria-hidden />
                  Upload Resume
                </button>
                <span className="text-[11px] text-muted">PDF or DOCX · Max 10 MB</span>
              </div>
            </div>
          </div>
        )}

        {/* Saved resume cards grid */}
        {resumes.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {resumes.map((resume, index) => {
              const isBestFit = index === 0
              const pageCount = ['res_product_designer', 'res_designer_lumen'].includes(resume.id) ? 2 : 1
              const isLoading = loadingResumeId === resume.id
              return (
                <article
                  key={resume.id}
                  className="group relative flex items-start gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-primary/50 hover:bg-primary/[0.015] hover:shadow-xs"
                >
                  {/* Thumbnail preview */}
                  <div className="h-[118px] w-[88px] shrink-0 overflow-hidden rounded-md border border-border/70 bg-tint p-1">
                    <ResumeThumbnail resumeId={resume.id} updatedAt={resume.updatedAt} className="h-full w-full rounded-sm" />
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-text">{resume.name}</h3>
                        {isBestFit && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            Best fit
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-secondary">{resume.targetRole || 'Not specified'}</p>

                      <div className="mt-2.5">
                        {resume.atsScore >= 75 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <CheckCircle className="size-3" aria-hidden />
                            {resume.atsScore} ATS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <Clock className="size-3" aria-hidden />
                            {resume.atsScore} ATS
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom row: metadata on left, Tailor button on bottom right */}
                    <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" aria-hidden />
                          Updated {formatRelativeTime(resume.updatedAt)}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <FileText className="size-3" aria-hidden />
                          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                        </span>
                      </div>

                      {/* Direct Tailor CTA on bottom right */}
                      <button
                        type="button"
                        disabled={loadingResumeId !== null}
                        onClick={() => void startTailoring(resume.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-on-primary shadow-2xs transition-all hover:bg-primary-deep hover:shadow-xs group-hover:bg-primary-deep focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                      >
                        {isLoading ? 'Loading…' : (
                          <>
                            Tailor
                            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </FlowShell>
  )
}

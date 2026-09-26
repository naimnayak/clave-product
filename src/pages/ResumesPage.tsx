import { FileText, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ResumeCard } from '@/components/resumes/ResumeCard'
import { ResumeCreationActions } from '@/components/resumes/ResumeCreationActions'
import { DeleteResumeDialog, RenameResumeDialog } from '@/components/resumes/ResumeDialogs'
import { ResumeFilters } from '@/components/resumes/ResumeFilters'
import type { ResumeFilter, ResumeSort, ResumeView } from '@/components/resumes/ResumeFilters'
import { ResumePreviewDialog } from '@/components/resumes/ResumePreviewDialog'
import { ResumeSearch } from '@/components/resumes/ResumeSearch'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { useResumeQuery } from '@/hooks/useResumeQuery'
import { useResumes } from '@/hooks/useResumes'
import { paths, resumePath } from '@/routes/navigation'
import { getResumeDocument } from '@/services/resumeDocument.service'
import { toast } from '@/store/toastStore'
import type { Resume } from '@/types/resume'
import { cn } from '@/utils/cn'
import { printResume } from '@/utils/printResume'
import { resumeStatus } from '@/utils/resumeStatus'

const DAY = 86_400_000

const matchesFilter = (resume: Resume, filter: ResumeFilter) =>
  filter === 'all' ||
  (filter === 'recent' ? Date.now() - new Date(resume.updatedAt).getTime() <= 14 * DAY : resumeStatus(resume) === filter)

export function ResumesPage() {
  const { state, rename, duplicate, remove } = useResumes()
  const navigate = useNavigate()
  const [query, setQuery] = useResumeQuery()
  const [filter, setFilter] = useState<ResumeFilter>('all')
  const [sort, setSort] = useState<ResumeSort>('updated')
  const [view, setView] = useState<ResumeView>('grid')
  const [previewing, setPreviewing] = useState<Resume | null>(null)
  const [renaming, setRenaming] = useState<Resume | null>(null)
  const [deleting, setDeleting] = useState<Resume | null>(null)

  const resumes = state.status === 'ready' ? state.resumes : []

  const downloadPdf = async (resume: Resume) => {
    try {
      const doc = await getResumeDocument(resume.id)
      if (!doc) throw new Error('This resume no longer exists.')
      toast.info('Choose “Save as PDF”', 'Pick it as the destination in the print dialog to download your resume.')
      await printResume(doc)
    } catch (error) {
      toast.error('Couldn’t prepare the PDF', error instanceof Error ? error.message : 'Please try again.')
    }
  }
  const needle = query.trim().toLowerCase()
  const visible = resumes
    .filter(
      (resume) =>
        matchesFilter(resume, filter) &&
        (!needle || [resume.name, resume.targetRole, resume.tailoredFor ?? ''].some((text) => text.toLowerCase().includes(needle))),
    )
    .sort((a, b) =>
      sort === 'ats' ? b.atsScore - a.atsScore : sort === 'name' ? a.name.localeCompare(b.name) : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Resumes</h1>

      <ResumeCreationActions />

      <section aria-labelledby="library-heading" className="flex flex-col gap-4">
        <h2 id="library-heading" className="sr-only">
          Your Resumes
        </h2>

        {resumes.length > 0 && (
          <>
            <ResumeSearch className="md:hidden" />
            <ResumeFilters filter={filter} onFilter={setFilter} sort={sort} onSort={setSort} view={view} onView={setView} />
          </>
        )}

        {state.status === 'loading' && <LoadingState label="Loading your resumes…" />}
        {state.status === 'error' && <EmptyState title="Couldn’t load your resumes" description="Please refresh the page to try again." />}

        {state.status === 'ready' && resumes.length === 0 && (
          <EmptyState
            icon={FileText}
            title="Your resume library is empty."
            description="Create your first ATS-friendly resume from your Career Profile."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link to={paths.createResume} className={buttonStyles()}>
                  Create Resume
                </Link>
                <Link to={paths.importResume} className={buttonStyles({ variant: 'secondary' })}>
                  Import Existing Resume
                </Link>
              </div>
            }
          />
        )}

        {state.status === 'ready' && resumes.length > 0 && visible.length === 0 && (
          <EmptyState
            icon={SearchX}
            title="No resumes match"
            description="Try a different search or filter."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
              >
                Clear search and filter
              </Button>
            }
          />
        )}

        {visible.length > 0 && (
          <ul className={cn(view === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3')}>
            {visible.map((resume) => (
              <li key={resume.id}>
                <ResumeCard
                  resume={resume}
                  view={view}
                  onPreview={() => setPreviewing(resume)}
                  onRename={() => setRenaming(resume)}
                  onDuplicate={async () => {
                    await duplicate(resume.id)
                    toast.success('Resume duplicated', `${resume.name} (Copy)`)
                  }}
                  onTailor={() => navigate(`${paths.tailorResume}?resume=${resume.id}`)}
                  onDownload={() => void downloadPdf(resume)}
                  onDelete={() => setDeleting(resume)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {previewing && (
        <ResumePreviewDialog resume={previewing} onClose={() => setPreviewing(null)} onOpen={() => navigate(resumePath(previewing.id))} />
      )}
      {renaming && (
        <RenameResumeDialog
          resume={renaming}
          onClose={() => setRenaming(null)}
          onRename={async (name) => {
            await rename(renaming.id, name)
            toast.success('Resume renamed')
          }}
        />
      )}
      {deleting && (
        <DeleteResumeDialog
          resume={deleting}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await remove(deleting.id)
            toast.success('Resume deleted')
          }}
        />
      )}
    </div>
  )
}

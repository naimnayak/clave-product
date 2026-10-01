import { ArrowLeft, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TemplateCategories } from '@/components/resumes/templates/TemplateCategories'
import type { CategoryFilter } from '@/components/resumes/templates/TemplateCategories'
import { TemplateGrid } from '@/components/resumes/templates/TemplateGrid'
import { TemplatePreviewModal } from '@/components/resumes/templates/TemplatePreviewModal'
import { TemplateSearch } from '@/components/resumes/templates/TemplateSearch'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { useTemplateQuery } from '@/hooks/useTemplateQuery'
import { templateLibrary } from '@/mocks/templates.mock'
import { paths, resumePath, useGoBack } from '@/routes/navigation'
import { createResumeDocument } from '@/services/resumeDocument.service'
import { toast } from '@/store/toastStore'
import type { TemplateId } from '@/types/resumeDocument'
import type { TemplateInfo } from '@/types/template'
import { templates } from '@/utils/resumeTemplates'

/** Browse → Compare → Preview → Use Template. Choosing opens the existing editor with the template applied. */
export function TemplateLibrary() {
  const navigate = useNavigate()
  const goBack = useGoBack(paths.createResume)
  const [query, setQuery] = useTemplateQuery()
  const [category, setCategory] = useState<CategoryFilter>('All')
  const [previewing, setPreviewing] = useState<TemplateInfo | null>(null)
  const [busyId, setBusyId] = useState<TemplateId | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return templateLibrary.filter(
      (template) =>
        (category === 'All' || template.categories.includes(category)) &&
        (!needle || [template.name, template.description, template.category, ...template.tags, ...template.bestFor, ...template.categories].some((text) => text.toLowerCase().includes(needle))),
    )
  }, [query, category])

  const use = async (template: TemplateInfo) => {
    setBusyId(template.id)
    try {
      const doc = await createResumeDocument({ start: 'profile', template: template.id, sectionOrder: templates[template.id].sectionOrder })
      navigate(resumePath(doc.id), { replace: true })
    } catch {
      toast.error('Couldn’t create your resume', 'Please try again.')
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* The page's only Back control lives on its header (the navbar shows none on this route). */}
      <header className="flex items-start gap-3">
        <IconButton label="Go back" variant="secondary" onClick={goBack} className="mt-0.5 shrink-0 sm:mt-1">
          <ArrowLeft className="size-4" aria-hidden />
        </IconButton>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">Choose a Template</h1>
          <p className="mt-1 text-secondary">Start with a professionally structured resume.</p>
        </div>
      </header>

      <TemplateSearch className="md:hidden" />
      <TemplateCategories value={category} onChange={setCategory} />

      {visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No templates match"
          description="Try a different search or category."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('')
                setCategory('All')
              }}
            >
              Clear search and filters
            </Button>
          }
        />
      ) : (
        <TemplateGrid templates={visible} busyId={busyId} onPreview={setPreviewing} onUse={use} />
      )}

      {previewing && <TemplatePreviewModal template={previewing} busy={busyId === previewing.id} onUse={() => use(previewing)} onClose={() => setPreviewing(null)} />}
    </div>
  )
}

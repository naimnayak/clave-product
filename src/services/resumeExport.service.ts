import { apiClient } from '@/services/apiClient'
import type { ResumeDocument } from '@/types/resumeDocument'
import { printResume, resumeFileName } from '@/utils/printResume'
import { resolvedLabels } from '@/utils/resumeLabels'
import { templates } from '@/utils/resumeTemplates'

export type ResumeExportFormat = 'pdf' | 'docx'

const HEX = /^#[0-9a-f]{6}$/i
const firstFont = (family: string | undefined) => family?.split(',')[0]?.replace(/["']/g, '').trim() || 'Calibri'

/**
 * Word export (POST /resumes/:id/export/docx). The server builds the file from the saved resume;
 * the template-specific labels, accent and font are resolved here so the file matches the preview.
 */
export async function downloadResumeDocx(doc: ResumeDocument): Promise<void> {
  const style = templates[doc.template]
  const labels = resolvedLabels(doc)
  const accent = [style.heading.color, style.accent].find((color): color is string => typeof color === 'string' && HEX.test(color)) ?? '#056B4D'
  await apiClient.download(`/resumes/${encodeURIComponent(doc.id)}/export/docx`, `${resumeFileName(doc.name)}.docx`, {
    headings: labels.headings,
    skillLabels: labels.skillLabels,
    role: labels.role,
    accent,
    font: firstFont(style.page.fontFamily).replace(/[^A-Za-z0-9 -]/g, '') || 'Calibri',
    align: style.name.textAlign === 'center' ? 'center' : 'left',
    uppercase: style.heading.textTransform === 'uppercase',
    skillsMode: style.skills ?? 'lines',
  })
}

/** PDF opens the print dialog ("Save as PDF"); DOCX downloads straight away. */
export function exportResume(doc: ResumeDocument, format: ResumeExportFormat): Promise<void> {
  return format === 'pdf' ? printResume(doc) : downloadResumeDocx(doc)
}

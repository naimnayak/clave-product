/**
 * resumeUpload.service.ts
 *
 * Uploads a PDF/DOCX (POST /api/files/upload), parses it with AI (POST /api/files/:id/parse-resume)
 * and saves the result as a new base resume (POST /api/resumes).
 *
 * Product Rule: the uploaded resume is saved as its own base document. Tailoring creates a NEW resume from it.
 */

import { AI_TIMEOUT_MS, apiClient } from '@/services/apiClient'
import { createResumeFromDocument } from '@/services/resumeDocument.service'
import type { ResumeDocument } from '@/types/resumeDocument'

export interface UploadResumeResult {
  fileId: string
  fileName: string
  fileSize: number
  fileType: 'pdf' | 'docx'
  fileUrl?: string
}

export interface ParsedResumeResult {
  fileId: string
  targetRole: string
  name: string
  document: ResumeDocument
  atsScore: number
}

export interface UploadedResumeInfo {
  id: string
  fileName: string
  fileSize: number
  fileSizeFormatted: string
  fileType: 'pdf' | 'docx'
  status: 'uploading' | 'parsing' | 'ready' | 'error'
  error?: string
  atsScore?: number
  document?: ResumeDocument
}

const MAX_BYTES = 10 * 1024 * 1024

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Validates and uploads a resume file. The server re-checks type (magic bytes) and size. */
export async function uploadResume(file: File): Promise<UploadResumeResult> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension !== 'pdf' && extension !== 'docx') {
    throw new Error(extension === 'doc' ? 'Legacy .doc files aren’t supported. Save it as DOCX or PDF.' : 'Unsupported file type. Please upload a PDF or DOCX file.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('File exceeds the 10 MB limit. Please upload a smaller file.')
  }
  return apiClient.upload<UploadResumeResult>('/files/upload', file)
}

/** Parses an uploaded resume into a structured ResumeDocument (not saved yet). */
export async function parseUploadedResume(fileId: string): Promise<ParsedResumeResult> {
  return apiClient.post<ParsedResumeResult>(`/files/${encodeURIComponent(fileId)}/parse-resume`, {}, AI_TIMEOUT_MS)
}

/**
 * End-to-end: upload, parse, then save the parsed document as a new base resume so the
 * tailoring flow (and the library) can use it.
 */
export async function createResumeFromUpload(file: File): Promise<UploadedResumeInfo> {
  const upload = await uploadResume(file)
  const parsed = await parseUploadedResume(upload.fileId)
  const created = await createResumeFromDocument(parsed.document, { type: 'base', sourceType: 'upload', sourceFileId: upload.fileId })

  return {
    id: created.id,
    fileName: file.name,
    fileSize: file.size,
    fileSizeFormatted: formatFileSize(file.size),
    fileType: upload.fileType,
    status: 'ready',
    atsScore: parsed.atsScore,
    document: created,
  }
}

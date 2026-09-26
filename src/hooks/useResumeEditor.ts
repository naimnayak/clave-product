import { useCallback, useEffect, useRef, useState } from 'react'
import { getResumeDocument, saveResumeDocument } from '@/services/resumeDocument.service'
import { toast } from '@/store/toastStore'
import type { ResumeDocument } from '@/types/resumeDocument'

export type SaveState = 'saved' | 'saving' | 'unsaved'
type Recipe = (doc: ResumeDocument) => ResumeDocument
export type ResumeUpdater = (recipe: Recipe) => void

const AUTOSAVE_DELAY_MS = 900

/** Loads a resume, applies edits immediately, and autosaves shortly after the last change. */
export function useResumeEditor(id: string) {
  const [doc, setDoc] = useState<ResumeDocument | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notFound'>('loading')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const docRef = useRef<ResumeDocument | null>(null)
  const version = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    getResumeDocument(id).then(
      (loaded) => {
        if (!active) return
        docRef.current = loaded
        setDoc(loaded)
        setStatus(loaded ? 'ready' : 'notFound')
      },
      (error: unknown) => {
        if (!active) return
        toast.error('Couldn’t open this resume', error instanceof Error ? error.message : 'Please try again.')
        setStatus('notFound')
      },
    )
    return () => {
      active = false
    }
  }, [id])

  /** Saves the latest document. Resolves false (and keeps the edit pending) if the API call fails. */
  const persist = useCallback(async (): Promise<boolean> => {
    const current = docRef.current
    if (!current) return false
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const saving = version.current
    setSaveState('saving')
    try {
      await saveResumeDocument(current)
    } catch (error) {
      setSaveState('unsaved')
      toast.error('Couldn’t save your changes', error instanceof Error ? error.message : 'Please try again.')
      return false
    }
    if (saving === version.current) setSaveState('saved')
    return true
  }, [])

  const update = useCallback(
    (recipe: Recipe) => {
      if (!docRef.current) return
      const next = recipe(docRef.current)
      docRef.current = next
      version.current += 1
      setDoc(next)
      setSaveState('unsaved')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS)
    },
    [persist],
  )

  // Leaving the page (route change or tab close) must not lose a pending edit.
  useEffect(() => {
    const flush = () => {
      if (timer.current && docRef.current) {
        clearTimeout(timer.current)
        timer.current = null
        void saveResumeDocument(docRef.current).catch(() => undefined)
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  return { doc, status, saveState, update, saveNow: persist }
}

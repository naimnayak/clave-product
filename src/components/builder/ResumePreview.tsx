import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { ResumeUpdater } from '@/hooks/useResumeEditor'
import type { ResumeContact, ResumeDocument, ResumeHeadingKey, ResumeSkills, SkillGroupKey } from '@/types/resumeDocument'
import { headingFor, jobRoleFor, skillGroupKeys, skillLabelFor, templateHeading, defaultSkillLabels, withHeading, withSkillLabel } from '@/utils/resumeLabels'
import { templates } from '@/utils/resumeTemplates'
import type { SkillsMode } from '@/utils/resumeTemplates'

export const PAGE_WIDTH = 794 // A4 at 96dpi
export const PAGE_HEIGHT = 1123

/** Scales the fixed-width page down to fit the panel while keeping true layout. */
function ScaledPage({ children, pageBreaks }: { children: ReactNode; pageBreaks?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(PAGE_HEIGHT)

  useEffect(() => {
    const measure = () => {
      if (!wrapRef.current || !innerRef.current) return
      setScale(Math.min(1, wrapRef.current.clientWidth / PAGE_WIDTH))
      setHeight(innerRef.current.offsetHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (wrapRef.current) observer.observe(wrapRef.current)
    if (innerRef.current) observer.observe(innerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="w-full">
      <div style={{ height: height * scale, width: PAGE_WIDTH * scale }} className="mx-auto">
        <div ref={innerRef} style={{ position: 'relative', width: PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {children}
          {/* Where the PDF moves on to the next A4 page (approximate: lines and headings never split). */}
          {pageBreaks &&
            Array.from({ length: Math.max(0, Math.ceil(height / PAGE_HEIGHT) - 1) }, (_, i) => (
              <div
                key={i}
                aria-hidden
                style={{ position: 'absolute', left: 0, right: 0, top: (i + 1) * PAGE_HEIGHT, borderTop: '1px dashed #9fb8ae', pointerEvents: 'none' }}
              >
                <span style={{ position: 'absolute', right: 8, top: 2, fontSize: 10, fontFamily: 'Arial, sans-serif', color: '#7a9188', background: '#fff', padding: '0 4px' }}>
                  Page {i + 2}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

const normalise = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * Click-to-edit text on the page itself. The DOM owns the text while focused (React never re-renders
 * into a contentEditable node), and the change is committed on blur or Enter; Escape cancels.
 */
function Editable({ value, label, placeholder, maxLength = 80, onCommit }: { value: string; label: string; placeholder?: string; maxLength?: number; onCommit: (text: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value
  }, [value])

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={label}
      title={`Click to edit ${label.toLowerCase()}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      className="resume-editable"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.currentTarget.textContent = value
          event.currentTarget.blur()
        }
      }}
      onPaste={(event) => {
        // Plain text only: pasted formatting would never reach the saved resume anyway.
        event.preventDefault()
        document.execCommand('insertText', false, normalise(event.clipboardData.getData('text/plain')))
      }}
      onBlur={(event) => {
        const text = normalise(event.currentTarget.textContent ?? '').slice(0, maxLength)
        if (text !== value) onCommit(text)
        // A cleared heading falls back to the template's; show that until the new value renders.
        event.currentTarget.textContent = text || value
      }}
    />
  )
}

function Heading({ css, children }: { css: CSSProperties; children: ReactNode }) {
  return <h2 style={css}>{children}</h2>
}

function Block({ gap, children }: { gap: number; children: ReactNode }) {
  return <section style={{ marginTop: gap }}>{children}</section>
}

const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16 }

function Bullets({ items }: { items: string[] }) {
  const filled = items.filter((item) => item.trim())
  if (filled.length === 0) return null
  return (
    <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: '2px 0 0' }}>
      {filled.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

function SkillsBlock({ skills, mode, accent, labelOf }: { skills: ResumeSkills; mode: SkillsMode; accent?: string; labelOf: (key: SkillGroupKey) => ReactNode }) {
  const groups = skillGroupKeys.filter((key) => skills[key].length > 0)
  if (mode === 'chips') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {groups.flatMap((key) => skills[key]).map((skill, index) => (
          <span key={index} style={{ border: `1px solid ${accent ?? '#999'}55`, background: '#f4f8f6', borderRadius: 999, padding: '1px 10px', fontSize: '0.92em' }}>
            {skill}
          </span>
        ))}
      </div>
    )
  }
  if (mode === 'grid') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, max-content) 1fr', rowGap: 3, columnGap: 12 }}>
        {groups.map((key) => (
          <div key={key} style={{ display: 'contents' }}>
            <strong>{labelOf(key)}</strong>
            <span>{skills[key].join(', ')}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <>
      {groups.map((key) => (
        <div key={key}>
          <strong>{labelOf(key)}:</strong> {skills[key].join(', ')}
        </div>
      ))}
    </>
  )
}

const contactItems = (c: ResumeContact) => [c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio].filter(Boolean)

/** Skeleton placeholder lines shown while the resume is still blank. */
const BlankSkeleton = () => (
  <div style={{ marginTop: 28 }}>
    {[['Summary', 3], ['Experience', 4], ['Education', 2], ['Skills', 1]] .map(([heading, lines]) => (
      <div key={heading as string} style={{ marginBottom: 22 }}>
        <div style={{ height: 11, width: 90, background: '#e4ebe7', borderRadius: 3, marginBottom: 10 }} />
        <div style={{ height: 1, background: '#dde5e1', marginBottom: 10 }} />
        {Array.from({ length: lines as number }).map((_, i) => (
          <div key={i} style={{ height: 9, background: '#edf2ef', borderRadius: 3, marginBottom: 6, width: i === (lines as number) - 1 ? '65%' : '90%' }} />
        ))}
      </div>
    ))}
    <p style={{ marginTop: 24, fontSize: 11, color: '#aaa', textAlign: 'center', letterSpacing: '0.01em' }}>
      Your resume will appear here as you fill in the sections on the left.
    </p>
  </div>
)

interface ResumePreviewProps {
  doc: ResumeDocument
  /** Makes the name, job role, tagline and every heading editable in place (editor only). */
  update?: ResumeUpdater
  /** Renders the page without the fit-to-width scaling wrapper, e.g. for printing. */
  bare?: boolean
}

/** Real-text documents: every layout uses standard headings and selectable text, which is what an ATS parser expects. */
export function ResumePreview({ doc, update, bare }: ResumePreviewProps) {
  const style = templates[doc.template]
  const { contact, summary, experience, education, projects, skills, certifications } = doc.content
  const items = contactItems(contact)
  const contactLine = items.join(' | ')
  const mode = style.skills ?? 'lines'
  const sidebar = style.layout === 'sidebar'

  const isBlank = !summary.trim() && experience.length + education.length + projects.length + certifications.length === 0 && !skills.technical.length && !skills.tools.length && !skills.other.length
  const hasSkills = skills.technical.length + skills.tools.length + skills.other.length > 0

  const setContact = (patch: Partial<ResumeContact>) => update?.((d) => ({ ...d, content: { ...d.content, contact: { ...d.content.contact, ...patch } } }))

  const label = (key: ResumeHeadingKey): ReactNode => {
    const text = headingFor(doc, key)
    if (!update) return text
    return (
      <Editable
        value={text}
        label={`${templateHeading(doc, key)} heading`}
        onCommit={(value) => update((d) => withHeading(d, key, value === templateHeading(d, key) ? '' : value))}
      />
    )
  }

  const skillLabel = (key: SkillGroupKey): ReactNode => {
    const text = skillLabelFor(doc, key)
    if (!update) return text
    return (
      <Editable
        value={text}
        label={`${defaultSkillLabels[key]} heading`}
        onCommit={(value) => update((d) => withSkillLabel(d, key, value === defaultSkillLabels[key] ? '' : value))}
      />
    )
  }

  const sections: Record<ResumeHeadingKey, ReactNode> = {
    summary: summary.trim() && (
      <Block key="summary" gap={style.sectionGap}>
        <Heading css={style.heading}>{label('summary')}</Heading>
        <p style={{ margin: 0 }}>{summary}</p>
      </Block>
    ),
    experience:
      experience.length > 0 && (
        <Block key="experience" gap={style.sectionGap}>
          <Heading css={style.heading}>{label('experience')}</Heading>
          {experience.map((item) => (
            <div key={item.id} style={{ marginBottom: style.itemGap }}>
              <div style={row}>
                <strong>{item.title}</strong>
                <span style={{ whiteSpace: 'nowrap' }}>{[item.start, item.end].filter(Boolean).join(' – ')}</span>
              </div>
              {(item.company || item.location) && <div style={{ fontStyle: 'italic' }}>{[item.company, item.location].filter(Boolean).join(', ')}</div>}
              {item.description && <p style={{ margin: '2px 0 0' }}>{item.description}</p>}
              <Bullets items={item.bullets} />
            </div>
          ))}
        </Block>
      ),
    education:
      education.length > 0 && (
        <Block key="education" gap={style.sectionGap}>
          <Heading css={style.heading}>{label('education')}</Heading>
          {education.map((item) => (
            <div key={item.id} style={{ marginBottom: style.itemGap }}>
              <div style={row}>
                <strong>{item.degree || item.institution}</strong>
                <span style={{ whiteSpace: 'nowrap' }}>{item.dates}</span>
              </div>
              {item.degree && (item.institution || item.location) && <div>{[item.institution, item.location].filter(Boolean).join(', ')}</div>}
              {item.details && <div>{item.details}</div>}
            </div>
          ))}
        </Block>
      ),
    projects:
      projects.length > 0 && (
        <Block key="projects" gap={style.sectionGap}>
          <Heading css={style.heading}>{label('projects')}</Heading>
          {projects.map((item) => (
            <div key={item.id} style={{ marginBottom: style.itemGap }}>
              <div style={row}>
                <strong>{item.name}</strong>
                {item.link && <span>{item.link}</span>}
              </div>
              {item.tech.length > 0 && <div style={{ fontStyle: 'italic' }}>{item.tech.join(', ')}</div>}
              {item.description && <p style={{ margin: '2px 0 0' }}>{item.description}</p>}
              <Bullets items={item.bullets} />
            </div>
          ))}
        </Block>
      ),
    skills:
      hasSkills && (
        <Block key="skills" gap={style.sectionGap}>
          <Heading css={style.heading}>{label('skills')}</Heading>
          <SkillsBlock skills={skills} mode={mode} accent={style.accent} labelOf={skillLabel} />
        </Block>
      ),
    certifications:
      certifications.length > 0 && (
        <Block key="certifications" gap={style.sectionGap}>
          <Heading css={style.heading}>{label('certifications')}</Heading>
          {certifications.map((item) => (
            <div key={item.id} style={row}>
              <span>
                <strong>{item.name}</strong>
                {item.issuer && `, ${item.issuer}`}
                {item.link && ` (${item.link})`}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{item.date}</span>
            </div>
          ))}
        </Block>
      ),
  }

  // ── Header: name, then job role and tagline, then (per layout) the contact details ──
  const band = style.layout === 'band'
  const role = jobRoleFor(doc).trim()
  const tagline = (contact.tagline ?? '').trim()
  const roleLine = role ? (
    <p style={{ margin: '2px 0 0', color: band ? '#a7f3d0' : style.accent ?? '#555', fontSize: '1.05em' }}>
      {update ? <Editable value={role} label="Job role" maxLength={300} onCommit={(value) => setContact({ role: value })} /> : role}
    </p>
  ) : null
  const taglineLine = tagline ? (
    <p style={{ margin: '3px 0 0', color: band ? '#e2efe9' : '#555', fontSize: '0.95em' }}>
      {update ? <Editable value={tagline} label="Tagline" maxLength={300} onCommit={(value) => setContact({ tagline: value })} /> : tagline}
    </p>
  ) : null
  const subLines = (roleLine || taglineLine) && (
    <div style={{ textAlign: style.layout === 'single' ? style.name.textAlign : undefined }}>
      {roleLine}
      {taglineLine}
    </div>
  )
  const nameColor = style.name.color ?? '#111'
  const nameEl = (
    <h1 style={{ ...style.name, color: contact.name || update ? nameColor : '#aaa', margin: 0, lineHeight: 1.15 }}>
      {update ? <Editable value={contact.name} label="Name" placeholder="Your Name" maxLength={300} onCommit={(value) => setContact({ name: value })} /> : contact.name || 'Your Name'}
    </h1>
  )

  const body = (
    <>
      {sections.summary}
      {doc.sectionOrder.filter((key) => !(sidebar && key === 'skills')).map((key) => sections[key])}
      {isBlank && <BlankSkeleton />}
    </>
  )

  const articleBase: CSSProperties = { ...style.page, color: style.page.color ?? '#111', minHeight: PAGE_HEIGHT, boxSizing: 'border-box' }
  const frame = 'resume-page bg-white'

  let content: ReactNode
  if (sidebar) {
    content = (
      <article aria-label="Resume preview" className={frame} style={{ ...articleBase, display: 'grid', gridTemplateColumns: '230px 1fr' }}>
        <aside style={{ background: style.soft, padding: '52px 24px' }}>
          <h2 style={{ ...style.heading, marginBottom: 8 }}>Contact</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, wordBreak: 'break-word', fontSize: '0.92em', color: '#333' }}>
            {items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          {hasSkills && (
            <Block gap={style.sectionGap}>
              <Heading css={style.heading}>{label('skills')}</Heading>
              <div style={{ fontSize: '0.92em' }}>
                <SkillsBlock skills={skills} mode="lines" labelOf={skillLabel} />
              </div>
            </Block>
          )}
        </aside>
        <div style={{ padding: '52px 44px 56px 36px' }}>
          <header>
            {nameEl}
            {subLines}
          </header>
          {body}
        </div>
      </article>
    )
  } else if (band) {
    content = (
      <article aria-label="Resume preview" className={frame} style={articleBase}>
        <header style={{ background: style.accent, padding: '44px 60px 34px' }}>
          {nameEl}
          {subLines}
          {contactLine && <p style={{ margin: '12px 0 0', ...style.contact }}>{contactLine}</p>}
        </header>
        <div style={{ padding: '10px 60px 56px' }}>{body}</div>
      </article>
    )
  } else {
    content = (
      <article aria-label="Resume preview" className={frame} style={{ ...articleBase, padding: style.pad ?? '56px 60px' }}>
        {style.layout === 'split' ? (
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, borderBottom: `2px solid ${style.accent}`, paddingBottom: 14 }}>
            <div>
              {nameEl}
              {subLines}
            </div>
            <div style={{ ...style.contact, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              {items.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </header>
        ) : (
          <header>
            {nameEl}
            {subLines}
            {contactLine && <p style={{ margin: '6px 0 0', ...style.contact }}>{contactLine}</p>}
          </header>
        )}
        {body}
      </article>
    )
  }

  return bare ? <>{content}</> : <ScaledPage pageBreaks={Boolean(update)}>{content}</ScaledPage>
}

import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LandingContainer } from '@/components/landing/LandingContainer'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { legalInfo, legalPages } from '@/components/legal/legalInfo'
import { cn } from '@/utils/cn'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

interface LegalDocumentProps {
  title: string
  summary: ReactNode
  sections: LegalSection[]
}

/** Emerald inline link used inside policy text. Internal paths use the router, everything else a plain anchor. */
export function LegalLink({ to, children }: { to: string; children: ReactNode }) {
  const className = 'text-[#10B981] underline decoration-[#10B981]/40 underline-offset-2 hover:decoration-[#10B981]'
  if (to.startsWith('/')) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <a href={to} className={className}>
      {children}
    </a>
  )
}

export function MailLink({ email }: { email: string }) {
  return <LegalLink to={`mailto:${email}`}>{email}</LegalLink>
}

/** Shared page shell for every policy under /legal: title, dates, contents, sections and links to the other policies. */
export function LegalDocument({ title, summary, sections }: LegalDocumentProps) {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-dvh flex-col bg-[#030706] text-[#F5F7F6]">
      <div className="relative flex-1 pt-8 pb-20 sm:pt-12 sm:pb-28">
        <LandingContainer className="max-w-[1120px]">
          <header className="max-w-3xl">
            <span className="block text-xs font-semibold tracking-widest text-[#10B981] uppercase">Legal</span>
            <h1 className="mt-3 font-editorial text-4xl leading-[1.1] font-medium tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-3 text-sm text-[#6F7D79]">
              Effective {legalInfo.effectiveDate} · Last updated {legalInfo.lastUpdated}
            </p>
            <div className="mt-5 rounded-[14px] border border-[#19352F] bg-[#071A17]/80 p-5 text-sm leading-relaxed text-[#A7B5B1] sm:text-base">{summary}</div>
          </header>

          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
            <aside className="lg:sticky lg:top-24 lg:w-60 lg:shrink-0">
              <nav aria-label="On this page">
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#6F7D79] uppercase">On this page</p>
                <ol className="space-y-1 text-sm">
                  {sections.map((section, index) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`} className="block rounded-md py-1 text-[#A7B5B1] transition-colors hover:text-[#10B981]">
                        {index + 1}. {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <nav aria-label="Other policies" className="mt-8 hidden lg:block">
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#6F7D79] uppercase">Policies</p>
                <ul className="space-y-1 text-sm">
                  {legalPages.map((page) => (
                    <li key={page.path}>
                      <Link
                        to={page.path}
                        aria-current={page.path === pathname ? 'page' : undefined}
                        className={cn('block py-1 transition-colors hover:text-[#10B981]', page.path === pathname ? 'font-semibold text-[#F5F7F6]' : 'text-[#A7B5B1]')}
                      >
                        {page.short}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            <article className="min-w-0 max-w-3xl flex-1">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28 border-t border-[#19352F]/70 py-8 first:border-t-0 first:pt-0">
                  <h2 id={`${section.id}-title`} className="font-editorial text-2xl font-medium tracking-tight text-[#F5F7F6]">
                    {index + 1}. {section.title}
                  </h2>
                  <div
                    className={cn(
                      'mt-4 space-y-3 text-[15px] leading-relaxed text-[#A7B5B1]',
                      '[&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#F5F7F6]',
                      '[&_strong]:font-semibold [&_strong]:text-[#F5F7F6]',
                      '[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
                      '[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border-b [&_th]:border-[#19352F] [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[#F5F7F6]',
                      '[&_td]:border-b [&_td]:border-[#19352F]/60 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top',
                    )}
                  >
                    {section.body}
                  </div>
                </section>
              ))}

              <div className="mt-4 rounded-[14px] border border-[#19352F] bg-[#071A17]/60 p-5 text-sm text-[#A7B5B1]">
                Questions about this policy? Write to <MailLink email={legalInfo.supportEmail} /> and we’ll reply within {legalInfo.replyDays} business days.
              </div>

              <nav aria-label="Other policies" className="mt-10 lg:hidden">
                <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#6F7D79] uppercase">Other policies</p>
                <ul className="flex flex-wrap gap-2 text-sm">
                  {legalPages
                    .filter((page) => page.path !== pathname)
                    .map((page) => (
                      <li key={page.path}>
                        <Link to={page.path} className="inline-block rounded-full border border-[#19352F] px-3 py-1.5 text-[#A7B5B1] transition-colors hover:border-[#10B981]/50 hover:text-[#10B981]">
                          {page.short}
                        </Link>
                      </li>
                    ))}
                </ul>
              </nav>
            </article>
          </div>
        </LandingContainer>
      </div>
      <LandingFooter />
    </div>
  )
}

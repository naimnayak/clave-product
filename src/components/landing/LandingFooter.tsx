import { Link, useNavigate } from 'react-router-dom'
import { ClaveLogo, ClaveMark } from '@/components/brand/ClaveLogo'
import { LandingContainer } from '@/components/landing/LandingContainer'
import { legalPages } from '@/components/legal/legalInfo'
import { paths } from '@/routes/navigation'
import { navigateWithTransition } from '@/utils/transitionNavigation'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export function LandingFooter() {
  const navigate = useNavigate()

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    e.preventDefault()
    navigateWithTransition(navigate, to)
  }

  return (
    <footer
      className="relative border-t border-[#19352F] text-[#F5F7F6] overflow-hidden"
      style={{
        backgroundColor: '#030706',
        backgroundImage: `
          radial-gradient(circle at 2% 0%, rgba(8, 127, 91, 0.16) 0%, transparent 35%),
          radial-gradient(circle at 98% 100%, rgba(16, 185, 129, 0.12) 0%, transparent 35%)
        `,
      }}
    >
      <LandingContainer className="max-w-[1240px] pt-14 sm:pt-16 pb-10">
        {/* Top 4-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
          {/* Column 1: Brand Column (Span 5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col items-start pr-0 lg:pr-8">
            <Link
              to={paths.landing}
              onClick={(e) => handleLinkClick(e, paths.landing)}
              aria-label="Clave home"
              className="rounded-control"
            >
              <ClaveLogo reverse />
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-[#A7B5B1] max-w-sm">
              AI-powered career tools for students and early-career professionals.
            </p>

            <p className="mt-2 text-xs text-[#6F7D79]">
              Built by Atelier Devs.
            </p>

            {/* Social Icons: 36x36px buttons */}
            <div className="flex items-center gap-2.5 mt-5">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Clave on LinkedIn"
                className="size-9 flex items-center justify-center rounded-[8px] border border-[#19352F] bg-transparent text-[#6F7D79] transition-all duration-150 hover:border-[#10B981]/50 hover:bg-[#071A17] hover:text-[#10B981] btn-micro-interact"
              >
                <LinkedInIcon className="size-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Clave on Instagram"
                className="size-9 flex items-center justify-center rounded-[8px] border border-[#19352F] bg-transparent text-[#6F7D79] transition-all duration-150 hover:border-[#10B981]/50 hover:bg-[#071A17] hover:text-[#10B981] btn-micro-interact"
              >
                <InstagramIcon className="size-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Clave on GitHub"
                className="size-9 flex items-center justify-center rounded-[8px] border border-[#19352F] bg-transparent text-[#6F7D79] transition-all duration-150 hover:border-[#10B981]/50 hover:bg-[#071A17] hover:text-[#10B981] btn-micro-interact"
              >
                <GithubIcon className="size-4" />
              </a>
            </div>
          </div>

          {/* Thin vertical separator on desktop */}
          <div className="hidden lg:block lg:col-span-1 w-px h-36 bg-[#19352F]/70 self-center mx-auto" />

          {/* Column 2: Product (Span 2 cols on lg) */}
          <div className="lg:col-span-2">
            <span className="text-[11px] font-semibold tracking-wider text-[#A7B5B1] uppercase block mb-3.5">
              PRODUCT
            </span>
            <ul className="space-y-2.5 text-sm text-[#A7B5B1]">
              <li>
                <a
                  href={paths.howItWorks}
                  onClick={(e) => handleLinkClick(e, paths.howItWorks)}
                  className="transition-colors duration-150 hover:text-[#10B981] cursor-pointer"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  href={paths.pricing}
                  onClick={(e) => handleLinkClick(e, paths.pricing)}
                  className="transition-colors duration-150 hover:text-[#10B981] cursor-pointer"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  href={paths.about}
                  onClick={(e) => handleLinkClick(e, paths.about)}
                  className="transition-colors duration-150 hover:text-[#10B981] cursor-pointer"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href={paths.contact}
                  onClick={(e) => handleLinkClick(e, paths.contact)}
                  className="transition-colors duration-150 hover:text-[#10B981] cursor-pointer"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources (Span 2 cols on lg) */}
          <div className="lg:col-span-2">
            <span className="text-[11px] font-semibold tracking-wider text-[#A7B5B1] uppercase block mb-3.5">
              RESOURCES
            </span>
            <ul className="space-y-2.5 text-sm text-[#A7B5B1]">
              <li>
                <a
                  href={paths.guide}
                  onClick={(e) => handleLinkClick(e, paths.guide)}
                  className="transition-colors duration-150 hover:text-[#10B981] cursor-pointer"
                >
                  User Guide
                </a>
              </li>
              <li>
                <a
                  href={paths.createFromTemplate}
                  onClick={(e) => handleLinkClick(e, paths.createFromTemplate)}
                  className="transition-colors duration-150 hover:text-[#10B981] cursor-pointer"
                >
                  Resume Templates
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal (Span 2 cols on lg) */}
          <div className="lg:col-span-2">
            <span className="text-[11px] font-semibold tracking-wider text-[#A7B5B1] uppercase block mb-3.5">
              LEGAL
            </span>
            <ul className="space-y-2.5 text-sm text-[#A7B5B1]">
              {legalPages.map((page) => (
                <li key={page.path}>
                  <a
                    href={page.path}
                    onClick={(e) => handleLinkClick(e, page.path)}
                    className="transition-colors duration-150 hover:text-[#10B981] cursor-pointer"
                  >
                    {page.short}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 5. Bottom bar */}
        <div className="mt-12 sm:mt-16 pt-7 border-t border-[#19352F] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-[#6F7D79]">
          <p>© 2026 Clave. All rights reserved.</p>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#6F7D79]">
            <ClaveMark size={14} className="opacity-75" />
            <span>Built with purpose for every student.</span>
          </div>
        </div>
      </LandingContainer>
    </footer>
  )
}

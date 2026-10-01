import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { ClaveLogo } from '@/components/brand/ClaveLogo'
import { LandingContainer } from '@/components/landing/LandingContainer'
import { LandingCtas } from '@/components/landing/LandingCtas'
import { paths } from '@/routes/navigation'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'
import { navigateWithTransition } from '@/utils/transitionNavigation'

interface NavItem {
  id: string
  label: string
  href: string
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', href: paths.landing },
  { id: 'how-it-works', label: 'How it works', href: paths.howItWorks },
  { id: 'about', label: 'About', href: paths.about },
  { id: 'contact', label: 'Contact', href: paths.contact },
  { id: 'pricing', label: 'Pricing', href: paths.pricing },
]

const drawerNavItems: NavItem[] = [
  { id: 'how-it-works', label: 'How it works', href: paths.howItWorks },
  { id: 'about', label: 'About', href: paths.about },
  { id: 'contact', label: 'Contact', href: paths.contact },
  { id: 'pricing', label: 'Pricing', href: paths.pricing },
]

export function LandingHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const signedIn = useAuthStore((state) => state.user !== null)
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const isAboutPage = normalizedPath === paths.about
  const isPricingPage = normalizedPath === paths.pricing
  const isHowItWorksPage = normalizedPath === paths.howItWorks
  const isContactPage = normalizedPath === paths.contact
  const isLandingPage = normalizedPath === paths.landing

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [isScrolled, setIsScrolled] = useState(false)
  const lastScrollY = useRef(0)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const prevOpenRef = useRef(false)

  // Track scroll direction for show/hide and glass background
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY.current

      // Scrolled state (for glass background when floating over sections)
      setIsScrolled(currentScrollY > 40)

      // Always show when near the very top of the page
      if (currentScrollY <= 80) {
        setIsVisible(true)
      } else if (delta > 8) {
        // Scrolling DOWN -> Hide
        setIsVisible(false)
      } else if (delta < -8) {
        // Scrolling UP -> Show
        setIsVisible(true)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Prevent background scrolling while mobile drawer is open and restore on close
  useEffect(() => {
    if (mobileMenuMounted) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [mobileMenuMounted])

  const openMobileMenu = () => {
    setMobileMenuMounted(true)
    requestAnimationFrame(() => {
      setMobileMenuOpen(true)
    })
  }

  const closeMobileMenu = (callback?: () => void) => {
    setMobileMenuOpen(false)
    setTimeout(() => {
      setMobileMenuMounted(false)
      callback?.()
    }, 260)
  }

  // Keyboard Escape & focus management for mobile drawer
  useEffect(() => {
    if (mobileMenuOpen) {
      closeButtonRef.current?.focus()
    } else if (prevOpenRef.current) {
      triggerButtonRef.current?.focus()
    }
    prevOpenRef.current = mobileMenuOpen

    if (!mobileMenuOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenu()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    e.preventDefault()
    closeMobileMenu()

    const isCurrentPage =
      (item.id === 'home' && isLandingPage) ||
      (item.id === 'about' && isAboutPage) ||
      (item.id === 'pricing' && isPricingPage) ||
      (item.id === 'how-it-works' && isHowItWorksPage) ||
      (item.id === 'contact' && isContactPage)

    if (isCurrentPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    navigateWithTransition(navigate, item.href)
  }

  const isItemActive = (id: string) => {
    switch (id) {
      case 'home':
        return isLandingPage
      case 'how-it-works':
        return isHowItWorksPage
      case 'about':
        return isAboutPage
      case 'contact':
        return isContactPage
      case 'pricing':
        return isPricingPage
      default:
        return false
    }
  }

  const showNav = isVisible || mobileMenuMounted

  return (
    <>
      {/* Document flow spacer to preserve exact hero positioning */}
      <div className="h-20 shrink-0" aria-hidden="true" />

      {/* Smart sticky navbar that hides on scroll-down and appears on scroll-up */}
      <header
        className={cn(
          'marketing-header-persistent fixed top-0 inset-x-0 z-40 transition-all duration-300 ease-in-out',
          showNav ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none',
          isScrolled
            ? 'bg-black/85 backdrop-blur-[16px] border-b border-white/[0.08] shadow-lg shadow-black/25'
            : 'bg-transparent border-b border-transparent'
        )}
      >
        <LandingContainer className="relative flex h-20 items-center justify-between">
          {/* Left: Clave logo & wordmark — untouched, strictly navigates Home */}
          <Link
            to={paths.landing}
            onClick={(e) => {
              if (!isLandingPage) {
                e.preventDefault()
                navigateWithTransition(navigate, paths.landing)
              }
            }}
            aria-label="Clave home"
            className="rounded-control z-10 shrink-0"
          >
            <ClaveLogo reverse />
          </Link>

          {/* Center: Desktop translucent glass pill navigation (hidden on mobile) */}
          <nav
            aria-label="Main navigation"
            className="absolute left-1/2 -translate-x-1/2 z-10 hidden md:flex h-[44px] items-center gap-1.5 rounded-full border border-white/[0.18] bg-white/[0.04] px-2 backdrop-blur-[12px] shadow-2xs"
          >
            {navItems.map((item) => {
              const isActive = isItemActive(item.id)
              return (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item)}
                  className={cn(
                    'flex items-center rounded-full px-3.5 py-1.5 text-[14px] font-medium leading-none transition-all duration-200 ease-out cursor-pointer select-none',
                    isActive
                      ? 'bg-[#10B981]/15 text-[#10B981]'
                      : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                  )}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>

          {/* Right: Actions on Desktop, Clean 44x44 Hamburger Button on Mobile */}
          <div className="z-10 flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Desktop CTAs (hidden on mobile) */}
            <div className="hidden md:flex items-center [&_a]:!rounded-full">
              <LandingCtas size="sm" tone="dark" />
            </div>

            {/* Mobile Hamburger Menu Button (min 44x44px touch target, 3-line icon, no label) */}
            <button
              ref={triggerButtonRef}
              type="button"
              onClick={openMobileMenu}
              aria-label="Open navigation"
              aria-expanded={mobileMenuMounted}
              className="flex md:hidden h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.04] text-white/90 backdrop-blur-[12px] transition-all duration-150 hover:bg-white/[0.08] hover:text-white active:scale-95 cursor-pointer btn-micro-interact"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </LandingContainer>
      </header>

      {/* Full-Screen Mobile Navigation Overlay / Drawer */}
      {mobileMenuMounted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={cn(
            'fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto overflow-x-hidden text-[#F5F7F6] md:hidden transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          style={{
            backgroundColor: '#030706',
            backgroundImage: `
              radial-gradient(circle at 4% 6%, rgba(8, 127, 91, 0.22) 0%, transparent 40%),
              radial-gradient(circle at 96% 94%, rgba(16, 185, 129, 0.16) 0%, transparent 40%)
            `,
          }}
        >
          {/* Top Bar of Drawer: Logo on left, Circular 48x48 Close (x) button on right */}
          <div className="flex h-20 items-center justify-between px-6 border-b border-[#19352F]/70 shrink-0 relative z-10">
            <Link
              to={paths.landing}
              onClick={(e) => {
                e.preventDefault()
                closeMobileMenu(() => navigateWithTransition(navigate, paths.landing))
              }}
              aria-label="Clave home"
              className="rounded-control shrink-0"
            >
              <ClaveLogo reverse />
            </Link>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => closeMobileMenu()}
              aria-label="Close navigation"
              className="flex size-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-[#19352F] bg-white/[0.04] text-[#F5F7F6] transition-all duration-150 hover:border-[#10B981]/50 hover:bg-white/[0.08] active:scale-95 cursor-pointer btn-micro-interact"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation Links: Begins ~64-72px below header with 40ms stagger */}
          <div
            className={cn(
              'px-6 pt-12 sm:pt-14 pb-8 flex-1 relative z-10 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              mobileMenuOpen ? 'translate-y-0' : 'translate-y-3'
            )}
          >
            <nav aria-label="Mobile navigation menu" className="flex flex-col">
              {drawerNavItems.map((item, index) => {
                const isActive = isItemActive(item.id)
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault()
                      closeMobileMenu(() => navigateWithTransition(navigate, item.href))
                    }}
                    style={{
                      transitionDelay: mobileMenuOpen ? `${index * 40}ms` : '0ms',
                    }}
                    className={cn(
                      'group flex items-center justify-between py-5 sm:py-5.5 border-b border-[#19352F]/50 transition-all duration-200 cursor-pointer',
                      mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
                      isActive ? 'text-[#10B981]' : 'text-[#F5F7F6]/85 hover:text-white'
                    )}
                  >
                    <span className={cn('text-[22px] sm:text-[24px] font-medium tracking-tight', isActive && 'font-semibold')}>
                      {item.label}
                    </span>
                    <ArrowRight
                      className={cn(
                        'size-5 shrink-0 transition-transform duration-150',
                        isActive
                          ? 'text-[#10B981]'
                          : 'text-[#6F7D79] group-hover:text-white group-hover:translate-x-1'
                      )}
                      aria-hidden="true"
                    />
                  </a>
                )
              })}
            </nav>
          </div>

          {/* Bottom Actions Area: 56px Full-width pill buttons with subtle top divider */}
          <div className="mt-auto border-t border-[#19352F]/70 pt-6 sm:pt-8 pb-8 px-6 relative z-10 flex flex-col gap-3.5 shrink-0">
            {signedIn ? (
              <Link
                to={paths.dashboard}
                onClick={(e) => {
                  e.preventDefault()
                  closeMobileMenu(() => navigateWithTransition(navigate, paths.dashboard))
                }}
                className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#087F5B] px-6 text-base font-semibold text-white shadow-xs transition-all hover:bg-[#056B4D] active:scale-[0.99] cursor-pointer btn-micro-interact"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="size-5" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to={paths.signup}
                  onClick={(e) => {
                    e.preventDefault()
                    closeMobileMenu(() => navigateWithTransition(navigate, paths.signup))
                  }}
                  className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#087F5B] px-6 text-base font-semibold text-white shadow-xs transition-all hover:bg-[#056B4D] active:scale-[0.99] cursor-pointer btn-micro-interact"
                >
                  <span>Get Started</span>
                  <ArrowRight className="size-5" aria-hidden="true" />
                </Link>

                <Link
                  to={paths.login}
                  onClick={(e) => {
                    e.preventDefault()
                    closeMobileMenu(() => navigateWithTransition(navigate, paths.login))
                  }}
                  className="inline-flex h-[56px] w-full items-center justify-center rounded-full border border-[#19352F] bg-white/[0.04] px-6 text-base font-medium text-[#F5F7F6] transition-all hover:bg-white/[0.08] active:scale-[0.99] cursor-pointer btn-micro-interact"
                >
                  Log in
                </Link>
              </>
            )}
          </div>

          {/* Decorative Detail: Extremely subtle oversized Clave leaf outline partially cropped */}
          <svg
            viewBox="0 0 120 120"
            fill="none"
            stroke="currentColor"
            className="pointer-events-none absolute -bottom-10 -right-10 size-64 text-[#10B981] opacity-[0.04] select-none z-0"
            aria-hidden="true"
          >
            <path
              d="M20 100 C20 40, 60 15, 105 15 C105 60, 80 100, 20 100 Z"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 100 C50 70, 75 45, 105 15"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </>
  )
}

import { Briefcase, FileText, Loader2, Lock, MessageSquare, Mic, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import upgradeSideImage from '@/assets/upgrade_side_image.png'
import { useSubscription } from '@/hooks/useSubscription'
import { startCheckout } from '@/services/payment.service'
import type { PaidPlan } from '@/services/payment.service'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'

interface BenefitItem {
  icon: typeof FileText
  title: string
  description: string
}

const BENEFITS: BenefitItem[] = [
  {
    icon: Briefcase,
    title: 'Your personal job feed',
    description: 'Jobs from LinkedIn, Indeed, Naukri, Internshala and Foundit, matched to your resume and job descriptions.',
  },
  {
    icon: FileText,
    title: 'Unlimited resumes',
    description: 'Create, tailor and duplicate as many resumes as you need.',
  },
  {
    icon: Mic,
    title: 'Unlimited mock interviews',
    description: "Practice for the roles you're targeting, with feedback on every answer.",
  },
  {
    icon: MessageSquare,
    title: 'More from your career assistant',
    description: '100 messages a day and 300 AI actions, with memory of your goals.',
  },
]

interface UpgradeModalProps {
  onUpgrade?: () => void
}

export function UpgradeModal({ onUpgrade }: UpgradeModalProps) {
  const isOpen = useUpgradeModalStore((s) => s.isOpen)
  const closeUpgradeModal = useUpgradeModalStore((s) => s.closeUpgradeModal)
  const modalRef = useRef<HTMLDivElement>(null)
  const [paying, setPaying] = useState<PaidPlan | null>(null)
  const { isPro } = useSubscription()

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeUpgradeModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeUpgradeModal])

  // Prevent scrolling behind modal
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const pay = async (plan: PaidPlan) => {
    if (onUpgrade) {
      onUpgrade()
      closeUpgradeModal()
      return
    }
    setPaying(plan)
    // Razorpay opens its own overlay; close ours so the two don't stack.
    closeUpgradeModal()
    try {
      await startCheckout(plan)
    } finally {
      setPaying(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
    >
      {/* Dark translucent backdrop: rgba(17, 19, 18, 0.65) */}
      <div
        className="fixed inset-0 bg-text/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={closeUpgradeModal}
        aria-hidden="true"
      />

      {/* Modal Dialog Card:
          Mobile: Single vertical sheet, 93% viewport (max 440px), rounded-[20px]
          Desktop: Two-panel modal, 940px wide x 590px high, rounded-[16px] */}
      <div
        ref={modalRef}
        className="relative z-10 flex w-[93%] max-w-[440px] max-h-[94vh] flex-col overflow-y-auto overflow-x-hidden rounded-[20px] border border-border bg-surface shadow-2xl animate-in zoom-in-95 duration-200 md:h-[590px] md:max-h-none md:w-full md:max-w-[940px] md:flex-row md:overflow-hidden md:rounded-[16px]"
      >
        {/* Close Button:
            Mobile: Floating circular white button in top right over artwork
            Desktop: Top-right button */}
        <button
          type="button"
          onClick={closeUpgradeModal}
          className="absolute right-3.5 top-3.5 z-30 flex size-8 items-center justify-center rounded-full bg-surface/95 text-text shadow-sm transition-all hover:bg-surface active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer md:right-4 md:top-4 md:size-9 md:bg-transparent md:text-secondary md:shadow-none md:hover:bg-neutral-100 md:hover:text-text"
          aria-label="Close modal"
        >
          <X className="size-4" strokeWidth={2} />
        </button>

        {/* TOP / LEFT PANEL — VISUAL ARTWORK */}
        <div className="relative h-[165px] w-full shrink-0 overflow-hidden bg-[#062B22] sm:h-[180px] md:h-full md:w-[45%] md:shrink">
          <img
            src={upgradeSideImage}
            alt="Clave Pro visual artwork"
            className="h-full w-full object-cover object-[center_35%] select-none pointer-events-none"
          />
          {/* Subtle gradient treatment */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061A18]/30 via-transparent to-transparent" />

          {/* Drag handle pill (Mobile only) */}
          <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 h-1 w-9 rounded-full bg-surface/45 md:hidden" />
        </div>

        {/* PRO VALUE & BENEFITS CONTENT AREA */}
        <div className="relative z-10 -mt-3.5 flex w-full flex-1 flex-col justify-between rounded-t-[20px] bg-surface px-5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6 md:mt-0 md:w-[55%] md:rounded-none md:p-8 lg:p-9">
          <div>
            {/* Small Badge */}
            <div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                CLAVE PRO
              </span>
            </div>

            {/* Main Editorial Heading */}
            <h2
              id="upgrade-modal-title"
              className="mt-2.5 font-editorial text-[26px] sm:text-[28px] md:text-3xl font-medium tracking-tight text-text leading-[1.1]"
            >
              Unlock your next career move.
            </h2>

            {/* Supporting Copy */}
            <p className="mt-1.5 text-[13px] sm:text-[13.5px] leading-relaxed text-secondary">
              Clave Pro finds jobs that fit your resume, and gives you unlimited resumes and interview practice.
            </p>

            {/* Benefits List */}
            <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-3.5">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon
                return (
                  <div key={benefit.title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Icon className="size-3.5 sm:size-4" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] sm:text-[13.5px] font-semibold text-text leading-snug">{benefit.title}</h3>
                      <p className="text-[12px] sm:text-[12.5px] leading-snug text-secondary">{benefit.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-5 sm:mt-6 pt-1">
            <button
              type="button"
              onClick={() => void pay('monthly')}
              disabled={paying !== null || isPro === true}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-6 text-[15px] font-medium text-on-primary shadow-xs transition-all duration-150 hover:bg-primary-deep active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
            >
              {paying === 'monthly' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>{isPro ? 'You’re on Clave Pro' : 'Get Clave Pro · ₹199 / month →'}</span>
            </button>

            {!isPro && (
              <button
                type="button"
                onClick={() => void pay('single')}
                disabled={paying !== null}
                className="mt-2 w-full text-center text-[13px] font-medium text-primary-deep underline-offset-2 hover:underline disabled:opacity-60"
              >
                Just need one more resume? Buy one for ₹49
              </button>
            )}

            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Lock className="size-3 text-muted" aria-hidden="true" />
              <span>Secure payment by Razorpay · 30 days, no auto-renewal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

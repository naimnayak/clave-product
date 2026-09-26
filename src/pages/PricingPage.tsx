import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import GradientWaves from '@/components/effects/GradientWaves'
import { LandingContainer } from '@/components/landing/LandingContainer'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { paths } from '@/routes/navigation'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'
import { ScrollReveal } from '@/components/transitions/ScrollReveal'


const COMPARISON_ROWS = [
  {
    feature: 'Number of resumes',
    free: '1',
    unlimited: 'Unlimited',
    single: '1',
  },
  {
    feature: 'ATS-friendly templates',
    free: true,
    unlimited: true,
    single: true,
  },
  {
    feature: 'AI resume generation',
    free: false,
    unlimited: true,
    single: true,
  },
  {
    feature: 'ATS analysis',
    free: 'Basic',
    unlimited: 'Advanced',
    single: true,
  },
  {
    feature: 'Resume tailoring',
    free: 'Limited',
    unlimited: 'Unlimited',
    single: true,
  },
  {
    feature: 'Job recommendations',
    free: 'Limited',
    unlimited: 'Personalized',
    single: true,
  },
  {
    feature: 'Premium templates',
    free: false,
    unlimited: true,
    single: true,
  },
  {
    feature: 'Priority support',
    free: false,
    unlimited: true,
    single: false,
  },
]

const FAQ_ITEMS = [
  {
    question: 'Can I use Clave for free?',
    answer:
      'Yes. The Free plan lets you create one resume and explore the core Clave experience without a subscription.',
  },
  {
    question: 'What does the ₹49 plan include?',
    answer:
      'The Single Resume plan gives you everything you need to create one complete, polished resume, including AI generation and ATS analysis.',
  },
  {
    question: 'What does unlimited mean?',
    answer:
      'Monthly Unlimited allows you to create and tailor as many resumes as you need during your active subscription.',
  },
  {
    question: 'Can I cancel the ₹199 monthly plan?',
    answer:
      'There’s nothing to cancel. Monthly Unlimited is a one-time payment for 30 days and never renews automatically. If you haven’t used it, you can ask for a full refund within 7 days (see our Refund & Cancellation Policy).',
  },
  {
    question: 'Can I create different resumes for different jobs?',
    answer:
      'Yes. Clave is designed to help you tailor your resume to different opportunities while keeping your Career Profile as the source of truth.',
  },
]

export function PricingPage() {
  const openUpgradeModal = useUpgradeModalStore((s) => s.openUpgradeModal)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  const renderCellContent = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="size-4 text-[#10B981] mx-auto" aria-label="Included" />
      ) : (
        <span className="text-[#6F7D79]">—</span>
      )
    }
    return <span className="text-sm font-medium text-[#F5F7F6]">{value}</span>
  }

  return (
    <div className="relative min-h-dvh flex flex-col bg-black text-[#F5F7F6] overflow-hidden">
      {/* Emerald gradient waves on black background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-55">
        <GradientWaves
          horizonColor="#000000"
          waveColor="#087F5B"
          crestColor="#10B981"
          speed={0.25}
          fogDepth={40}
          height={2.8}
          brightness={1.05}
          grainIntensity={0.03}
        />
      </div>

      {/* Atmospheric vignette overlays to keep pricing cards and typography crisp and readable on black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90"
      />

      <main className="relative z-10 flex-1 pt-1 sm:pt-2 lg:pt-3 pb-16 sm:pb-20 lg:pb-28">
        <LandingContainer className="max-w-[1200px]">
          {/* PRICING HERO: Compact and balanced to fit cards above fold */}
          <div className="text-center max-w-xl mx-auto">
            <span className="animate-entrance-eyebrow text-[11px] font-semibold tracking-widest text-[#10B981] uppercase block">
              PRICING
            </span>

            <h1 className="animate-entrance-heading mt-1.5 font-editorial text-3xl sm:text-4xl lg:text-[42px] font-medium tracking-tight text-[#F5F7F6] leading-[1.1]">
              Simple pricing.{' '}
              <span className="inline-block sm:inline">
                Built for{' '}
                <em className="text-[#10B981] font-normal italic font-editorial">your career.</em>
              </span>
            </h1>

            <p className="animate-entrance-subtext mt-2 text-xs sm:text-[14px] leading-relaxed text-[#A7B5B1]">
              Start free, pay only when you need more, or create unlimited resumes with Clave.
            </p>
          </div>

          {/* THREE PRICING CARDS: Center card is prominent & larger, side cards are smaller and compact */}
          <div className="animate-entrance-cta mt-6 sm:mt-7 lg:mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 items-center">
            {/* SIDE CARD 1 — FREE (Smaller & compact) */}
            <div className="relative flex flex-col justify-between rounded-[16px] border border-[#19352F] bg-[#071A17]/60 p-5 sm:p-5.5 lg:p-6 backdrop-blur-sm lg:scale-[0.97] transition-transform duration-200 hover:border-[#19352F]/90">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6]">Free</h2>
                <p className="mt-0.5 text-xs text-[#A7B5B1]">Get started with the essentials.</p>

                <div className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F5F7F6]">₹0</span>
                  <span className="text-xs text-[#A7B5B1]">forever</span>
                </div>

                <div className="mt-4">
                  <Link
                    to={paths.signup}
                    className="inline-flex h-9 sm:h-10 w-full items-center justify-center rounded-full border border-[#19352F] bg-white/[0.04] px-3.5 text-xs sm:text-sm font-medium text-[#F5F7F6] transition-all hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.99] cursor-pointer"
                  >
                    Start for free
                  </Link>
                </div>

                <div className="mt-5 border-t border-[#19352F]/70 pt-4">
                  <p className="text-[11px] font-semibold tracking-wider text-[#A7B5B1] uppercase mb-3">
                    What’s included
                  </p>
                  <ul className="space-y-2 text-xs sm:text-[13px] text-[#F5F7F6]">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Create 1 resume</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Basic resume builder</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>ATS-friendly templates</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Basic ATS analysis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Limited job recommendations</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* CENTER CARD — MONTHLY UNLIMITED (Prominent, larger, highlighted, Most Popular) */}
            <div className="relative z-10 flex flex-col justify-between rounded-[16px] border border-[#10B981] bg-[#071A17]/90 p-6 sm:p-6.5 lg:p-7 backdrop-blur-md shadow-[0_0_36px_-6px_rgba(16,185,129,0.28)] lg:scale-[1.03] transition-all duration-200">
              {/* Badge */}
              <div className="absolute -top-3 right-6 sm:right-7">
                <span className="rounded-full bg-[#10B981] px-3 py-0.5 text-[10px] sm:text-[10.5px] font-semibold tracking-wider text-[#030706] uppercase shadow-sm">
                  MOST POPULAR
                </span>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-[#F5F7F6]">Monthly Unlimited</h2>
                <p className="mt-0.5 text-xs sm:text-sm text-[#A7B5B1]">
                  For active job seekers creating & tailoring resumes regularly.
                </p>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-[44px] font-bold tracking-tight text-[#F5F7F6]">₹199</span>
                  <span className="text-xs sm:text-sm text-[#A7B5B1]">per month</span>
                </div>

                <div className="mt-4.5">
                  <button
                    type="button"
                    onClick={openUpgradeModal}
                    className="inline-flex h-10 sm:h-11 w-full items-center justify-center gap-2 rounded-full bg-[#087F5B] px-4 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#056B4D] active:scale-[0.99] cursor-pointer"
                  >
                    <span>Go unlimited</span>
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-5 border-t border-[#19352F]/80 pt-4">
                  <p className="text-[11px] font-semibold tracking-wider text-[#10B981] uppercase mb-3">
                    Everything in Single, plus
                  </p>
                  <ul className="space-y-2.5 text-xs sm:text-[13.5px] text-[#F5F7F6]">
                    <li className="flex items-center gap-2.5">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span className="font-medium text-white">Unlimited resume creation</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>AI-powered resume generation</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span className="font-medium text-white">Unlimited resume tailoring</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Access to all premium templates</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span className="font-medium text-white">Advanced ATS analysis</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Personalized job recommendations</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span className="font-medium text-white">Priority support</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* SIDE CARD 2 — SINGLE RESUME (Smaller & compact) */}
            <div className="relative flex flex-col justify-between rounded-[16px] border border-[#19352F] bg-[#071A17]/60 p-5 sm:p-5.5 lg:p-6 backdrop-blur-sm lg:scale-[0.97] transition-transform duration-200 hover:border-[#10B981]/40">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6]">Single Resume</h2>
                <p className="mt-0.5 text-xs text-[#A7B5B1]">Perfect when you need one polished resume.</p>

                <div className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F5F7F6]">₹49</span>
                  <span className="text-xs text-[#A7B5B1]">for 1 resume</span>
                </div>

                <div className="mt-4">
                  <Link
                    to={paths.createResume}
                    className="inline-flex h-9 sm:h-10 w-full items-center justify-center rounded-full border border-[#10B981]/40 bg-white/[0.06] px-3.5 text-xs sm:text-sm font-medium text-[#F5F7F6] transition-all hover:bg-white/[0.1] hover:border-[#10B981]/70 active:scale-[0.99] cursor-pointer"
                  >
                    Create a resume
                  </Link>
                </div>

                <div className="mt-5 border-t border-[#19352F]/70 pt-4">
                  <p className="text-[11px] font-semibold tracking-wider text-[#A7B5B1] uppercase mb-3">
                    What’s included
                  </p>
                  <ul className="space-y-2 text-xs sm:text-[13px] text-[#F5F7F6]">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>1 complete resume</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>AI-powered resume generation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>ATS analysis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Access to premium templates</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#10B981] shrink-0" aria-hidden />
                      <span>Job recommendations</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* COMPARISON SECTION */}
          <ScrollReveal>
            <div className="mt-20 sm:mt-24 lg:mt-28 border-t border-[#19352F]/80 pt-12 sm:pt-16">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight text-[#F5F7F6]">
                  Compare what's included
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#A7B5B1]">
                  Choose the level of support that fits how you're building your career.
                </p>
              </div>

              {/* Table Container */}
              <div className="mt-10 sm:mt-12 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#19352F]">
                      <th scope="col" className="pb-3.5 font-semibold text-xs sm:text-sm text-[#A7B5B1] w-2/5">
                        Feature
                      </th>
                      <th scope="col" className="pb-3.5 text-center font-semibold text-xs sm:text-sm text-[#F5F7F6] w-1/5">
                        Free
                      </th>
                      <th scope="col" className="pb-3.5 text-center font-semibold text-xs sm:text-sm text-[#10B981] w-1/5">
                        Monthly Unlimited
                      </th>
                      <th scope="col" className="pb-3.5 text-center font-semibold text-xs sm:text-sm text-[#F5F7F6] w-1/5">
                        Single Resume
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#19352F]/60">
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.feature} className="transition-colors hover:bg-white/[0.02]">
                        <td className="py-3.5 text-xs sm:text-sm font-medium text-[#F5F7F6]">{row.feature}</td>
                        <td className="py-3.5 text-center">{renderCellContent(row.free)}</td>
                        <td className="py-3.5 text-center">{renderCellContent(row.unlimited)}</td>
                        <td className="py-3.5 text-center">{renderCellContent(row.single)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>

          {/* FAQ SECTION */}
          <ScrollReveal>
            <div className="mt-24 sm:mt-32 lg:mt-40 border-t border-[#19352F]/80 pt-16 sm:pt-24 max-w-3xl mx-auto">
              <div className="text-center">
                <span className="text-xs font-semibold tracking-widest text-[#10B981] uppercase">FAQ</span>
                <h2 className="mt-3 font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-[#F5F7F6]">
                  Questions, answered.
                </h2>
                <p className="mt-3 text-sm sm:text-base text-[#A7B5B1]">
                  Everything you need to know about Clave's pricing and plans.
                </p>
              </div>

              {/* Accordion */}
              <div className="mt-10 sm:mt-12 divide-y divide-[#19352F]/80 border-y border-[#19352F]/80">
                {FAQ_ITEMS.map((item, index) => {
                  const isOpen = openFaqIndex === index
                  return (
                    <div key={item.question} className="py-5">
                      <button
                        type="button"
                        onClick={() => toggleFaq(index)}
                        className="flex w-full items-center justify-between text-left gap-4 cursor-pointer focus:outline-none"
                        aria-expanded={isOpen}
                      >
                        <span className="text-[15px] sm:text-base font-medium text-[#F5F7F6]">
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`size-4 text-[#A7B5B1] shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-[#10B981]' : ''
                          }`}
                          aria-hidden
                        />
                      </button>
                      {isOpen && (
                        <p className="mt-3 text-sm leading-relaxed text-[#A7B5B1] pr-6 animate-in fade-in duration-150">
                          {item.answer}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </ScrollReveal>
        </LandingContainer>
      </main>

      {/* Shared Landing Footer */}
      <LandingFooter />
    </div>
  )
}

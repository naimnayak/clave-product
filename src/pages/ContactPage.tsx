import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronDown, Loader2, Mail } from 'lucide-react'
import GradientWaves from '@/components/effects/GradientWaves'
import { LandingContainer } from '@/components/landing/LandingContainer'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { paths } from '@/routes/navigation'
import { ScrollReveal } from '@/components/transitions/ScrollReveal'
import { ApiError, apiClient } from '@/services/apiClient'

const TOPIC_OPTIONS = [
  'General question',
  'Product feedback',
  'Technical support',
  'Partnership',
  'College / Institution',
  'Something else',
] as const

type Topic = (typeof TOPIC_OPTIONS)[number]

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState<Topic>('General question')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Hidden from people; bots that fill every field get silently ignored by the API.
  const [honeypot, setHoneypot] = useState('')

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Please provide your name.'
    if (!email.trim()) {
      errs.email = 'Please provide your email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please provide a valid email address.'
    }
    if (!message.trim()) {
      errs.message = 'Please tell us what’s on your mind.'
    } else if (message.trim().length < 10) {
      errs.message = 'Message must be at least 10 characters.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await apiClient.post('/contact', { name: name.trim(), email: email.trim(), topic, message: message.trim(), website: honeypot })
      setSubmitted(true)
    } catch (error) {
      setErrors({ form: error instanceof ApiError ? error.message : 'We couldn’t send your message. Please try again, or email us directly.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setName('')
    setEmail('')
    setTopic('General question')
    setMessage('')
    setSubmitted(false)
    setErrors({})
  }

  return (
    <div className="relative min-h-dvh flex flex-col bg-black text-white overflow-hidden">
      {/* Emerald gradient wave on pure black background */}
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

      {/* Atmospheric vignette overlays to keep center readable on black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.08),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90"
      />

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 py-12 sm:py-16 lg:py-20">
        <LandingContainer className="max-w-[1240px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* LEFT COLUMN: Editorial statement & contact details */}
            <div className="lg:col-span-6 xl:col-span-5">
              <span className="animate-entrance-eyebrow text-xs font-semibold tracking-widest text-[#10B981] uppercase block">
                GET IN TOUCH
              </span>

              <h1 className="animate-entrance-heading mt-3 font-editorial text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight text-white leading-[1.04]">
                Let’s <em className="text-[#10B981] font-normal italic">talk.</em>
              </h1>

              <p className="animate-entrance-subtext mt-5 sm:mt-6 text-base sm:text-lg leading-relaxed text-[#A7B5B1] max-w-lg">
                Have a question, found something that could be better, or just want to say hello? We’d love to hear
                from you.
              </p>

              <div className="my-8 sm:my-10 border-t border-white/10" />

              <h2 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-white">
                Have a question?
              </h2>

              <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-[#A7B5B1] max-w-md">
                Whether you’re building your first resume, exploring Clave for your college, or have feedback about the
                product, reach out. We’re here to help.
              </p>

              {/* Contact Cards */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <a
                  href="mailto:hello@clave.app"
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-all duration-150 hover:border-[#10B981]/40 hover:bg-white/[0.06] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A7B5B1]">General</span>
                    <Mail className="size-4 text-[#10B981] opacity-75 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="mt-2 text-[15px] font-medium text-white group-hover:text-[#10B981] transition-colors">
                    hello@clave.app
                  </p>
                </a>

                <a
                  href="mailto:support@clave.app"
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-all duration-150 hover:border-[#10B981]/40 hover:bg-white/[0.06] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A7B5B1]">Support</span>
                    <Mail className="size-4 text-[#10B981] opacity-75 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="mt-2 text-[15px] font-medium text-white group-hover:text-[#10B981] transition-colors">
                    support@clave.app
                  </p>
                </a>
              </div>

              {/* Editorial signature line */}
              <p className="mt-8 font-editorial text-lg sm:text-xl italic text-[#A7B5B1]/90">
                Good products are built by listening.
              </p>
            </div>

            {/* RIGHT COLUMN: Contact Form */}
            <div className="lg:col-span-6 xl:col-span-7">
              <ScrollReveal>
                <div className="rounded-[16px] border border-white/15 bg-[#071F1B]/90 p-6 sm:p-8 lg:p-10 shadow-2xl shadow-black/50 backdrop-blur-md">
                {submitted ? (
                  <div className="py-10 text-center animate-in fade-in zoom-in-95 duration-200">
                    <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#087F5B]/20 text-[#10B981] ring-1 ring-[#10B981]/30">
                      <CheckCircle2 className="size-8" strokeWidth={2} />
                    </div>
                    <h3 className="mt-5 font-editorial text-3xl font-medium tracking-tight text-white">
                      Message sent!
                    </h3>
                    <p className="mt-2 text-sm text-[#A7B5B1] max-w-sm mx-auto leading-relaxed">
                      Thanks for reaching out, {name.trim().split(' ')[0] || 'there'}. We usually respond within 24–48
                      hours.
                    </p>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="mt-8 inline-flex h-10 items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/30 cursor-pointer"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <div>
                    <h2 className="font-editorial text-2xl sm:text-3xl font-medium tracking-tight text-white">
                      Send us a message
                    </h2>
                    <p className="mt-1.5 text-sm text-[#A7B5B1]">We usually respond within 24–48 hours.</p>

                    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                      {/* Name */}
                      <div>
                        <label htmlFor="contact-name" className="block text-xs font-medium text-[#A7B5B1]">
                          Name <span className="text-[#10B981]">*</span>
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value)
                            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
                          }}
                          placeholder="Your name"
                          className="mt-1.5 h-11 w-full rounded-control border border-white/15 bg-white/[0.05] px-3.5 text-sm text-white placeholder:text-white/35 transition-colors focus:border-[#10B981] focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                        />
                        {errors.name && <p className="mt-1 text-xs text-rose-400">{errors.name}</p>}
                      </div>

                      {/* Email */}
                      <div>
                        <label htmlFor="contact-email" className="block text-xs font-medium text-[#A7B5B1]">
                          Email <span className="text-[#10B981]">*</span>
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
                          }}
                          placeholder="you@example.com"
                          className="mt-1.5 h-11 w-full rounded-control border border-white/15 bg-white/[0.05] px-3.5 text-sm text-white placeholder:text-white/35 transition-colors focus:border-[#10B981] focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                        />
                        {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email}</p>}
                      </div>

                      {/* What can we help with? */}
                      <div>
                        <label htmlFor="contact-topic" className="block text-xs font-medium text-[#A7B5B1]">
                          What can we help with?
                        </label>
                        <div className="relative mt-1.5">
                          <select
                            id="contact-topic"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value as Topic)}
                            className="h-11 w-full appearance-none rounded-control border border-white/15 bg-[#06241F] px-3.5 pr-10 text-sm text-white transition-colors focus:border-[#10B981] focus:outline-none focus:ring-1 focus:ring-[#10B981] cursor-pointer"
                          >
                            {TOPIC_OPTIONS.map((opt) => (
                              <option key={opt} value={opt} className="bg-[#041E19] text-white">
                                {opt}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-[#A7B5B1]"
                            aria-hidden
                          />
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="contact-message" className="block text-xs font-medium text-[#A7B5B1]">
                            Message <span className="text-[#10B981]">*</span>
                          </label>
                          <span
                            className={`text-[11px] ${message.length >= 480 ? 'text-amber-300' : 'text-[#A7B5B1]/70'}`}
                          >
                            {message.length}/500
                          </span>
                        </div>
                        <textarea
                          id="contact-message"
                          required
                          rows={4}
                          maxLength={500}
                          value={message}
                          onChange={(e) => {
                            setMessage(e.target.value)
                            if (errors.message) setErrors((prev) => ({ ...prev, message: '' }))
                          }}
                          placeholder="Tell us what's on your mind..."
                          className="mt-1.5 w-full rounded-control border border-white/15 bg-white/[0.05] p-3 text-sm text-white placeholder:text-white/35 transition-colors focus:border-[#10B981] focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#10B981] resize-none"
                        />
                        {errors.message && <p className="mt-1 text-xs text-rose-400">{errors.message}</p>}
                      </div>

                      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
                        <label>
                          Website
                          <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                        </label>
                      </div>

                      {errors.form && (
                        <p role="alert" className="rounded-control border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
                          {errors.form}
                        </p>
                      )}

                      {/* Primary submit button */}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#087F5B] px-6 text-[15px] font-medium text-white shadow-xs transition-all duration-150 hover:bg-[#056B4D] active:scale-[0.99] cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            <span>Sending message…</span>
                          </>
                        ) : (
                          <>
                            <span>Send message</span>
                            <ArrowRight className="size-4" aria-hidden />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </ScrollReveal>
          </div>
          </div>

          {/* BOTTOM SECTION: Centered Editorial CTA */}
          <ScrollReveal>
            <div className="mt-20 lg:mt-28 border-t border-white/10 pt-16 sm:pt-20 text-center">
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight text-white">
                Prefer exploring first?
              </h2>
              <p className="mt-3 text-base text-[#A7B5B1] max-w-lg mx-auto leading-relaxed">
                Learn more about Clave and how it can help you build your next career move.
              </p>
              <div className="mt-6">
                <Link
                  to={`${paths.landing}#how-it-works`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/30 active:scale-[0.99] cursor-pointer btn-micro-interact"
                >
                  <span>How Clave works</span>
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </LandingContainer>
      </main>

      {/* Landing Footer */}
      <LandingFooter />
    </div>
  )
}

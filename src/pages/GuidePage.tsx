import { BookOpen, Briefcase, FileText, LifeBuoy, MessagesSquare, Settings, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { linkStyles } from '@/components/ui/linkStyles'
import { paths } from '@/routes/navigation'

interface Section {
  id: string
  icon: LucideIcon
  title: string
  body: ReactNode
}

const L = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className={linkStyles}>
    {children}
  </Link>
)

const sections: Section[] = [
  {
    id: 'profile',
    icon: UserRound,
    title: '1. Start with your Career Profile',
    body: (
      <>
        <p>
          Your <L to={paths.careerProfile}>Career Profile</L> is the single source of truth for everything Clave creates: experience, education, projects,
          skills, certifications and links. Resumes are generated from it, so time spent here pays off everywhere.
        </p>
        <ul>
          <li>Import a resume or your LinkedIn PDF during onboarding, then check what was extracted.</li>
          <li>Add numbers only when they’re true. Clave’s AI never invents employers, dates, skills or results.</li>
          <li>Set your target roles and experience level. They shape job matches and AI suggestions.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'resumes',
    icon: FileText,
    title: '2. Create resumes',
    body: (
      <>
        <p>From <L to={paths.createResume}>Create Resume</L> you can:</p>
        <ul>
          <li><strong>Create with AI</strong>: paste a job description, review the match analysis, and get a tailored draft built from your profile.</li>
          <li><strong>Tailor an existing resume</strong>: pick a resume (or upload one), paste the job, and choose which suggested changes to apply. Your original stays untouched.</li>
          <li><strong>Start from scratch</strong> or <strong>choose a template</strong> if you prefer to write it yourself.</li>
          <li><strong><L to={paths.importResume}>Import a resume</L></strong> you already have to edit, tailor and download it in Clave.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'editor',
    icon: Sparkles,
    title: '3. Edit, check and download',
    body: (
      <ul>
        <li>Changes save automatically. The preview on the right is exactly what your PDF looks like.</li>
        <li>Use <strong>Improve with AI</strong> on your summary or any bullet to reword it, shorten it or bring out its impact. Placeholders like [X%] mark where a real number belongs.</li>
        <li>The <strong>ATS score</strong> updates as you type. Open it and run <strong>AI review</strong> (optionally with a job description) for missing keywords and specific fixes.</li>
        <li><strong>Download</strong> opens your browser’s print dialog: choose “Save as PDF”. The PDF keeps real, selectable text, which is what applicant tracking systems need. If your browser adds page headers or footers, turn them off in the dialog’s settings.</li>
      </ul>
    ),
  },
  {
    id: 'jobs',
    icon: Briefcase,
    title: '4. Find and track jobs',
    body: (
      <ul>
        <li><L to={paths.jobs}>Jobs</L> shows listings with a match score based on your profile’s skills, target roles, level and preferred work mode.</li>
        <li>Save jobs to come back later, or use <strong>Tailor Resume</strong> to start a tailored resume with the job already filled in.</li>
        <li><strong>Apply on Company Site</strong> opens the application page and adds the job to your tracker. Move it through Applied, Interviewing and Not selected as you hear back.</li>
      </ul>
    ),
  },
  {
    id: 'assistant',
    icon: MessagesSquare,
    title: '5. Practice and get advice',
    body: (
      <ul>
        <li>The <L to={paths.assistant}>AI Assistant</L> answers questions about resumes, job search, career direction and interviews, using your profile when Personalize AI is on.</li>
        <li><L to={paths.mockInterview}>AI Mock Interview</L> asks realistic questions for your target role, one at a time, and scores every answer with what worked and what to improve.</li>
        <li>AI can make mistakes. Treat answers as guidance and check important details.</li>
      </ul>
    ),
  },
  {
    id: 'plans',
    icon: BookOpen,
    title: '6. Plans and limits',
    body: (
      <ul>
        <li>The Free plan includes five resumes (imported ones count too), one mock interview and a preview of the jobs that match you.</li>
        <li>Buy a single resume, or go Clave Pro for your personal job feed, unlimited resumes and mock interviews. See <L to={paths.pricing}>Pricing</L>.</li>
        <li>AI actions (generation, tailoring, reviews, interview feedback) and assistant messages each have a daily allowance that resets at midnight UTC. The assistant shows how many messages you have left.</li>
      </ul>
    ),
  },
  {
    id: 'privacy',
    icon: ShieldCheck,
    title: '7. Your account and data',
    body: (
      <ul>
        <li>In <L to={paths.account}>Account</L> you can change your password, connect Google, see active sessions and sign out other devices.</li>
        <li>In <L to={paths.settings}>Settings</L> you can choose notifications and emails, turn Personalize AI off, download all your data, and pick light or dark appearance.</li>
        <li>Deleting your account removes your profile, resumes and uploads. Read the <L to="/legal/privacy">Privacy Policy</L> for details.</li>
      </ul>
    ),
  },
  {
    id: 'help',
    icon: LifeBuoy,
    title: '8. Need help?',
    body: (
      <p>
        <L to={paths.contact}>Contact us</L> or use <strong>Send feedback</strong> in <L to={`${paths.settings}#help`}>Settings</L>. We usually reply within two business days.
      </p>
    ),
  },
]

/** /guide: how to use Clave, end to end. */
export function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
      <nav aria-label="Guide sections" className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
          <Settings className="size-3.5" aria-hidden /> On this page
        </p>
        <ol className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="block rounded-control px-2 py-1 text-sm text-secondary hover:bg-surface hover:text-text">
                {section.title.replace(/^\d+\.\s*/, '')}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="mb-6">
          <h1 className="font-editorial text-4xl font-medium tracking-tight text-text">User Guide</h1>
          <p className="mt-1.5 text-secondary">Everything you need to get from Career Profile to application.</p>
        </header>
        <div className="flex flex-col gap-4">
          {sections.map(({ id, icon: Icon, title, body }) => (
            <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-default border border-border bg-surface p-5 shadow-xs sm:p-6">
              <h2 id={`${id}-title`} className="flex items-center gap-3 text-lg font-semibold text-text">
                <span className="flex size-9 items-center justify-center rounded-control icon-tile">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                {title}
              </h2>
              <div className="mt-3 text-sm leading-relaxed text-secondary [&_li]:mt-1.5 [&_p+ul]:mt-2 [&_strong]:font-semibold [&_strong]:text-text [&_ul]:list-disc [&_ul]:pl-5">{body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

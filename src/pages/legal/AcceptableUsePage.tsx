import { LegalDocument, LegalLink, MailLink } from '@/components/legal/LegalDocument'
import type { LegalSection } from '@/components/legal/LegalDocument'
import { legalInfo as info, legalPaths } from '@/components/legal/legalInfo'

const sections: LegalSection[] = [
  {
    id: 'honesty',
    title: 'Be truthful',
    body: (
      <ul>
        <li>Don’t use {info.product} to create resumes with fake degrees, employers, job titles, dates, certifications or results.</li>
        <li>Don’t impersonate another person or create a resume for someone without their permission.</li>
        <li>Replace every placeholder the AI leaves, such as [X%], with a real figure or remove it.</li>
      </ul>
    ),
  },
  {
    id: 'content',
    title: 'Content you add',
    body: (
      <>
        <p>Don’t upload or write content that:</p>
        <ul>
          <li>is unlawful, defamatory, obscene, hateful, or harasses or threatens anyone;</li>
          <li>infringes someone else’s copyright, trademark or privacy, including other people’s personal data you have no right to share;</li>
          <li>contains malware or files designed to harm systems;</li>
          <li>is otherwise prohibited under Rule 3 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ai',
    title: 'Using AI features',
    body: (
      <ul>
        <li>Don’t try to make the AI produce harmful, illegal or deceptive material, or to reveal how it is configured.</li>
        <li>Don’t use the AI Assistant or Mock Interview for purposes unrelated to careers at a scale that affects other users.</li>
        <li>Don’t automate requests to get around daily AI allowances or plan limits.</li>
      </ul>
    ),
  },
  {
    id: 'service',
    title: 'Protecting the service',
    body: (
      <ul>
        <li>Don’t scrape, crawl or bulk-download {info.product}, including job listings, or use bots to access it.</li>
        <li>Don’t probe, scan or test our systems for vulnerabilities without written permission, or try to bypass authentication, rate limits or plan limits.</li>
        <li>Don’t create multiple accounts to get extra free resumes, share paid accounts, or resell access.</li>
        <li>Don’t interfere with other users’ accounts or data.</li>
      </ul>
    ),
  },
  {
    id: 'security-reports',
    title: 'Reporting security issues',
    body: (
      <p>
        Found a vulnerability? Please email <MailLink email={info.supportEmail} /> with the subject “Security” and details to reproduce it. Give us reasonable time to fix
        it before telling anyone else. We won’t take action against good-faith research that follows this policy and doesn’t access other users’ data.
      </p>
    ),
  },
  {
    id: 'enforcement',
    title: 'What happens if the rules are broken',
    body: (
      <p>
        We may remove content, limit features, or suspend or close accounts, depending on how serious the issue is. Where the law requires it, we may report
        activity to authorities. To report misuse, contact our <LegalLink to={legalPaths.grievance}>Grievance Officer</LegalLink>.
      </p>
    ),
  },
]

export function AcceptableUsePage() {
  return (
    <LegalDocument
      title="Acceptable Use Policy"
      summary={<>Use {info.product} to present your real experience well. No fake credentials, no harmful content, no scraping or attacking the service.</>}
      sections={sections}
    />
  )
}

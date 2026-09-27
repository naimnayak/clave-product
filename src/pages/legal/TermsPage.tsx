import { LegalDocument, LegalLink, MailLink } from '@/components/legal/LegalDocument'
import type { LegalSection } from '@/components/legal/LegalDocument'
import { legalInfo as info, legalPaths } from '@/components/legal/legalInfo'

const courts = info.jurisdiction ? `the courts at ${info.jurisdiction}` : 'the competent courts in India'

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement',
    body: (
      <>
        <p>
          These Terms of Service (“Terms”) are an agreement between you and {info.operator}, which operates {info.product}. By creating an account or using{' '}
          {info.product}, you agree to these Terms, the <LegalLink to={legalPaths.privacy}>Privacy Policy</LegalLink>, the{' '}
          <LegalLink to={legalPaths.acceptableUse}>Acceptable Use Policy</LegalLink> and the{' '}
          <LegalLink to={legalPaths.refunds}>Refund &amp; Cancellation Policy</LegalLink>. If you don’t agree, please don’t use {info.product}.
        </p>
        <p>These Terms are an electronic record under the Information Technology Act, 2000 and don’t need a physical or digital signature.</p>
      </>
    ),
  },
  {
    id: 'service',
    title: 'The service',
    body: (
      <p>
        {info.product} helps you build a Career Profile, create and tailor resumes with AI assistance, check them against applicant tracking systems (ATS), find and
        track jobs, and practise interviews. We may add, change or remove features over time. We’ll give reasonable notice before removing a feature you have paid for.
      </p>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility and accounts',
    body: (
      <ul>
        <li>You must be at least 18 years old and able to enter a binding contract.</li>
        <li>Give accurate account information and keep your password safe. You are responsible for activity under your account.</li>
        <li>One person per account. Don’t share accounts or create several accounts to get around plan limits.</li>
        <li>Tell us straight away at <MailLink email={info.supportEmail} /> if you think someone else has accessed your account. You can also sign out other devices from Account.</li>
      </ul>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <>
        <p>
          “Your content” means everything you add to {info.product}: your Career Profile, resumes, uploads, job descriptions, messages and interview answers. You own
          your content, including resumes you create with {info.product}.
        </p>
        <p>
          You give us a limited, non-exclusive licence to store, process and display your content only to provide the service to you, including sending it to our
          service providers as described in the Privacy Policy. This licence ends when you delete the content or your account, except for backups that are overwritten
          in the normal course and records we must keep by law.
        </p>
        <p>You confirm that your content is truthful, that you have the right to use it, and that it doesn’t break any law or anyone else’s rights.</p>
      </>
    ),
  },
  {
    id: 'ai-output',
    title: 'AI-generated content',
    body: (
      <>
        <p>
          AI features produce suggestions based on what you provide. AI can be wrong, incomplete or inappropriate. <strong>You are responsible for reviewing
          everything before you use it</strong>, especially facts, dates, numbers and claims about your experience. Don’t submit a resume that says something that isn’t
          true about you.
        </p>
        <p>
          ATS scores, match scores and interview feedback are estimates to help you improve. They are not a guarantee of how any employer or ATS will rank you. More in
          the <LegalLink to={legalPaths.ai}>AI Use Disclosure</LegalLink>.
        </p>
      </>
    ),
  },
  {
    id: 'no-guarantee',
    title: 'Jobs and outcomes',
    body: (
      <p>
        {info.product} is not an employer, recruiter or placement agency. Job listings come from public sources and third parties. We don’t verify every listing and
        aren’t responsible for employers, their sites or their hiring decisions. Using {info.product} does not guarantee interviews, offers or any career outcome.
        Be cautious of any “employer” that asks you for money.
      </p>
    ),
  },
  {
    id: 'plans',
    title: 'Plans, payments and limits',
    body: (
      <ul>
        <li><strong>Free:</strong> five resumes per account, including imported ones. Free resumes are also limited per device, so creating new accounts doesn’t reset the allowance.</li>
        <li><strong>Single Resume:</strong> ₹{info.singlePrice}, one-time, for one additional resume.</li>
        <li><strong>Clave Pro:</strong> ₹{info.monthlyPrice} for {info.monthlyDays} days of unlimited resumes and mock interviews, higher daily AI allowances and a personal job feed. It does not renew automatically. You pay again when you want another period.</li>
        <li>Prices are in Indian Rupees and include applicable taxes unless stated otherwise at checkout. Payments are processed by our payment processor.</li>
        <li>AI actions have a fair-use daily allowance on every plan to keep the service reliable. The current allowance is shown in the app.</li>
        <li>We may change prices for future purchases. Changes don’t affect what you have already paid for.</li>
        <li>Refunds and cancellations are covered by the <LegalLink to={legalPaths.refunds}>Refund &amp; Cancellation Policy</LegalLink>.</li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <p>
        Use {info.product} lawfully and as intended. The <LegalLink to={legalPaths.acceptableUse}>Acceptable Use Policy</LegalLink> lists what isn’t allowed, such as
        fake credentials, impersonation, scraping, attacking the service or misusing AI features.
      </p>
    ),
  },
  {
    id: 'our-ip',
    title: 'Our intellectual property',
    body: (
      <p>
        {info.product}’s software, design, templates, logos and text (other than your content) belong to {info.operator} or its licensors. You may use resume
        templates for your own resumes. You may not copy, resell, reverse engineer or build a competing service from {info.product}.
      </p>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party services',
    body: (
      <p>
        {info.product} links to and relies on third-party services such as Google sign-in, our payment processor and employer websites. Their own terms and
        privacy policies apply when you use them, and we aren’t responsible for them.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <>
        <p>You can stop using {info.product} and delete your account at any time from Account.</p>
        <p>
          We may suspend or close an account that breaks these Terms, puts other users or the service at risk, or where the law requires it. Where reasonable, we’ll
          tell you why and give you a chance to respond and download your data. If we close your account without cause, we’ll refund any unused part of a paid period.
        </p>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p>
        {info.product} is provided “as is” and “as available”. To the extent the law allows, we disclaim implied warranties of merchantability, fitness for a
        particular purpose and non-infringement. We work to keep {info.product} available and your data safe, but we don’t promise the service will be
        uninterrupted or error-free.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the extent the law allows, {info.operator} is not liable for indirect, incidental, special or consequential losses, or for lost opportunities, profits or
        data, arising from your use of {info.product}. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim, or
        ₹1,000 if you haven’t paid anything. Nothing in these Terms limits liability that can’t be limited by law.
      </p>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnity',
    body: (
      <p>
        You agree to compensate {info.operator} for reasonable losses and costs arising from your content or your breach of these Terms, to the extent caused by you.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    body: (
      <p>
        These Terms are governed by the laws of India. Please contact us first. Most issues can be resolved quickly through support or our{' '}
        <LegalLink to={legalPaths.grievance}>Grievance Officer</LegalLink>. If a dispute can’t be resolved within 30 days, {courts} will have exclusive jurisdiction,
        without affecting any rights you have under consumer protection law.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <p>
        We may update these Terms. We’ll change the date at the top and, for material changes, notify you in the app or by email at least 7 days before they take
        effect. Continuing to use {info.product} after that means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        <MailLink email={info.supportEmail} /> for support, <MailLink email={info.generalEmail} /> for everything else.
        {info.address && <> Legal notices: {info.operator}, {info.address}.</>}
      </p>
    ),
  },
]

export function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      summary={
        <>
          The rules for using {info.product}: you own your content and are responsible for checking what the AI suggests, paid plans work as described at checkout,
          and we don’t guarantee jobs or interviews. Indian law applies.
        </>
      }
      sections={sections}
    />
  )
}

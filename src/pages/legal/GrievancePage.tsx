import { LegalDocument, LegalLink, MailLink } from '@/components/legal/LegalDocument'
import type { LegalSection } from '@/components/legal/LegalDocument'
import { legalInfo as info, legalPaths } from '@/components/legal/legalInfo'
import { paths } from '@/routes/navigation'

const sections: LegalSection[] = [
  {
    id: 'officer',
    title: 'Grievance Officer',
    body: (
      <>
        <p>
          In line with the Information Technology Act, 2000, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the
          Digital Personal Data Protection Act, 2023 and the Consumer Protection (E-Commerce) Rules, 2020, {info.operator} has appointed a Grievance Officer for{' '}
          {info.product}.
        </p>
        <ul>
          <li><strong>Name / designation:</strong> {info.grievanceOfficer}, {info.operator}</li>
          <li><strong>Email:</strong> <MailLink email={info.supportEmail} /> (subject: “Grievance”)</li>
          {info.address && <li><strong>Address:</strong> {info.address}</li>}
          <li><strong>Hours:</strong> Monday to Friday, 10:00 to 18:00 IST, except public holidays</li>
        </ul>
      </>
    ),
  },
  {
    id: 'what',
    title: 'What you can raise',
    body: (
      <ul>
        <li>How your personal data is collected, used, shared, corrected or deleted.</li>
        <li>Content on {info.product} that you believe breaks the law or our <LegalLink to={legalPaths.acceptableUse}>Acceptable Use Policy</LegalLink>.</li>
        <li>Payments, refunds and billing (see the <LegalLink to={legalPaths.refunds}>Refund &amp; Cancellation Policy</LegalLink>).</li>
        <li>Account suspension, or any other problem that support hasn’t resolved.</li>
      </ul>
    ),
  },
  {
    id: 'how',
    title: 'How to file a grievance',
    body: (
      <>
        <p>Email the Grievance Officer from your account email, and include:</p>
        <ol>
          <li>your name and the email address on your {info.product} account;</li>
          <li>a clear description of the issue, with dates;</li>
          <li>links or screenshots where relevant, and any payment ID;</li>
          <li>what outcome you are asking for.</li>
        </ol>
      </>
    ),
  },
  {
    id: 'timelines',
    title: 'What happens next',
    body: (
      <ul>
        <li>We acknowledge your grievance within <strong>{info.grievanceAckHours} hours</strong>.</li>
        <li>We resolve it within <strong>{info.grievanceResolveDays} days</strong> of receiving it, and tell you what we did and why.</li>
        <li>Requests to remove content that exposes a person’s private area, shows them in sexual acts or impersonates them are acted on within 24 hours, as the IT Rules require.</li>
      </ul>
    ),
  },
  {
    id: 'escalation',
    title: 'If you’re not satisfied',
    body: (
      <p>
        For personal data matters you may complain to the Data Protection Board of India once you have used this process. For consumer matters you may approach the
        National Consumer Helpline (1915) or the consumer commission with jurisdiction. More in the <LegalLink to={legalPaths.privacy}>Privacy Policy</LegalLink>.
      </p>
    ),
  },
]

export function GrievancePage() {
  return (
    <LegalDocument
      title="Grievance Redressal"
      summary={
        <>
          For everyday questions, <LegalLink to={paths.contact}>contact support</LegalLink>. If support hasn’t solved your problem, or it concerns your personal data or
          unlawful content, write to our Grievance Officer.
        </>
      }
      sections={sections}
    />
  )
}

import { LegalDocument, LegalLink, MailLink } from '@/components/legal/LegalDocument'
import type { LegalSection } from '@/components/legal/LegalDocument'
import { legalInfo as info, legalPaths } from '@/components/legal/legalInfo'

const sections: LegalSection[] = [
  {
    id: 'plans',
    title: 'What you pay for',
    body: (
      <ul>
        <li><strong>Free:</strong> ₹0. Five resumes per account (also limited per device), a daily AI allowance and one mock interview.</li>
        <li><strong>Single Resume:</strong> ₹{info.singlePrice}, a one-time payment for one additional resume.</li>
        <li><strong>Clave Pro:</strong> ₹{info.monthlyPrice}, a one-time payment for {info.monthlyDays} days of unlimited resumes and mock interviews, higher daily AI allowances and a personal job feed, from the moment the payment is confirmed.</li>
      </ul>
    ),
  },
  {
    id: 'cancellation',
    title: 'Cancellation',
    body: (
      <>
        <p>
          Paid plans <strong>don’t renew automatically</strong> and we never charge you without you completing a new checkout. There’s nothing to cancel: Monthly
          Unlimited simply ends after {info.monthlyDays} days and your account returns to the Free plan. Resumes you created stay in your account and remain editable
          and downloadable.
        </p>
        <p>You can delete your account at any time from Account. Deleting it doesn’t by itself trigger a refund; ask for one first if you’re eligible.</p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'When you can get a refund',
    body: (
      <ul>
        <li><strong>Single Resume:</strong> full refund if you ask within 7 days of payment and haven’t created the resume you paid for.</li>
        <li><strong>Clave Pro:</strong> full refund if you ask within 7 days of payment and haven’t created or tailored any resume during the period.</li>
        <li><strong>Failed, duplicate or incorrect charges:</strong> always refunded in full, whether or not you contact us.</li>
        <li><strong>Service problems:</strong> if a paid feature didn’t work because of a fault on our side and we couldn’t fix it within a reasonable time, we’ll refund you in full or in part.</li>
      </ul>
    ),
  },
  {
    id: 'not-eligible',
    title: 'When refunds don’t apply',
    body: (
      <ul>
        <li>After the paid resume has been created, or after resumes were created or tailored on Clave Pro, except for faults on our side.</li>
        <li>Dissatisfaction with job outcomes. {info.product} doesn’t guarantee interviews or offers (see the <LegalLink to={legalPaths.terms}>Terms</LegalLink>).</li>
        <li>Accounts closed for breaking the <LegalLink to={legalPaths.acceptableUse}>Acceptable Use Policy</LegalLink>.</li>
      </ul>
    ),
  },
  {
    id: 'how',
    title: 'How to ask for a refund',
    body: (
      <>
        <p>
          Email <MailLink email={info.supportEmail} /> from your account email with the subject “Refund”, the payment date and, if you have it, the payment ID from
          your receipt. We’ll reply within {info.replyDays} business days.
        </p>
        <p>
          Approved refunds go back to the original payment method through our payment processor. They usually reach you in 5 to 7 business days, depending on your
          bank or UPI provider. When a refund is issued, the paid access it covered ends.
        </p>
      </>
    ),
  },
  {
    id: 'disputes',
    title: 'Complaints',
    body: (
      <p>
        If you’re unhappy with how a refund request was handled, contact our <LegalLink to={legalPaths.grievance}>Grievance Officer</LegalLink>. This doesn’t affect
        your rights under the Consumer Protection Act, 2019.
      </p>
    ),
  },
]

export function RefundPolicyPage() {
  return (
    <LegalDocument
      title="Refund & Cancellation Policy"
      summary={
        <>
          Plans are one-time payments that never auto-renew. If you haven’t used what you paid for, you can get a full refund within 7 days. Failed or duplicate
          charges are always refunded.
        </>
      }
      sections={sections}
    />
  )
}

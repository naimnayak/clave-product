import { LegalDocument, LegalLink, MailLink } from '@/components/legal/LegalDocument'
import type { LegalSection } from '@/components/legal/LegalDocument'
import { legalInfo as info, legalPaths } from '@/components/legal/legalInfo'

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          {info.product} is an AI-assisted career platform built and operated by {info.operator} (“{info.product}”, “we”, “us”). For the purposes of India’s
          Digital Personal Data Protection Act, 2023 (“DPDP Act”) and the Information Technology Act, 2000 and its rules, we are the <strong>Data Fiduciary</strong>{' '}
          for the personal data described in this policy. You are the <strong>Data Principal</strong>.
        </p>
        <p>This policy applies to the {info.product} website and web app, and to emails and support conversations with us.</p>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: 'Personal data we collect',
    body: (
      <>
        <h3>Data you give us</h3>
        <ul>
          <li><strong>Account details:</strong> name, email address, password (held by our authentication provider, never by us in readable form), profile photo, and whether you signed in with Google.</li>
          <li><strong>Career Profile:</strong> contact details you choose to add (phone, location, links such as LinkedIn or GitHub), education, work experience, projects, skills, certifications, achievements, target roles, experience level and preferred work mode.</li>
          <li><strong>Resumes and uploads:</strong> resumes you create or edit, and files you upload (for example a resume or your LinkedIn profile PDF), plus the text we extract from them.</li>
          <li><strong>Job activity:</strong> jobs you save, applications you track and their status, and job descriptions you paste for tailoring or analysis. We save each distinct job description with the keywords extracted from it, to match jobs to you.</li>
          <li><strong>AI features:</strong> messages you send to the AI Assistant, a short memory of your goals and progress that the assistant keeps between conversations (only with Personalize AI on), mock interview answers and the feedback on them, and text you ask the AI to improve.</li>
          <li><strong>Payments:</strong> the plan you bought, amount, order and payment identifiers and status. Card, UPI and bank details are entered on our payment processor’s page and are not received or stored by us.</li>
          <li><strong>Support:</strong> messages you send through the contact form, feedback, and emails to us.</li>
          <li><strong>Settings:</strong> notification, email, AI personalization, resume and appearance preferences.</li>
        </ul>
        <h3>Data collected automatically</h3>
        <ul>
          <li><strong>Session and device data:</strong> a random session identifier, a short device description derived from your browser’s user agent (for example “Chrome on macOS”), and when each session was created and last active.</li>
          <li><strong>Usage counters:</strong> how many resumes you have created and how many AI actions you used today, to apply plan limits.</li>
          <li><strong>Abuse prevention:</strong> a random identifier for your browser, stored on your device, and one-way hashes of it on its own and combined with your IP address, used to limit free resumes per device. We don’t keep the raw IP address or identifier.</li>
          <li><strong>Security logs:</strong> technical logs of requests (such as time, endpoint and error codes) kept for a short period to keep the service secure and working.</li>
        </ul>
        <p>We do not use advertising trackers, sell personal data, or build advertising profiles. We don’t ask for sensitive data such as health, religion, caste, political views or government IDs. Please don’t put them in your resume unless you want them there.</p>
        <p>We don’t currently collect product analytics. The “Share anonymous usage data” setting records your choice in advance, and we’ll update this policy before any such data is collected.</p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use your data',
    body: (
      <ul>
        <li>To create your account, sign you in, keep your sessions secure and let you sign out other devices.</li>
        <li>To build, tailor, score and download resumes from your Career Profile.</li>
        <li>To find job listings from public job boards (LinkedIn, Indeed, Naukri, Internshala, Foundit) for the roles in your resume, Career Profile and job descriptions, show them with a match score, and track the applications you add. Only search terms such as a job title and city are sent to the job search provider, never your resume.</li>
        <li>To run the AI features you choose to use (see <LegalLink to={legalPaths.ai}>AI Use Disclosure</LegalLink>).</li>
        <li>To process payments and apply your plan and usage limits.</li>
        <li>To send the in-app notifications and emails you have chosen in Settings, and essential account and security messages.</li>
        <li>To answer support requests and act on feedback.</li>
        <li>To prevent fraud and abuse, enforce our <LegalLink to={legalPaths.terms}>Terms</LegalLink>, and meet legal obligations.</li>
      </ul>
    ),
  },
  {
    id: 'legal-basis',
    title: 'Consent and legal grounds',
    body: (
      <>
        <p>
          We process your personal data on the basis of the <strong>consent</strong> you give when you create an account and use a feature, and for <strong>legitimate uses</strong>{' '}
          allowed by the DPDP Act, such as data you voluntarily provide for a specific purpose, and compliance with law.
        </p>
        <p>
          You can withdraw consent at any time by turning off optional features (for example Personalize AI or marketing emails in Settings) or by deleting your
          account. Withdrawal doesn’t affect processing that happened before it. Some features can’t work without the data they need, for example resume generation
          needs your Career Profile.
        </p>
      </>
    ),
  },
  {
    id: 'ai-processing',
    title: 'AI processing',
    body: (
      <>
        <p>
          When you use an AI feature, the relevant content (for example parts of your Career Profile, a resume, a job description or your message) is sent to our
          AI model provider to generate the result, and the result is returned to you. With <strong>Personalize AI</strong> on, the AI Assistant and suggestions
          also use your Career Profile, your latest resume, recent job descriptions, tracked applications and the assistant’s memory of past conversations. You can turn it off in Settings.
        </p>
        <p>
          Our AI model provider processes this content on our behalf, and under the terms we use it on, does not use it to train its models. We do not use your
          resumes, profile or messages to train AI models either.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share data with',
    body: (
      <>
        <p>We share personal data only with service providers that help us run {info.product} (“Data Processors”), under contracts that limit their use of it:</p>
        <table>
          <thead>
            <tr>
              <th scope="col">Provider type</th>
              <th scope="col">Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Authentication provider (Google Firebase)</td><td>Sign-up, sign-in, password reset and Google sign-in</td></tr>
            <tr><td>Cloud hosting and database providers</td><td>Running the app and storing your account, profile, resumes and uploads</td></tr>
            <tr><td>AI model provider</td><td>Generating AI results for the features you use</td></tr>
            <tr><td>Payment processor (Razorpay)</td><td>Taking payments and handling payment disputes</td></tr>
            <tr><td>Email delivery provider</td><td>Sending account, security and notification emails</td></tr>
            <tr><td>Job-listing data providers</td><td>Collecting public job listings. We don’t send them your personal data.</td></tr>
          </tbody>
        </table>
        <p>
          We may also disclose data when required by law, court order or a lawful request from a government authority, to protect the rights and safety of users or
          the public, or as part of a merger or acquisition, in which case this policy will continue to apply to your data.
        </p>
        <p>
          Employers don’t see your data through {info.product}. When you apply to a job, you do so on the employer’s own site, and what you share there is governed by
          their policies.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'Where your data is stored',
    body: (
      <p>
        Our providers may store or process data on servers outside India. Where we transfer data abroad, we do so in line with the DPDP Act and any restrictions the
        Government of India notifies, and we require providers to protect it with safeguards comparable to this policy.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <ul>
        <li><strong>Account, Career Profile, resumes, saved jobs and applications:</strong> until you delete them or your account.</li>
        <li><strong>Uploaded files:</strong> deleted automatically after {info.uploadRetentionDays} days. The profile or resume created from them stays until you delete it.</li>
        <li><strong>Notifications:</strong> {info.notificationRetentionDays} days.</li>
        <li><strong>Session records:</strong> {info.sessionRetentionDays} days after last activity, or when you sign out.</li>
        <li><strong>AI Assistant conversations:</strong> a conversation is stored for 48 hours from when it starts (or until you start a new chat), then deleted after its key points are saved to the assistant’s memory. The memory stays until you clear it in the assistant or delete your account. Mock interview sessions stay until you delete them or your account.</li><li><strong>Job descriptions:</strong> until you delete them or your account.</li>
        <li><strong>Payment records:</strong> kept after account deletion for as long as tax and accounting laws require (generally up to 8 years).</li>
        <li><strong>Support messages:</strong> as long as needed to resolve your request, and then up to 2 years.</li>
      </ul>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under the DPDP Act and applicable law you have the right to:</p>
        <ul>
          <li><strong>Access</strong> a summary of your personal data and how it is processed. Settings → Download my data gives you a full copy at any time.</li>
          <li><strong>Correct and update</strong> your data, which you can do directly in your Career Profile, resumes and Account.</li>
          <li><strong>Erase</strong> your data. Account → Delete Account removes your account, profile, resumes, uploads, saved jobs, applications, interviews and notifications. Payment records are kept as described above.</li>
          <li><strong>Withdraw consent</strong> as described in section 4.</li>
          <li><strong>Grievance redressal</strong> through our <LegalLink to={legalPaths.grievance}>Grievance Officer</LegalLink>, and to escalate to the Data Protection Board of India.</li>
          <li><strong>Nominate</strong> another person to exercise your rights in case of death or incapacity, by writing to us.</li>
        </ul>
        <p>To use any right that isn’t available in the app, email <MailLink email={info.supportEmail} /> from your account email. We may need to confirm your identity first.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        We use encryption in transit (HTTPS), access controls that tie every record to your account, token-verified requests, per-user rate limits and
        restricted access for our team. No system is perfectly secure. If a personal data breach affects you, we will inform you and the Data Protection Board as
        the law requires.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        {info.product} is intended for people aged 18 and over. We don’t knowingly process personal data of children. If you believe a child has created an account,
        contact us and we will delete it.
      </p>
    ),
  },
  {
    id: 'storage-on-device',
    title: 'Cookies and local storage',
    body: (
      <p>
        We use browser storage only for things the app needs, such as keeping you signed in and remembering your theme. See the{' '}
        <LegalLink to={legalPaths.cookies}>Cookie &amp; Local Storage Policy</LegalLink>.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy as {info.product} changes. We’ll update the date at the top, and for significant changes we’ll notify you in the app or by email
        before they take effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Privacy questions: <MailLink email={info.supportEmail} />. Complaints: see <LegalLink to={legalPaths.grievance}>Grievance Redressal</LegalLink>.
        {info.address && <> Postal address: {info.address}.</>}
      </p>
    ),
  },
]

export function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary={
        <>
          In short: we collect what you give us to build your career profile and resumes, use it only to run {info.product}, never sell it, and let you download or
          delete it at any time. AI features send the content you choose to our AI model provider, which does not train on it.
        </>
      }
      sections={sections}
    />
  )
}

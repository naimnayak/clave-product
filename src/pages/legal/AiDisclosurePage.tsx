import { LegalDocument, LegalLink } from '@/components/legal/LegalDocument'
import type { LegalSection } from '@/components/legal/LegalDocument'
import { legalInfo as info, legalPaths } from '@/components/legal/legalInfo'

const sections: LegalSection[] = [
  {
    id: 'where',
    title: 'Where AI is used',
    body: (
      <table>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">What the AI does</th>
            <th scope="col">What it receives</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Resume and LinkedIn import</td><td>Reads your file and fills in your Career Profile</td><td>The text of the file you upload</td></tr>
          <tr><td>Create with AI</td><td>Analyses a job description and drafts a resume</td><td>The job description and your Career Profile</td></tr>
          <tr><td>Tailor Resume</td><td>Suggests changes to match a job</td><td>The resume you pick and the job description</td></tr>
          <tr><td>Improve with AI</td><td>Rewrites a summary or bullet point</td><td>That text and, for context, the role it belongs to</td></tr>
          <tr><td>AI review (ATS)</td><td>Points out missing keywords and weak spots</td><td>The resume and, optionally, a job description</td></tr>
          <tr><td>AI Assistant</td><td>Answers career questions</td><td>Your messages, recent conversation and, with Personalize AI on, a profile summary</td></tr>
          <tr><td>AI Mock Interview</td><td>Asks questions and scores answers</td><td>Your target role, level and answers</td></tr>
          <tr><td>Job feed</td><td>Tidies public job listings into a consistent format</td><td>Public listing text only, none of your data</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    id: 'no-fabrication',
    title: 'It works from your facts',
    body: (
      <>
        <p>
          {info.product}’s AI is instructed to use only what is in your profile, resume or message. It should never invent employers, dates, degrees, skills or
          results. Where a number would make a point stronger but you haven’t given one, it leaves a placeholder like <strong>[X%]</strong> for you to fill in with a
          true value or delete.
        </p>
        <p>AI match and ATS scores are estimates designed to help you improve. They don’t predict how a particular employer or system will rank you.</p>
      </>
    ),
  },
  {
    id: 'mistakes',
    title: 'AI can make mistakes',
    body: (
      <p>
        AI output can be wrong, out of date, or miss context. Always read suggestions before accepting them, check facts, and don’t rely on the AI for legal,
        financial, medical or immigration advice. You decide what goes on your resume. See <LegalLink to={legalPaths.terms}>Terms, section 5</LegalLink>.
      </p>
    ),
  },
  {
    id: 'data',
    title: 'Your data and AI',
    body: (
      <ul>
        <li>Content is sent to our AI model provider only when you use an AI feature, and only what that feature needs.</li>
        <li>The provider processes it to return a result and, under the terms we use it on, does not use it to train its models.</li>
        <li>We don’t use your resumes, profile, messages or interview answers to train AI models.</li>
        <li>AI Assistant conversations stay in your browser tab and aren’t saved to your account. Mock interview sessions are saved so you can review them, and you can delete them.</li>
        <li>Details are in the <LegalLink to={legalPaths.privacy}>Privacy Policy</LegalLink>.</li>
      </ul>
    ),
  },
  {
    id: 'control',
    title: 'Your controls',
    body: (
      <ul>
        <li><strong>Personalize AI</strong> (Settings → Privacy &amp; AI): turn off to stop the assistant and suggestions using your Career Profile.</li>
        <li><strong>Accept or skip</strong>: tailoring and rewrite suggestions are never applied without your choice.</li>
        <li><strong>Don’t use AI at all</strong>: you can start a resume from scratch or a template and edit everything yourself.</li>
      </ul>
    ),
  },
  {
    id: 'decisions',
    title: 'No automated decisions about you',
    body: (
      <p>
        {info.product} doesn’t use AI to make decisions that have legal or similarly significant effects on you, and doesn’t share scores with employers. Daily AI
        allowances exist to keep the service fair and reliable for everyone.
      </p>
    ),
  },
]

export function AiDisclosurePage() {
  return (
    <LegalDocument
      title="AI Use Disclosure"
      summary={
        <>
          {info.product} uses an AI model to help you write, tailor and review resumes and to practise interviews. It works from the facts you give it, can make
          mistakes, and your content isn’t used to train it.
        </>
      }
      sections={sections}
    />
  )
}

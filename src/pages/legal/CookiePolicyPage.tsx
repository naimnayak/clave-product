import { LegalDocument, LegalLink } from '@/components/legal/LegalDocument'
import type { LegalSection } from '@/components/legal/LegalDocument'
import { legalInfo as info, legalPaths } from '@/components/legal/legalInfo'

const items: Array<{ name: string; where: string; purpose: string; lasts: string }> = [
  { name: 'firebase:authUser:…', where: 'Local or session storage', purpose: 'Keeps you signed in (set by our authentication provider).', lasts: 'Until you sign out. Session storage only, if you unticked “Remember me”.' },
  { name: 'clave.auth', where: 'Local or session storage', purpose: 'Remembers who is signed in and whether setup is finished, so the app opens on the right screen.', lasts: 'Until you sign out' },
  { name: 'clave.session-id', where: 'Local storage', purpose: 'A random ID for this browser so you can see and sign out your devices in Account.', lasts: 'Replaced at every sign-in and sign-out' },
  { name: 'clave.settings.<account>', where: 'Local storage', purpose: 'A copy of your Settings so pages load instantly. The original is saved on your account.', lasts: 'Until you clear browser data' },
  { name: 'clave.theme', where: 'Local storage', purpose: 'Your Light, Dark or System appearance choice on this device.', lasts: 'Until you change it or clear browser data' },
  { name: 'clave.saved-jobs', where: 'Local storage', purpose: 'Shows saved jobs straight away while your saved list loads from your account.', lasts: 'Until you clear browser data' },
  { name: 'clave.onboarding', where: 'Session storage', purpose: 'Holds your profile draft during setup so a refresh doesn’t lose it.', lasts: 'Until you close the tab' },
  { name: 'clave.assistant.<account>', where: 'Session storage', purpose: 'Keeps your current AI Assistant conversation on screen.', lasts: 'Until you close the tab' },
]

const sections: LegalSection[] = [
  {
    id: 'summary',
    title: 'What we use',
    body: (
      <>
        <p>
          {info.product} doesn’t use advertising or analytics cookies, and doesn’t track you across other websites. We use your browser’s <strong>local storage</strong>{' '}
          and <strong>session storage</strong> for things the app needs to work. These are small pieces of data kept on your device, similar to cookies but never sent
          to our servers automatically.
        </p>
        <p>Because everything listed here is strictly necessary or remembers a choice you made, we don’t show a cookie banner.</p>
      </>
    ),
  },
  {
    id: 'list',
    title: 'Storage items',
    body: (
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Where</th>
              <th scope="col">Purpose</th>
              <th scope="col">How long</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name}>
                <td className="font-mono text-xs whitespace-nowrap text-[#F5F7F6]">{item.name}</td>
                <td>{item.where}</td>
                <td>{item.purpose}</td>
                <td>{item.lasts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-party cookies',
    body: (
      <ul>
        <li><strong>Google sign-in:</strong> if you choose “Continue with Google”, Google’s sign-in window may set its own cookies under Google’s policies.</li>
        <li><strong>Payments:</strong> when you pay, our payment processor’s checkout may set cookies needed for secure payment and fraud prevention, under its own policies.</li>
      </ul>
    ),
  },
  {
    id: 'control',
    title: 'Your choices',
    body: (
      <p>
        You can clear site data in your browser settings at any time. You’ll be signed out and device preferences such as appearance will reset. Your account data
        is not affected. Blocking storage entirely will stop sign-in from working. More about how we handle personal data is in the{' '}
        <LegalLink to={legalPaths.privacy}>Privacy Policy</LegalLink>.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: <p>If we ever add optional cookies such as analytics, we’ll update this page first and ask for your consent before setting them.</p>,
  },
]

export function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie & Local Storage Policy"
      summary={<>No ads, no analytics, no cross-site tracking. {info.product} only stores what it needs on your device to keep you signed in and remember your choices.</>}
      sections={sections}
    />
  )
}

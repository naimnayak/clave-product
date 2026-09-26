import { Bell, Briefcase, Clock, Download, FileText, Globe, LayoutTemplate, Lightbulb, LineChart, Mail, MessageCircleQuestion, Palette, Scale, Sparkles, BookOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { legalPaths } from '@/components/legal/legalInfo'
import { AppearanceControl } from '@/components/settings/AppearanceControl'
import { FeedbackModal } from '@/components/settings/FeedbackModal'
import { SettingRow } from '@/components/settings/SettingRow'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { useSettings } from '@/hooks/useSettings'
import { paths } from '@/routes/navigation'
import { apiClient } from '@/services/apiClient'
import { toast } from '@/store/toastStore'
import type { DateFormat, EmailPreference, UserSettings } from '@/types/settings'
import { templateIds, templates } from '@/utils/resumeTemplates'

const dateFormats: Array<[DateFormat, string]> = [
  ['dmy', 'DD MMM YYYY (e.g. 22 Sep 2026)'],
  ['mdy', 'MM/DD/YYYY (e.g. 09/22/2026)'],
  ['iso', 'YYYY-MM-DD (e.g. 2026-09-22)'],
]
const emailOptions: Array<[EmailPreference, string]> = [
  ['important', 'All important updates'],
  ['product', 'Product updates only'],
  ['none', 'No emails'],
]
const notificationRows: Array<[keyof UserSettings['notifications'], typeof Briefcase, string, string]> = [
  ['jobs', Briefcase, 'Job recommendations', 'Receive relevant job recommendations based on your profile.'],
  ['resumes', FileText, 'Resume updates', 'Get notified when your resumes need attention.'],
  ['applications', Bell, 'Application reminders', 'Receive reminders about important application activity.'],
  ['product', Sparkles, 'Product updates', 'Occasional updates about new Clave features.'],
]

const selectClass = 'w-full sm:w-72'

export function SettingsPage() {
  const { settings, update } = useSettings()
  const { hash } = useLocation()

  // Jump to the section named in the URL (#notifications, …) when the nav is used.
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 })
      return
    }
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const saved = (message: string) => toast.success(message)
  const [exporting, setExporting] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const exportData = async () => {
    setExporting(true)
    try {
      await apiClient.download('/me/export', `clave-data-${new Date().toISOString().slice(0, 10)}.json`)
      toast.success('Your data is downloading')
    } catch {
      toast.error('Couldn’t export your data', 'Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="font-editorial text-4xl font-medium tracking-tight text-text">Settings</h1>
        <p className="mt-1 text-secondary">Customize how Clave works for you.</p>
      </header>
    <SettingsLayout>
      <div className="flex flex-col gap-5">
        <SettingsSection id="general" title="General" description="Basic settings to personalize your Clave experience.">
          <SettingRow icon={Palette} title="Appearance" description="Choose how Clave looks on your device." control={<AppearanceControl />} />
          <SettingRow
            icon={Globe}
            title="Language"
            description="Select your preferred language for the application."
            control={
              <Select aria-label="Language" className={selectClass} value="en" onChange={() => undefined}>
                <option value="en">English</option>
              </Select>
            }
          />
          <SettingRow
            icon={Clock}
            title="Time & Date"
            description="Choose your preferred date format."
            control={
              <Select
                aria-label="Date format"
                className={selectClass}
                value={settings.dateFormat}
                onChange={(event) => {
                  update({ dateFormat: event.target.value as DateFormat })
                  saved('Date format saved')
                }}
              >
                {dateFormats.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            }
          />
          <SettingRow
            icon={Mail}
            title="Email Preferences"
            description="Choose the type of emails you want to receive from Clave."
            control={
              <Select
                aria-label="Email preferences"
                className={selectClass}
                value={settings.emailPreference}
                onChange={(event) => {
                  update({ emailPreference: event.target.value as EmailPreference })
                  saved('Email preference saved')
                }}
              >
                {emailOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            }
          />
        </SettingsSection>

        <SettingsSection id="notifications" title="Notifications" description="Choose what you want to be notified about.">
          {notificationRows.map(([key, icon, title, description]) => (
            <SettingRow
              key={key}
              icon={icon}
              title={title}
              description={description}
              control={<Toggle hideLabel label={title} checked={settings.notifications[key]} onChange={(checked) => update((current) => ({ ...current, notifications: { ...current.notifications, [key]: checked } }))} />}
            />
          ))}
        </SettingsSection>

        <SettingsSection id="privacy" title="Privacy & AI" description="Control how Clave uses your information.">
          <SettingRow
            icon={Sparkles}
            title="Personalize AI with my Career Profile"
            description="Let Clave’s AI use your profile for suggestions and job matching."
            control={<Toggle hideLabel label="Personalize AI with my Career Profile" checked={settings.privacy.personalizeAi} onChange={(checked) => update((current) => ({ ...current, privacy: { ...current.privacy, personalizeAi: checked } }))} />}
          />
          <SettingRow
            icon={LineChart}
            title="Share anonymous usage data"
            description="Help improve Clave. Never includes your resume or profile content."
            control={<Toggle hideLabel label="Share anonymous usage data" checked={settings.privacy.usageData} onChange={(checked) => update((current) => ({ ...current, privacy: { ...current.privacy, usageData: checked } }))} />}
          />
          <SettingRow
            icon={Download}
            title="Download my data"
            description="A JSON file with your account, Career Profile, resumes, applications and settings."
            control={
              <Button variant="secondary" size="sm" loading={exporting} onClick={() => void exportData()}>
                Download
              </Button>
            }
          />
        </SettingsSection>

        <SettingsSection id="preferences" title="Preferences" description="Defaults for how Clave works for you.">
          <SettingRow
            icon={LayoutTemplate}
            title="Default resume template"
            description="New resumes start with this template."
            control={
              <Select
                aria-label="Default resume template"
                className={selectClass}
                value={settings.defaultTemplate}
                onChange={(event) => {
                  update({ defaultTemplate: event.target.value as UserSettings['defaultTemplate'] })
                  saved('Default template saved')
                }}
              >
                {templateIds.map((id) => (
                  <option key={id} value={id}>
                    {templates[id].label}
                  </option>
                ))}
              </Select>
            }
          />
        </SettingsSection>

        <SettingsSection id="help" title="Help & Support" description="Get help using Clave.">
          <SettingRow
            icon={BookOpen}
            title="User Guide"
            description="Learn how to make the most of Clave."
            control={
              <Link to={paths.guide} className="text-sm font-semibold text-primary hover:text-primary-deep">
                Open guide
              </Link>
            }
          />
          <SettingRow
            icon={MessageCircleQuestion}
            title="Contact support"
            description="Ask a question or report a problem."
            control={
              <Link to={paths.contact} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                Contact support
              </Link>
            }
          />
          <SettingRow icon={Lightbulb} title="Share feedback" description="Tell us what would make Clave better." control={<Button variant="secondary" size="sm" onClick={() => setFeedbackOpen(true)}>Send feedback</Button>} />
          <SettingRow
            icon={Scale}
            title="Legal & policies"
            description="Privacy, terms, refunds, AI use and how to raise a grievance."
            control={
              <Link to={legalPaths.privacy} className="text-sm font-semibold text-primary hover:text-primary-deep">
                View policies
              </Link>
            }
          />
        </SettingsSection>
      </div>
    </SettingsLayout>
    {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  )
}

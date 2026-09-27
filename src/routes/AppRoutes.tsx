import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { LoadingState } from '@/components/ui/LoadingState'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { OnboardingLayout } from '@/layouts/OnboardingLayout'
import { useUpgradeModalStore } from '@/store/upgradeModalStore'
import { MarketingLayout } from '@/layouts/MarketingLayout'
import { AboutPage } from '@/pages/AboutPage'
import { ContactPage } from '@/pages/ContactPage'
import { HowItWorksPage } from '@/pages/HowItWorksPage'
import { PricingPage } from '@/pages/PricingPage'
import { Dashboard } from '@/pages/Dashboard'
import { Landing } from '@/pages/Landing'
import { NotFound } from '@/pages/NotFound'
import { ResumeEditorPage } from '@/pages/ResumeEditorPage'
import { CreateResumePage } from '@/pages/CreateResumePage'
import { AIResumeFlow } from '@/components/resumes/flows/AIResumeFlow'
import { ManualResumeFlow } from '@/components/resumes/flows/ManualResumeFlow'
import { TailorResumeFlow } from '@/components/resumes/flows/TailorResumeFlow'
import { TemplateLibrary } from '@/components/resumes/templates/TemplateLibrary'
import { ResumesPage } from '@/pages/ResumesPage'
import { JobDetailPage } from '@/pages/JobDetailPage'
import { JobsPage } from '@/pages/JobsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { AccountPage } from '@/pages/AccountPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AIAssistantPage } from '@/pages/AIAssistantPage'
import { AIMockInterviewPage } from '@/pages/AIMockInterviewPage'
import { GuidePage } from '@/pages/GuidePage'
import { UploadResumePage } from '@/pages/UploadResumePage'
import { AcceptableUsePage } from '@/pages/legal/AcceptableUsePage'
import { AiDisclosurePage } from '@/pages/legal/AiDisclosurePage'
import { CookiePolicyPage } from '@/pages/legal/CookiePolicyPage'
import { GrievancePage } from '@/pages/legal/GrievancePage'
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage'
import { RefundPolicyPage } from '@/pages/legal/RefundPolicyPage'
import { TermsPage } from '@/pages/legal/TermsPage'
import { LandingContainer } from '@/components/landing/LandingContainer'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { legalPaths } from '@/components/legal/legalInfo'
import { useAuthStore } from '@/store/authStore'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ImportLinkedInPage } from '@/pages/onboarding/ImportLinkedInPage'
import { ImportResumePage } from '@/pages/onboarding/ImportResumePage'
import { ManualSetupPage } from '@/pages/onboarding/ManualSetupPage'
import { ReviewPage } from '@/pages/onboarding/ReviewPage'
import { WelcomePage } from '@/pages/onboarding/WelcomePage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { GuestOnly, OnboardingOnly, RequireAuth, RequireOnboarding } from '@/routes/guards'
import { paths } from '@/routes/navigation'

const AdminApp = lazy(() => import('@/admin/AdminApp'))

/** Old links keep working: forward to the new route and keep any query string. */
function Redirect({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

function LegacyResumeRedirect() {
  const { resumeId } = useParams()
  return <Navigate to={`/resumes/${resumeId}/edit`} replace />
}

function UpgradeRouteRedirect() {
  const openUpgradeModal = useUpgradeModalStore((s) => s.openUpgradeModal)
  useEffect(() => {
    openUpgradeModal()
  }, [openUpgradeModal])
  return <Navigate to={paths.dashboard} replace />
}

const useInApp = () => useAuthStore((s) => Boolean(s.user) && s.onboardingComplete)

/** The User Guide is public (the footer links to it): inside the app shell when signed in, on the marketing site otherwise. */
function GuideLayout() {
  return useInApp() ? <AppLayout /> : <MarketingLayout />
}

function GuideEntry() {
  if (useInApp()) return <GuidePage />
  return (
    <div data-theme="dark" className="flex min-h-dvh flex-col bg-[#030706] text-text">
      <LandingContainer className="max-w-[1120px] flex-1 pt-8 pb-20 sm:pt-12">
        <GuidePage />
      </LandingContainer>
      <LandingFooter />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Marketing with persistent navbar and smooth transitions */}
      <Route element={<MarketingLayout />}>
        <Route path={paths.landing} element={<Landing />} />
        <Route path={paths.howItWorks} element={<HowItWorksPage />} />
        <Route path={paths.about} element={<AboutPage />} />
        <Route path={paths.contact} element={<ContactPage />} />
        <Route path={paths.pricing} element={<PricingPage />} />
        <Route path={legalPaths.privacy} element={<PrivacyPolicyPage />} />
        <Route path={legalPaths.terms} element={<TermsPage />} />
        <Route path={legalPaths.cookies} element={<CookiePolicyPage />} />
        <Route path={legalPaths.refunds} element={<RefundPolicyPage />} />
        <Route path={legalPaths.acceptableUse} element={<AcceptableUsePage />} />
        <Route path={legalPaths.ai} element={<AiDisclosurePage />} />
        <Route path={legalPaths.grievance} element={<GrievancePage />} />
        <Route path="/legal" element={<Navigate to={legalPaths.privacy} replace />} />
        <Route path="/privacy" element={<Navigate to={legalPaths.privacy} replace />} />
        <Route path="/terms" element={<Navigate to={legalPaths.terms} replace />} />
      </Route>
      <Route element={<GuideLayout />}>
        <Route path={paths.guide} element={<GuideEntry />} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path={paths.login} element={<LoginPage />} />
          <Route path={paths.signup} element={<SignupPage />} />
          <Route path={paths.forgotPassword} element={<ForgotPasswordPage />} />
        </Route>
      </Route>

      {/* Authenticated */}
      <Route element={<RequireAuth />}>
        {/* Admin panel: its own layout and bundle; the server checks the staff role on every request. */}
        <Route
          path={`${paths.admin}/*`}
          element={
            <Suspense fallback={<LoadingState label="Opening the admin panel…" className="min-h-dvh" />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route element={<OnboardingOnly />}>
          <Route element={<OnboardingLayout />}>
            <Route path={paths.onboarding}>
              <Route index element={<WelcomePage />} />
              <Route path="import-resume" element={<ImportResumePage />} />
              <Route path="import-linkedin" element={<ImportLinkedInPage />} />
              <Route path="manual" element={<ManualSetupPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="*" element={<Navigate to={paths.onboarding} replace />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireOnboarding />}>
          {/* The editor is the shared destination of all four creation flows: a focused full-screen workspace outside the AppShell. */}
          <Route path="/resumes/:resumeId/edit" element={<ResumeEditorPage />} />
          <Route element={<AppLayout />}>
            <Route path={paths.dashboard} element={<Dashboard />} />
            <Route path={paths.careerProfile} element={<ProfilePage />} />
            <Route path={paths.jobs} element={<JobsPage />} />
            <Route path={paths.resumes} element={<ResumesPage />} />
            <Route path={paths.createResume} element={<CreateResumePage />} />
            <Route path={paths.createWithAi} element={<AIResumeFlow />} />
            <Route path={paths.tailorResume} element={<TailorResumeFlow />} />
            <Route path={paths.createManual} element={<ManualResumeFlow />} />
            <Route path={paths.createFromTemplate} element={<TemplateLibrary />} />
            <Route path="/resumes/tailor" element={<Redirect to={paths.tailorResume} />} />
            <Route path="/resumes/templates" element={<Redirect to={paths.createFromTemplate} />} />
            <Route path="/resumes/builder" element={<Redirect to={paths.createManual} />} />
            <Route path="/resumes/:resumeId" element={<LegacyResumeRedirect />} />
            <Route path={paths.importResume} element={<UploadResumePage />} />
            <Route path="/jobs/saved" element={<Navigate to={`${paths.jobs}?view=saved`} replace />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path={paths.assistant} element={<AIAssistantPage />} />
            <Route path={paths.account} element={<AccountPage />} />
            <Route path={paths.settings} element={<SettingsPage />} />
            <Route path={paths.mockInterview} element={<AIMockInterviewPage />} />
            <Route path={paths.upgrade} element={<UpgradeRouteRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

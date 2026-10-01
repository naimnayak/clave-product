import { ResumeCreationChoice } from '@/components/resumes/ResumeCreationChoice'
import { FlowShell } from '@/components/resumes/FlowShell'

export function CreateResumePage() {
  return (
    <FlowShell
      title="Create a Resume"
      description="Choose how you’d like to start. Each path prepares your resume differently, then opens the same editor."
    >
      <ResumeCreationChoice variant="detailed" className="md:grid-cols-2" />
    </FlowShell>
  )
}

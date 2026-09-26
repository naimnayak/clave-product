import { Check, ChevronDown, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown'
import { useApplications } from '@/hooks/useApplications'
import { applicationStatusLabels } from '@/services/applications.service'
import type { ApplicationStatus } from '@/services/applications.service'
import { toast } from '@/store/toastStore'
import type { Job } from '@/types/job'

const STATUSES: ApplicationStatus[] = ['applied', 'interviewing', 'rejected']

/**
 * "Apply on Company Site" opens the listing's application page and adds the job to the tracker.
 * Once tracked, the button becomes a status menu (Applied → Interviewing → Not selected).
 */
export function ApplyControl({ job, size = 'md' }: { job: Job; size?: 'sm' | 'md' }) {
  const { applications, setStatus, remove } = useApplications()
  const tracked = applications[job.id]

  const apply = async () => {
    if (job.applyUrl) window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
    if (await setStatus(job, 'applied')) {
      toast.success(job.applyUrl ? 'Added to your tracker' : 'Marked as applied', 'Find it under Jobs → Applied. Update the stage as you hear back.')
    }
  }

  if (!tracked) {
    return (
      <Button variant="secondary" size={size} trailingIcon={job.applyUrl ? <ExternalLink className="size-4" /> : <Check className="size-4" />} onClick={() => void apply()}>
        {job.applyUrl ? 'Apply on Company Site' : 'Mark as Applied'}
      </Button>
    )
  }

  return (
    <Dropdown
      label="Application status"
      align="end"
      trigger={(triggerProps) => (
        <Button variant="secondary" size={size} leadingIcon={<Check className="size-4 text-primary" />} trailingIcon={<ChevronDown className="size-4" />} {...triggerProps}>
          {applicationStatusLabels[tracked.status]}
        </Button>
      )}
    >
      {STATUSES.map((status) => (
        <DropdownItem key={status} icon={status === tracked.status ? Check : undefined} onSelect={() => void setStatus(job, status)}>
          {applicationStatusLabels[status]}
        </DropdownItem>
      ))}
      <DropdownSeparator />
      {job.applyUrl && (
        <DropdownItem icon={ExternalLink} onSelect={() => window.open(job.applyUrl, '_blank', 'noopener,noreferrer')}>
          Open application page
        </DropdownItem>
      )}
      <DropdownItem icon={Trash2} onSelect={() => void remove(job.id)}>
        Remove from tracker
      </DropdownItem>
    </Dropdown>
  )
}

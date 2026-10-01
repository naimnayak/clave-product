import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { EmptyState } from '@/components/ui/EmptyState'
import { paths } from '@/routes/navigation'

export function NotFound({ homePath = paths.dashboard, homeLabel = 'Back to Dashboard' }: { homePath?: string; homeLabel?: string }) {
  return (
    <EmptyState
      icon={SearchX}
      title="Page not found"
      description="The page you’re looking for doesn’t exist or has moved."
      action={
        <Link to={homePath} className={buttonStyles({ variant: 'secondary' })}>
          {homeLabel}
        </Link>
      }
      className="py-24"
    />
  )
}

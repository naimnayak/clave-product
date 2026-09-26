import { useState } from 'react'
import { cn } from '@/utils/cn'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl',
}

interface AvatarProps {
  name: string
  src?: string
  size?: AvatarSize
  className?: string
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand font-semibold text-on-primary shadow-xs select-none',
        sizes[size],
        className,
      )}
    >
      {src && !failed ? (
        <img src={src} alt={name} onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <span aria-label={name}>{getInitials(name)}</span>
      )}
    </span>
  )
}

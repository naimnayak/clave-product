import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { NextMove } from '@/types/career'
import { cn } from '@/utils/cn'

const tints = {
  mint: 'bg-primary/12 text-primary-deep',
  amber: 'bg-warning/12 text-warning',
}

export function NextMoves({ moves }: { moves: NextMove[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {moves.map(({ id, title, description, to, icon: Icon, tint }) => (
        <li key={id}>
          <Link
            to={to}
            className="group flex h-full items-center gap-3.5 rounded-large border border-border bg-surface p-2.5 transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-card"
          >
            <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-default', tints[tint])}>
              <Icon className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text">{title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-secondary">{description}</span>
            </span>
            <ArrowRight className="mr-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

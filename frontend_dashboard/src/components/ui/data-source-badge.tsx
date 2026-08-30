import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { USE_MOCK } from '@/lib/api/config'
import { cn } from '@/lib/utils'

export function DataSourceBadge({ className }: { className?: string }) {
  if (!USE_MOCK) return null
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-amber-500/50 bg-amber-500/10 font-mono text-[10px] tracking-wide text-amber-700 uppercase dark:text-amber-400',
        className,
      )}
    >
      mock
    </Badge>
  )
}

export function SectionTitle({
  children,
  className,
  description,
  size = 'lg',
  inverted = false,
}: {
  children: ReactNode
  className?: string
  description?: ReactNode
  size?: 'lg' | 'md'
  inverted?: boolean
}) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2
          className={cn(
            'leading-tight font-semibold tracking-tight',
            size === 'lg' ? 'text-[32px]' : 'text-[24px]',
            inverted ? 'text-white' : 'text-[var(--hg-ink)]',
          )}
        >
          {children}
        </h2>
        <DataSourceBadge />
      </div>
      {description ? (
        <p className={cn('text-sm', inverted ? 'text-white/80' : 'text-[var(--hg-muted)]')}>
          {description}
        </p>
      ) : null}
    </div>
  )
}

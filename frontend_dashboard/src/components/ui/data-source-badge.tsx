import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { CardTitle } from '@/components/ui/card'
import { USE_MOCK } from '@/lib/api/config'
import { cn } from '@/lib/utils'

export function DataSourceBadge({ className }: { className?: string }) {
  if (!USE_MOCK) return null
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[10px] uppercase tracking-wide border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        className
      )}
    >
      mock
    </Badge>
  )
}

export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <CardTitle>{children}</CardTitle>
      <DataSourceBadge />
    </div>
  )
}

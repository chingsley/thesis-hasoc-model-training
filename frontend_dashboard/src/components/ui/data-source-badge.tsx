import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { CardTitle } from '@/components/ui/card'
import type { DataSource } from '@/lib/api/sources'
import { cn } from '@/lib/utils'

const styles: Record<DataSource, string> = {
  mock: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  live: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
}

export function DataSourceBadge({
  source,
  className,
}: {
  source: DataSource
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn('font-mono text-[10px] uppercase tracking-wide', styles[source], className)}>
      {source}
    </Badge>
  )
}

export function SectionTitle({
  children,
  source,
  className,
}: {
  children: ReactNode
  source: DataSource
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <CardTitle>{children}</CardTitle>
      <DataSourceBadge source={source} />
    </div>
  )
}

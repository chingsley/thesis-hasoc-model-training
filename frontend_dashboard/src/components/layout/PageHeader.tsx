import type { ReactNode } from 'react'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { ViewModeToggle } from '@/components/ui/view-mode-toggle'
import { cn } from '@/lib/utils'

/**
 * Top-of-page heading row: title + global Plain/Technical toggle (same slot on every route).
 */
export function PageHeader({
  children,
  description,
  actions,
  className,
  pageTitle = true,
}: {
  children: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  pageTitle?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <SectionTitle description={description} pageTitle={pageTitle}>
        {children}
      </SectionTitle>
      <div className="mt-1.5 flex shrink-0 flex-wrap items-center gap-3">
        <ViewModeToggle />
        {actions}
      </div>
    </div>
  )
}
import type { TriageStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

const statusConfig: Record<TriageStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  new: { label: 'New', variant: 'destructive' },
  reviewed: { label: 'Reviewed', variant: 'default' },
  reported: { label: 'Reported', variant: 'secondary' },
}

export function TriageStatusBadge({ status }: { status: TriageStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  )
}

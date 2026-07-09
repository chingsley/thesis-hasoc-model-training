import { Badge } from '@/components/ui/badge'
import type { TriageStatus } from '@/lib/types'
import { CheckCircle, Eye, Send } from 'lucide-react'

interface TriageStatusBadgeProps {
  status: TriageStatus
}

const statusConfig: Record<TriageStatus, { label: string; variant: 'secondary' | 'default' | 'outline'; icon: typeof Eye }> = {
  new: { label: 'New', variant: 'outline', icon: Eye },
  reviewed: { label: 'Reviewed', variant: 'secondary', icon: CheckCircle },
  reported: { label: 'Reported', variant: 'default', icon: Send },
}

export function TriageStatusBadge({ status }: TriageStatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <config.icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

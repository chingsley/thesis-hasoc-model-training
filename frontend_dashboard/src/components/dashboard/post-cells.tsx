import { Badge, labelBadgeVariant } from '@/components/ui/badge'

export function PostIdCell({ id }: { id: string }) {
  return <span className="font-mono text-xs text-muted-foreground">{id}</span>
}

export function PostTextCell({ text }: { text: string }) {
  return <p className="line-clamp-2">{text}</p>
}

export function PredictionCell({ label }: { label: string }) {
  return (
    <Badge variant={labelBadgeVariant(label)} className="text-xs">
      {label}
    </Badge>
  )
}

export function HateProbCell({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const bar =
    value > 0.7 ? 'bg-red-500' : value > 0.4 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs w-8">{pct}%</span>
    </div>
  )
}

export function DateCell({ timestamp }: { timestamp?: string }) {
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {(timestamp || '').split('T')[0]}
    </span>
  )
}

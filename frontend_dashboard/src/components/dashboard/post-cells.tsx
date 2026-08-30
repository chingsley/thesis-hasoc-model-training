import { Badge, labelBadgeVariant } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function PostIdCell({ id }: { id: string }) {
  return (
    <span
      className="inline-flex max-w-[7.5rem] truncate rounded-[4px] bg-[var(--hg-canvas)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--hg-muted)]"
      title={id}
    >
      {id}
    </span>
  )
}

export function PostTextCell({ text }: { text: string }) {
  return (
    <p className="line-clamp-2 max-w-[28rem] text-sm leading-snug text-[var(--hg-ink)]" title={text}>
      {text}
    </p>
  )
}

export function PredictionCell({ label }: { label: string }) {
  return (
    <Badge variant={labelBadgeVariant(label)} className="rounded-[4px] text-[11px] font-semibold">
      {label}
    </Badge>
  )
}

export function HateProbCell({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const tone =
    value > 0.7
      ? 'bg-[var(--hg-secondary)]'
      : value > 0.4
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  return (
    <div
      className="flex min-w-[6.5rem] items-center gap-2"
      aria-label={`Hate probability ${pct} percent`}
    >
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--hg-canvas)]"
        role="presentation"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 font-mono text-[11px] tabular-nums text-[var(--hg-muted)]">{pct}%</span>
    </div>
  )
}

export function DateCell({ timestamp }: { timestamp?: string }) {
  const day = (timestamp || '').split('T')[0]
  if (!day) {
    return <span className="text-xs text-[var(--hg-subtle)]">—</span>
  }
  return (
    <time
      dateTime={timestamp}
      className="font-mono text-[11px] tabular-nums text-[var(--hg-muted)]"
    >
      {day}
    </time>
  )
}

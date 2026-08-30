import type { Label, PerClassMetrics as PerClassMetricsType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PerClassMetricsProps {
  metrics: Record<string, PerClassMetricsType>
}

const CLASS_ORDER: Label[] = ['Normal', 'Abuse', 'Hate']

const METRIC_KEYS = [
  { key: 'precision' as const, label: 'Precision', bar: 'bg-[var(--hg-brand)]' },
  { key: 'recall' as const, label: 'Recall', bar: 'bg-[#6b7c93]' },
  { key: 'f1' as const, label: 'F1', bar: 'bg-[var(--hg-ink)]' },
]

function Meter({
  label,
  value,
  barClass,
}: {
  label: string
  value: number
  barClass: string
}) {
  const pct = Math.max(0, Math.min(100, value * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--hg-muted)]">{label}</span>
        <span className="text-xs font-semibold text-[var(--hg-ink)] tabular-nums">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hg-canvas)]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function PerClassMetrics({ metrics }: PerClassMetricsProps) {
  const rows = CLASS_ORDER.map((label) => {
    const m = metrics[label]
    return m ? { label, ...m } : null
  }).filter(Boolean) as Array<{ label: Label } & PerClassMetricsType>

  // Fall back to whatever keys exist if ordering misses (mock/odd payloads).
  const display =
    rows.length > 0
      ? rows
      : Object.entries(metrics).map(([label, m]) => ({ label: label as Label, ...m }))

  return (
    <div className="space-y-1">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--hg-muted)]">
        {METRIC_KEYS.map((m) => (
          <span key={m.key} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2 rounded-[2px]', m.bar)} aria-hidden />
            {m.label}
          </span>
        ))}
      </div>

      <div className="divide-y divide-[var(--hg-border)] rounded-[4px] border border-[var(--hg-border)]">
        {display.map((row) => (
          <div key={row.label} className="space-y-3 px-4 py-3.5 sm:px-5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--hg-ink)]">{row.label}</h4>
              <span className="rounded-[4px] bg-[var(--hg-canvas)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--hg-muted)] tabular-nums">
                {row.support.toLocaleString()} support
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {METRIC_KEYS.map((m) => (
                <Meter key={m.key} label={m.label} value={row[m.key]} barClass={m.bar} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

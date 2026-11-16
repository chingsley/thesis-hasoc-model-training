import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { driftRows, type DriftRow } from '@/lib/drift-summary'
import { PLAIN_LABELS, exactPercent } from '@/lib/plain-language'
import { cn } from '@/lib/utils'
import type { DriftDataPoint } from '@/lib/types'

function formatDay(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** A small trend line, drawn on the same 50–100% scale as the technical chart. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 120
  const height = 32
  const clamp = (v: number) => Math.min(1, Math.max(0.5, v))
  const x = (i: number) => (values.length === 1 ? width / 2 : (i / (values.length - 1)) * width)
  const y = (v: number) => height - 3 - ((clamp(v) - 0.5) / 0.5) * (height - 6)
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="shrink-0"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={color} />
    </svg>
  )
}

function StatusBadge({ row }: { row: DriftRow }) {
  const Icon = row.size === 'steady' ? Minus : row.direction === 'up' ? ArrowUp : ArrowDown
  const worrying = row.size !== 'steady' && row.direction === 'down'
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[11px] font-semibold',
        worrying
          ? row.size === 'large'
            ? 'bg-[color-mix(in_srgb,var(--hg-matrix-error)_10%,white)] text-[var(--hg-matrix-error)]'
            : 'bg-amber-50 text-amber-700'
          : 'bg-emerald-50 text-emerald-700',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {row.status}
    </span>
  )
}

/** "Is HateGuard still working as expected?" — one status row per label. */
export function PlainDrift({ data }: { data: DriftDataPoint[] }) {
  const rows = driftRows(data)

  if (rows.length === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-1 rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)] text-center">
        <p className="text-sm font-medium text-[var(--hg-ink)]">Nothing to show yet</p>
        <p className="max-w-sm text-xs text-[var(--hg-muted)]">
          This check appears after enough posts have been classified in this language.
        </p>
      </div>
    )
  }

  const from = formatDay(data[0].date)
  const to = formatDay(data[data.length - 1].date)
  const needsAttention = rows.some((row) => row.size !== 'steady' && row.direction === 'down')

  return (
    <div className="animate-in fade-in space-y-5 duration-300">
      <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
        Each time HateGuard labels a post, it also reports how sure it is. This check compares how
        sure it was on <strong>{from}</strong> with how sure it was on <strong>{to}</strong>.
      </p>

      <ul className="divide-y divide-[var(--hg-border)] rounded-[4px] border border-[var(--hg-border)]">
        {rows.map((row) => {
          const info = PLAIN_LABELS[row.label]
          const Arrow = row.direction === 'up' ? ArrowUp : row.direction === 'down' ? ArrowDown : Minus
          return (
            <li
              key={row.label}
              className="grid grid-cols-1 items-center gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_120px_12rem] sm:gap-6"
            >
              <div className="min-w-0 space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--hg-ink)]">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-[2px]"
                    style={{ backgroundColor: info.color }}
                  />
                  {info.name} posts
                </p>
                <StatusBadge row={row} />
              </div>
              <Sparkline values={row.values} color={info.color} />
              <div className="text-sm tabular-nums sm:text-right">
                <p className="font-semibold text-[var(--hg-ink)]">
                  {exactPercent(row.first)} → {exactPercent(row.latest)}
                </p>
                <p className="inline-flex items-center gap-1 text-xs text-[var(--hg-muted)]">
                  <Arrow className="size-3.5" aria-hidden />
                  {row.direction === 'none'
                    ? 'No change'
                    : `Went ${row.direction} by ${Math.abs(row.changePoints).toFixed(1)} points`}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="text-sm leading-relaxed text-[var(--hg-muted)]">
        {needsAttention
          ? 'HateGuard has become less sure about some posts. This can mean people are using new words or styles it has not learned, so check its labels more carefully.'
          : 'HateGuard is about as sure as it was at the start of this period. A clear drop would mean people may be using new words or styles it has not learned.'}
      </p>
    </div>
  )
}

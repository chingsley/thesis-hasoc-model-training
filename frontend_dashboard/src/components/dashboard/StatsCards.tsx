import type { VolumeDataPoint } from '@/lib/types'
import { sumVolume } from '@/lib/volume-csv'
import { cn } from '@/lib/utils'

interface StatsCardsProps {
  volume?: VolumeDataPoint[]
  periodLabel: string
}

type Trend = { delta: number; up: boolean }

function sumField(
  points: VolumeDataPoint[],
  field: 'total' | 'normal_count' | 'abuse_count' | 'hate_count',
): number {
  return points.reduce((sum, p) => sum + (p[field] ?? 0), 0)
}

function trendFromVolume(
  volume: VolumeDataPoint[] | undefined,
  field: 'total' | 'normal_count' | 'abuse_count' | 'hate_count',
): Trend | null {
  if (!volume || volume.length < 4) return null
  const mid = Math.floor(volume.length / 2)
  const earlier = sumField(volume.slice(0, mid), field)
  const recent = sumField(volume.slice(mid), field)
  const delta = recent - earlier
  if (delta === 0) return null
  return { delta: Math.abs(delta), up: delta > 0 }
}

function TrendPill({ trend, inverted }: { trend: Trend; inverted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        inverted
          ? trend.up
            ? 'bg-white/20 text-white'
            : 'bg-black/25 text-white'
          : trend.up
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-rose-50 text-rose-600',
      )}
    >
      {trend.delta}
      <span aria-hidden className="text-[10px] leading-none">
        {trend.up ? '↗' : '↘'}
      </span>
    </span>
  )
}

function MiniBars({
  values,
  highlightIndex,
  inverted,
  label,
}: {
  values: number[]
  highlightIndex: number
  inverted?: boolean
  label: string
}) {
  const max = Math.max(...values, 1)
  const description = `${label}: ${values.join(', ')}. Peak at segment ${highlightIndex + 1}.`

  return (
    <div
      className="flex h-12 items-end gap-1.5 self-end"
      role="img"
      aria-label={description}
    >
      {values.map((v, i) => {
        const highlighted = i === highlightIndex
        const height = Math.max(14, Math.round((v / max) * 48))
        return (
          <div
            key={i}
            className={cn(
              'w-1.5 rounded-t-full transition-colors',
              inverted
                ? highlighted
                  ? 'bg-white'
                  : 'bg-white/40'
                : highlighted
                  ? 'bg-[var(--hg-accent)]'
                  : 'bg-[#dbe4f5]',
            )}
            style={{ height }}
          />
        )
      })}
    </div>
  )
}

export function StatsCards({ volume, periodLabel }: StatsCardsProps) {
  const points = volume ?? []
  const total = sumVolume(points, 'total')
  const normal = sumVolume(points, 'normal_count')
  const abuse = sumVolume(points, 'abuse_count')
  const hate = sumVolume(points, 'hate_count')

  const dailyTotals = (() => {
    if (points.length === 0) return [4, 7, 5, 9, 6, 8]
    const chunk = Math.max(1, Math.floor(points.length / 6))
    const buckets: number[] = []
    for (let i = 0; i < 6; i++) {
      const slice = points.slice(i * chunk, (i + 1) * chunk)
      buckets.push(sumField(slice, 'hate_count') || sumField(slice, 'total'))
    }
    return buckets
  })()
  const highlightIndex = dailyTotals.indexOf(Math.max(...dailyTotals))

  const items = [
    {
      label: 'Posts Processed',
      value: total,
      subtitle: 'Posts',
      trend: trendFromVolume(points, 'total'),
      danger: false,
      chart: false,
    },
    {
      label: 'Normal Posts',
      value: normal,
      subtitle: 'Classified',
      trend: trendFromVolume(points, 'normal_count'),
      danger: false,
      chart: false,
    },
    {
      label: 'Abusive Posts',
      value: abuse,
      subtitle: 'Detected',
      trend: trendFromVolume(points, 'abuse_count'),
      danger: false,
      chart: false,
    },
    {
      label: 'Hateful Posts',
      value: hate,
      subtitle: 'Detected',
      trend: trendFromVolume(points, 'hate_count'),
      danger: true,
      chart: true,
    },
  ] as const

  return (
    <div className="ml-[calc(50%-50cqi)] w-[100cqi] max-w-[100cqi] bg-white">
      <div className="grid grid-cols-1 divide-y divide-[var(--hg-border)] pl-4 sm:grid-cols-2 sm:divide-y-0 md:pl-6 lg:grid-cols-4 lg:pl-8">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              'relative flex min-h-[112px] items-stretch justify-between gap-4 px-5 py-5 md:px-6',
              item.danger && 'bg-[#4a3f6e] text-white md:pr-6 lg:pr-8',
            )}
          >
            {index > 0 && !item.danger && (
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute top-4 bottom-4 left-0 hidden w-px bg-[var(--hg-border)]',
                  (index === 1 || index === 3) && 'sm:block',
                  'lg:block',
                )}
              />
            )}
            <div className="flex min-w-0 flex-col justify-between gap-3">
              <p
                className={cn(
                  'text-[13px] font-medium',
                  item.danger ? 'text-white/85' : 'text-[var(--hg-muted)]',
                )}
              >
                {item.label}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    'text-[1.75rem] leading-none font-bold tracking-tight tabular-nums',
                    item.danger ? 'text-white' : 'text-[var(--hg-ink)]',
                  )}
                >
                  {item.value.toLocaleString()}
                </p>
                {item.trend && <TrendPill trend={item.trend} inverted={item.danger} />}
              </div>
              <p className={cn('text-xs', item.danger ? 'text-white/75' : 'text-[var(--hg-subtle)]')}>
                {item.subtitle}
              </p>
            </div>
            {item.chart && (
              <MiniBars
                values={dailyTotals}
                highlightIndex={highlightIndex}
                inverted={item.danger}
                label={`Hateful posts trend over ${periodLabel}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

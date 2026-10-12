import type { VolumeDataPoint } from '@/lib/types'
import { sumVolume } from '@/lib/volume-csv'
import { cn } from '@/lib/utils'
import {
  SummaryStatCell,
  SummaryStatGrid,
  SummaryStatStrip,
  SummaryStatTile,
} from '@/components/ui/summary-stat-strip'

interface StatsCardsProps {
  volume?: VolumeDataPoint[]
  periodLabel: string
}

function sumField(
  points: VolumeDataPoint[],
  field: 'total' | 'normal_count' | 'abuse_count' | 'hate_count',
): number {
  return points.reduce((sum, p) => sum + (p[field] ?? 0), 0)
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
                  : 'bg-[var(--hg-chart-bar-muted)]',
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
      label: 'Total processed posts',
      value: total,
      subtitle: 'Posts',
      accent: false,
      chart: false,
    },
    {
      label: 'Normal Posts',
      value: normal,
      subtitle: 'Classified',
      accent: false,
      chart: false,
    },
    {
      label: 'Abusive Posts',
      value: abuse,
      subtitle: 'Detected',
      accent: false,
      chart: false,
    },
    {
      label: 'Hateful Posts',
      value: hate,
      subtitle: 'Detected',
      accent: true,
      chart: true,
    },
  ] as const

  return (
    <SummaryStatStrip>
      <SummaryStatGrid columns={4}>
        {items.map((item, index) => (
          <SummaryStatCell key={item.label} index={index} columns={4} accent={item.accent}>
            <SummaryStatTile
              label={item.label}
              value={item.value.toLocaleString()}
              subtitle={item.subtitle}
              accent={item.accent}
              trailing={
                item.chart
                  ? (
                      <MiniBars
                        values={dailyTotals}
                        highlightIndex={highlightIndex}
                        inverted={item.accent}
                        label={`Hateful posts trend over ${periodLabel}`}
                      />
                    )
                  : undefined
              }
            />
          </SummaryStatCell>
        ))}
      </SummaryStatGrid>
    </SummaryStatStrip>
  )
}

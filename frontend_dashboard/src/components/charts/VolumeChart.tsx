import { useEffect, useMemo, useState } from 'react'
import type { VolumeDataPoint } from '@/lib/types'
import type { ChartStyle, ResolvedVolumeRange } from '@/lib/volume-range'
import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

/** Brand series — Normal vs Hate kept clearly distinct */
export const VOLUME_SERIES = {
  total: { key: 'total', label: 'Total', color: '#625885' },
  normal_count: { key: 'normal_count', label: 'Normal', color: '#2f9e6b' },
  abuse_count: { key: 'abuse_count', label: 'Abuse', color: '#d4a017' },
  hate_count: { key: 'hate_count', label: 'Hate', color: '#c1002c' },
} as const

type SeriesKey = keyof typeof VOLUME_SERIES

interface VolumeChartProps {
  data: VolumeDataPoint[]
  range: ResolvedVolumeRange
  chartStyle?: ChartStyle
}

export type ChartPoint = {
  label: string
  tooltip: string
  normal_count: number
  abuse_count: number
  hate_count: number
  total: number
}

function parseBucket(iso: string): Date {
  const cleaned = iso.replace(/^\[MOCK\]\s*/i, '')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleaned)) {
    return new Date(`${cleaned}:00Z`)
  }
  return new Date(cleaned)
}

function formatHourLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatDayTimeLabel(d: Date): string {
  return `${formatDayLabel(d)} ${formatHourLabel(d)}`
}

export function toChartPoints(data: VolumeDataPoint[], range: ResolvedVolumeRange): ChartPoint[] {
  if (range.aggregate === 'day') {
    const byDay = new Map<string, ChartPoint>()
    for (const point of data) {
      const d = parseBucket(point.hour)
      if (Number.isNaN(d.getTime())) continue
      const dayKey = d.toISOString().slice(0, 10)
      const existing = byDay.get(dayKey)
      if (existing) {
        existing.normal_count += point.normal_count
        existing.abuse_count += point.abuse_count
        existing.hate_count += point.hate_count
        existing.total += point.total
      } else {
        byDay.set(dayKey, {
          label: formatDayLabel(d),
          tooltip: formatDayLabel(d),
          normal_count: point.normal_count,
          abuse_count: point.abuse_count,
          hate_count: point.hate_count,
          total: point.total,
        })
      }
    }
    return [...byDay.values()]
  }

  return data.map((point) => {
    const d = parseBucket(point.hour)
    const valid = !Number.isNaN(d.getTime())
    return {
      label: !valid
        ? point.hour.slice(-5)
        : range.hours <= 24
          ? formatHourLabel(d)
          : formatDayLabel(d),
      tooltip: valid ? formatDayTimeLabel(d) : point.hour,
      normal_count: point.normal_count,
      abuse_count: point.abuse_count,
      hate_count: point.hate_count,
      total: point.total,
    }
  })
}

export function volumeKpis(points: ChartPoint[]) {
  if (!points.length) {
    return { peakLabel: '—', peakTotal: 0, hateShare: 0, avgPerBucket: 0 }
  }
  let peak = points[0]
  let sum = 0
  let hate = 0
  for (const p of points) {
    sum += p.total
    hate += p.hate_count
    if (p.total > peak.total) peak = p
  }
  return {
    peakLabel: peak.tooltip,
    peakTotal: peak.total,
    hateShare: sum > 0 ? Math.round((hate / sum) * 100) : 0,
    avgPerBucket: Math.round(sum / points.length),
  }
}

function tickInterval(pointCount: number, range: ResolvedVolumeRange): number {
  if (range.aggregate === 'day') {
    if (range.hours >= 2160) return Math.max(0, Math.floor(pointCount / 8) - 1)
    return Math.max(0, Math.floor(pointCount / 10) - 1)
  }
  if (range.hours <= 24) return 2
  return Math.max(0, Math.floor(pointCount / 12) - 1)
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

const LINE_KEYS: SeriesKey[] = ['total', 'normal_count', 'abuse_count', 'hate_count']
const STACK_KEYS: SeriesKey[] = ['normal_count', 'abuse_count', 'hate_count']

function VolumeTooltip({
  active,
  payload,
  visible,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
  visible: Set<SeriesKey>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const total = row.total || 1
  const rows = (
    [
      ['normal_count', row.normal_count],
      ['abuse_count', row.abuse_count],
      ['hate_count', row.hate_count],
      ['total', row.total],
    ] as const
  ).filter(([key]) => visible.has(key))

  return (
    <div className="min-w-[180px] rounded-[4px] border border-[var(--hg-border)] bg-white px-3.5 py-2.5 shadow-[var(--hg-shadow)]">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--hg-ink)]">{row.tooltip}</p>
      <div className="space-y-1.5">
        {rows.map(([key, value]) => {
          const series = VOLUME_SERIES[key]
          const isTotal = key === 'total'
          return (
            <div key={key} className="flex items-center justify-between gap-8">
              <span className="flex items-center gap-2 text-[11px] text-[var(--hg-muted)]">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: series.color }}
                />
                {series.label}
              </span>
              <span
                className={cn(
                  'tabular-nums text-[11px]',
                  isTotal ? 'font-semibold text-[var(--hg-ink)]' : 'text-[var(--hg-ink)]',
                )}
              >
                {value.toLocaleString()}
                {!isTotal && (
                  <span className="ml-1 text-[var(--hg-subtle)]">({pct(value, total)})</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeriesLegend({
  keys,
  visible,
  onToggle,
}: {
  keys: SeriesKey[]
  visible: Set<SeriesKey>
  onToggle: (key: SeriesKey) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Series">
      {keys.map((key) => {
        const series = VOLUME_SERIES[key]
        const on = visible.has(key)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11px] font-medium transition-colors',
              on
                ? 'border-[var(--hg-border)] bg-white text-black'
                : 'border-transparent bg-transparent text-[var(--hg-subtle)] line-through opacity-60',
            )}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: on ? series.color : 'var(--hg-border)' }}
            />
            {series.label}
          </button>
        )
      })}
    </div>
  )
}

export function VolumeKpiStrip({ points }: { points: ChartPoint[] }) {
  const kpis = volumeKpis(points)
  const items = [
    { label: 'Peak', value: kpis.peakTotal.toLocaleString(), hint: kpis.peakLabel },
    { label: 'Hate share', value: `${kpis.hateShare}%`, hint: 'of posts in range' },
    { label: 'Avg / bucket', value: kpis.avgPerBucket.toLocaleString(), hint: 'mean volume' },
  ]
  return (
    <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--hg-border)] pb-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
            {item.label}
          </p>
          <p className="text-sm font-semibold tabular-nums text-[var(--hg-ink)]">{item.value}</p>
          <p className="truncate text-[10px] text-[var(--hg-muted)]">{item.hint}</p>
        </div>
      ))}
    </div>
  )
}

export function VolumeChart({ data, range, chartStyle = 'line' }: VolumeChartProps) {
  const formatted = useMemo(() => toChartPoints(data, range), [data, range])
  const interval = tickInterval(formatted.length, range)
  const legendKeys = chartStyle === 'stacked' ? STACK_KEYS : LINE_KEYS

  const [visible, setVisible] = useState<Set<SeriesKey>>(() => new Set(legendKeys))

  useEffect(() => {
    setVisible(new Set(chartStyle === 'stacked' ? STACK_KEYS : LINE_KEYS))
  }, [chartStyle])

  const toggle = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const tickStyle = { fontSize: 11, fill: '#5c6d84' }

  const shared = (
    <>
      <CartesianGrid
        strokeDasharray="0"
        stroke="#e8edf5"
        strokeOpacity={0.7}
        vertical={false}
      />
      <XAxis
        dataKey="label"
        tick={tickStyle}
        interval={interval}
        minTickGap={12}
        axisLine={false}
        tickLine={false}
        dy={6}
      />
      <YAxis
        tick={tickStyle}
        axisLine={false}
        tickLine={false}
        allowDecimals={false}
        width={36}
        dx={-4}
      />
      <Tooltip
        cursor={{ stroke: '#c4bff0', strokeWidth: 1, strokeDasharray: '4 4' }}
        content={<VolumeTooltip visible={visible} />}
      />
    </>
  )

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SeriesLegend keys={legendKeys} visible={visible} onToggle={toggle} />
      </div>
      <VolumeKpiStrip points={formatted} />
      <ResponsiveContainer width="100%" height={320}>
        {chartStyle === 'stacked' ? (
          <AreaChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="vol-normal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VOLUME_SERIES.normal_count.color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={VOLUME_SERIES.normal_count.color} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="vol-abuse" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VOLUME_SERIES.abuse_count.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={VOLUME_SERIES.abuse_count.color} stopOpacity={0.06} />
              </linearGradient>
              <linearGradient id="vol-hate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VOLUME_SERIES.hate_count.color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={VOLUME_SERIES.hate_count.color} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            {shared}
            {visible.has('normal_count') && (
              <Area
                type="monotone"
                dataKey="normal_count"
                stackId="1"
                stroke={VOLUME_SERIES.normal_count.color}
                strokeWidth={1.5}
                fill="url(#vol-normal)"
                name="Normal"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('abuse_count') && (
              <Area
                type="monotone"
                dataKey="abuse_count"
                stackId="1"
                stroke={VOLUME_SERIES.abuse_count.color}
                strokeWidth={1.5}
                fill="url(#vol-abuse)"
                name="Abuse"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('hate_count') && (
              <Area
                type="monotone"
                dataKey="hate_count"
                stackId="1"
                stroke={VOLUME_SERIES.hate_count.color}
                strokeWidth={1.5}
                fill="url(#vol-hate)"
                name="Hate"
                isAnimationActive
                animationDuration={280}
              />
            )}
          </AreaChart>
        ) : (
          <LineChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {shared}
            {visible.has('normal_count') && (
              <Line
                type="monotone"
                dataKey="normal_count"
                stroke={VOLUME_SERIES.normal_count.color}
                strokeWidth={1.5}
                strokeOpacity={0.85}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                name="Normal"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('abuse_count') && (
              <Line
                type="monotone"
                dataKey="abuse_count"
                stroke={VOLUME_SERIES.abuse_count.color}
                strokeWidth={1.5}
                strokeOpacity={0.9}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                name="Abuse"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('hate_count') && (
              <Line
                type="monotone"
                dataKey="hate_count"
                stroke={VOLUME_SERIES.hate_count.color}
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                name="Hate"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('total') && (
              <Line
                type="monotone"
                dataKey="total"
                stroke={VOLUME_SERIES.total.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: VOLUME_SERIES.total.color }}
                name="Total"
                isAnimationActive
                animationDuration={280}
              />
            )}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

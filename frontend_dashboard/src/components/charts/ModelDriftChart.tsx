import { useMemo, useState } from 'react'
import type { DriftDataPoint } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const DRIFT_SERIES = {
  normal_avg_confidence: { key: 'normal_avg_confidence', label: 'Normal', color: '#2f9e6b' },
  abuse_avg_confidence: { key: 'abuse_avg_confidence', label: 'Abuse', color: '#d4a017' },
  hate_avg_confidence: { key: 'hate_avg_confidence', label: 'Hate', color: '#c1002c' },
} as const

type SeriesKey = keyof typeof DRIFT_SERIES

const SERIES_KEYS: SeriesKey[] = [
  'normal_avg_confidence',
  'abuse_avg_confidence',
  'hate_avg_confidence',
]

type ChartPoint = {
  label: string
  tooltip: string
  normal_avg_confidence: number
  abuse_avg_confidence: number
  hate_avg_confidence: number
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function DriftTooltip({
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
  const rows = SERIES_KEYS.filter((key) => visible.has(key))

  return (
    <div className="min-w-[180px] rounded-[4px] border border-[var(--hg-border)] bg-white px-3.5 py-2.5 shadow-[var(--hg-shadow)]">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--hg-ink)]">{row.tooltip}</p>
      <div className="space-y-1.5">
        {rows.map((key) => {
          const series = DRIFT_SERIES[key]
          return (
            <div key={key} className="flex items-center justify-between gap-8">
              <span className="flex items-center gap-2 text-[11px] text-[var(--hg-muted)]">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: series.color }}
                />
                {series.label}
              </span>
              <span className="text-[11px] tabular-nums text-[var(--hg-ink)]">
                {formatPct(row[key])}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SeriesLegend({
  visible,
  onToggle,
}: {
  visible: Set<SeriesKey>
  onToggle: (key: SeriesKey) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Series">
      {SERIES_KEYS.map((key) => {
        const series = DRIFT_SERIES[key]
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

function DriftKpiStrip({ points }: { points: ChartPoint[] }) {
  if (!points.length) return null

  const latest = points[points.length - 1]
  const first = points[0]
  const hateDelta = latest.hate_avg_confidence - first.hate_avg_confidence
  const items = [
    {
      label: 'Hate (latest)',
      value: formatPct(latest.hate_avg_confidence),
      hint: latest.tooltip,
    },
    {
      label: 'Abuse (latest)',
      value: formatPct(latest.abuse_avg_confidence),
      hint: latest.tooltip,
    },
    {
      label: 'Hate Δ window',
      value: `${hateDelta >= 0 ? '+' : ''}${formatPct(hateDelta)}`,
      hint: `${first.tooltip} → ${latest.tooltip}`,
    },
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

interface ModelDriftChartProps {
  data: DriftDataPoint[]
}

export function ModelDriftChart({ data }: ModelDriftChartProps) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(() => new Set(SERIES_KEYS))

  const points = useMemo<ChartPoint[]>(
    () =>
      data.map((row) => ({
        label: formatDateLabel(row.date),
        tooltip: formatDateLabel(row.date),
        normal_avg_confidence: row.normal_avg_confidence,
        abuse_avg_confidence: row.abuse_avg_confidence,
        hate_avg_confidence: row.hate_avg_confidence,
      })),
    [data],
  )

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

  if (!points.length) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-1 rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)] text-center">
        <p className="text-sm font-medium text-[var(--hg-ink)]">No drift data yet</p>
        <p className="max-w-sm text-xs text-[var(--hg-muted)]">
          Confidence trends appear after enough predictions are logged for this language.
        </p>
      </div>
    )
  }

  const tickStyle = { fontSize: 11, fill: '#5c6d84' }
  const interval = Math.max(0, Math.floor(points.length / 10) - 1)

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SeriesLegend visible={visible} onToggle={toggle} />
        <p className="text-[11px] text-[var(--hg-muted)]">
          Avg class confidence over time · sustained drift may need retraining
        </p>
      </div>
      <DriftKpiStrip points={points} />
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            domain={[0.5, 1]}
            tick={tickStyle}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            axisLine={false}
            tickLine={false}
            width={40}
            dx={-4}
          />
          <Tooltip
            cursor={{ stroke: '#c4bff0', strokeWidth: 1, strokeDasharray: '4 4' }}
            content={<DriftTooltip visible={visible} />}
          />
          {SERIES_KEYS.map(
            (key) =>
              visible.has(key) && (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={DRIFT_SERIES[key].color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0 }}
                  name={DRIFT_SERIES[key].label}
                  isAnimationActive
                  animationDuration={280}
                />
              ),
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

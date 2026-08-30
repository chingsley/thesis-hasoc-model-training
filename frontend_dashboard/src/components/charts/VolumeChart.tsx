import type { VolumeDataPoint } from '@/lib/types'
import type { ChartStyle, ResolvedVolumeRange } from '@/lib/volume-range'
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
  Legend,
} from 'recharts'

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

function VolumeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const total = row.total || 1
  const rows = [
    { name: 'Normal', value: row.normal_count, color: '#22c55e' },
    { name: 'Abuse', value: row.abuse_count, color: '#f59e0b' },
    { name: 'Hate', value: row.hate_count, color: '#ef4444' },
    { name: 'Total', value: row.total, color: 'var(--primary)' },
  ]
  return (
    <div className="rounded-[8px] border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="mb-1.5 font-medium text-foreground">{row.tooltip}</p>
      <div className="space-y-1">
        {rows.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-full" style={{ background: item.color }} />
              {item.name}
            </span>
            <span className="tabular-nums text-foreground">
              {item.value.toLocaleString()}
              {item.name !== 'Total' && (
                <span className="ml-1 text-muted-foreground">({pct(item.value, total)})</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VolumeChart({ data, range, chartStyle = 'line' }: VolumeChartProps) {
  const formatted = toChartPoints(data, range)
  const interval = tickInterval(formatted.length, range)

  const axis = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 10 }}
        interval={interval}
        minTickGap={8}
        className="text-muted-foreground"
      />
      <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" allowDecimals={false} />
      <Tooltip content={<VolumeTooltip />} />
      <Legend />
    </>
  )

  if (chartStyle === 'stacked') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={formatted}>
          {axis}
          <Area
            type="monotone"
            dataKey="normal_count"
            stackId="1"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.35}
            name="Normal"
          />
          <Area
            type="monotone"
            dataKey="abuse_count"
            stackId="1"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.35}
            name="Abuse"
          />
          <Area
            type="monotone"
            dataKey="hate_count"
            stackId="1"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.4}
            name="Hate"
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted}>
        {axis}
        <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={false} name="Total" />
        <Line type="monotone" dataKey="normal_count" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Normal" />
        <Line type="monotone" dataKey="abuse_count" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Abuse" />
        <Line type="monotone" dataKey="hate_count" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Hate" />
      </LineChart>
    </ResponsiveContainer>
  )
}

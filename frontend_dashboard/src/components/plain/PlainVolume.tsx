import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatClassShare,
  toChartPoints,
  VOLUME_CHART_HEIGHT,
  VOLUME_SERIES,
  type ChartPoint,
} from '@/components/charts/VolumeChart'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { TechnicalName } from '@/components/ui/technical-name'
import { useVolume } from '@/hooks/use-volume'
import { LABEL_ORDER, PLAIN_LABELS, plural } from '@/lib/plain-language'
import { useThemeStore } from '@/lib/store/theme'
import { useVolumeSelectionStore } from '@/lib/store/volume-selection'
import { readCssVar } from '@/lib/theme/cssVar'
import { cn } from '@/lib/utils'
import { apportion, plainRangePhrase, plainVolumeUnit } from '@/lib/volume-plain'
import type { Label } from '@/lib/types'

const COUNT_KEY = {
  Normal: 'normal_count',
  Abuse: 'abuse_count',
  Hate: 'hate_count',
} as const satisfies Record<Label, keyof ChartPoint>

const PERIODS = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '1m', label: 'Last month' },
] as const

function PeriodButtons() {
  const mode = useVolumeSelectionStore((s) => s.mode)
  const setPreset = useVolumeSelectionStore((s) => s.setPreset)
  return (
    <div
      className="inline-flex flex-wrap items-center rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5"
      role="group"
      aria-label="Period"
    >
      {PERIODS.map((period) => {
        const active = mode === period.id
        return (
          <button
            key={period.id}
            type="button"
            aria-pressed={active}
            onClick={() => setPreset(period.id)}
            className={cn(
              'rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-white text-black shadow-sm'
                : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
            )}
          >
            {period.label}
          </button>
        )
      })}
    </div>
  )
}

function PlainTooltip({
  active,
  payload,
  colors,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
  colors: Record<Label, string>
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="min-w-[170px] rounded-[4px] border border-[var(--hg-border)] bg-white px-3.5 py-2.5 shadow-[var(--hg-shadow)]">
      <p className="text-xs font-semibold text-[var(--hg-ink)]">{point.tooltip}</p>
      <p className="mb-2 text-xs text-[var(--hg-muted)] tabular-nums">
        {point.total.toLocaleString()} {plural(point.total, 'post')} checked
      </p>
      <div className="space-y-1">
        {[...LABEL_ORDER].reverse().map((label) => (
          <div key={label} className="flex items-center justify-between gap-6 text-xs">
            <span className="flex items-center gap-2 text-[var(--hg-muted)]">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: colors[label] }}
              />
              {PLAIN_LABELS[label].name}
            </span>
            <span className="text-[var(--hg-ink)] tabular-nums">
              {point[COUNT_KEY[label]].toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Callout({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="space-y-2 rounded-[4px] border border-[var(--hg-border)] bg-white px-5 py-5 md:px-6">
      <p className="text-[13px] font-medium text-[var(--hg-muted)]">{title}</p>
      <p className="text-[1.75rem] leading-none font-bold tracking-tight text-[var(--hg-ink)] tabular-nums">
        {value}
      </p>
      <p className="text-xs leading-relaxed text-[var(--hg-subtle)]">{note}</p>
    </div>
  )
}

/** "Of every 10 posts": ten squares coloured in proportion to the three labels. */
function MixOfTen({ totals, colors }: { totals: Record<Label, number>; colors: Record<Label, string> }) {
  const order: Label[] = ['Normal', 'Abuse', 'Hate']
  const slots = apportion(
    order.map((label) => totals[label]),
    10,
  )
  const squares = order.flatMap((label, i) => Array.from({ length: slots[i] }, () => label))
  const sum = order.reduce((n, label) => n + totals[label], 0)
  return (
    <div className="space-y-2 rounded-[4px] border border-[var(--hg-border)] bg-white px-5 py-5 md:px-6">
      <p className="text-[13px] font-medium text-[var(--hg-muted)]">Of every 10 posts</p>
      <div
        className="flex gap-1"
        role="img"
        aria-label={order
          .map((label, i) => `about ${slots[i]} ${PLAIN_LABELS[label].lower}`)
          .join(', ')}
      >
        {squares.map((label, i) => (
          <span
            key={i}
            className="h-6 flex-1 rounded-[3px]"
            style={{ backgroundColor: colors[label] }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--hg-muted)]">
        {order.map((label) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-[2px]"
              style={{ backgroundColor: colors[label] }}
            />
            {PLAIN_LABELS[label].name}{' '}
            <span className="text-[var(--hg-ink)] tabular-nums">
              {formatClassShare(totals[label], sum)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Plain-language post volume: what share of posts carries each label, the busiest day, how
 * many posts need attention, and one stacked bar per day (per hour for a single day).
 */
export function PlainVolume({ embedded = false }: { embedded?: boolean }) {
  const { language, mode, range, data, isLoading } = useVolume()
  const themeId = useThemeStore((s) => s.themeId)
  const unit = plainVolumeUnit(range)

  const points = useMemo(
    () => (data ? toChartPoints(data, { ...range, aggregate: unit }) : []),
    [data, range, unit],
  )
  const colors = useMemo<Record<Label, string>>(
    () => ({
      Normal: VOLUME_SERIES.normal_count.color,
      Abuse: VOLUME_SERIES.abuse_count.color,
      Hate: readCssVar('--hg-matrix-error', VOLUME_SERIES.hate_count.color),
    }),
    // Re-read the CSS variable when the colour theme changes.
    [themeId],
  )

  const totals: Record<Label, number> = { Normal: 0, Abuse: 0, Hate: 0 }
  let total = 0
  let busiestIndex = -1
  points.forEach((point, index) => {
    totals.Normal += point.normal_count
    totals.Abuse += point.abuse_count
    totals.Hate += point.hate_count
    total += point.total
    if (busiestIndex === -1 || point.total > points[busiestIndex].total) busiestIndex = index
  })
  const busiest = busiestIndex >= 0 ? points[busiestIndex] : null
  const chartData = points.map((point, index) => ({
    ...point,
    busiestTotal: index === busiestIndex ? point.total : undefined,
  }))
  const hasData = total > 0
  const phrase = plainRangePhrase(mode, range)
  const languageName = language.charAt(0).toUpperCase() + language.slice(1)
  const description = `${languageName} posts HateGuard checked ${phrase}, one bar per ${unit} (${
    unit === 'hour' ? 'times' : 'days'
  } in UTC).`

  const body =
    isLoading && !data ? (
      <div className="flex items-center justify-center" style={{ height: VOLUME_CHART_HEIGHT }}>
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hg-subtle)]" />
      </div>
    ) : !hasData ? (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)] text-center"
        style={{ height: VOLUME_CHART_HEIGHT }}
      >
        <p className="text-sm font-medium text-[var(--hg-ink)]">No posts in this window</p>
        <p className="max-w-sm text-xs text-[var(--hg-muted)]">
          Try a wider range, switch language, or classify posts under Classify Posts.
        </p>
      </div>
    ) : (
      <div className="animate-in fade-in space-y-5 duration-300">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MixOfTen totals={totals} colors={colors} />
          <Callout
            title={`Busiest ${unit}`}
            value={busiest ? busiest.tooltip : '—'}
            note={
              busiest
                ? `${busiest.total.toLocaleString()} ${plural(busiest.total, 'post')} checked, the most in this period.`
                : ''
            }
          />
          <Callout
            title="Posts needing attention"
            value={(totals.Hate + totals.Abuse).toLocaleString()}
            note={`${totals.Hate.toLocaleString()} hateful and ${totals.Abuse.toLocaleString()} abusive, out of ${total.toLocaleString()} ${plural(total, 'post')} checked.`}
          />
        </div>

        <div>
          <ResponsiveContainer width="100%" height={VOLUME_CHART_HEIGHT}>
            <ComposedChart data={chartData} margin={{ top: 22, right: 8, left: 2, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="0" stroke="var(--hg-border)" strokeOpacity={0.7} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--hg-subtle)' }}
                minTickGap={16}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--hg-subtle)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={48}
                tickMargin={4}
              />
              <Tooltip cursor={{ fill: 'rgba(98, 88, 133, 0.08)' }} content={<PlainTooltip colors={colors} />} />
              {LABEL_ORDER.map((label) => (
                <Bar
                  key={label}
                  dataKey={COUNT_KEY[label]}
                  name={PLAIN_LABELS[label].name}
                  stackId="posts"
                  fill={colors[label]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              ))}
              {/* One point at the top of the busiest bar, drawn as the word "Busiest". */}
              <Scatter
                dataKey="busiestTotal"
                isAnimationActive={false}
                tooltipType="none"
                shape={(props: { cx?: number; cy?: number }) =>
                  props.cx == null || props.cy == null ? (
                    <g />
                  ) : (
                    <text
                      x={props.cx}
                      y={props.cy - 7}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill="var(--hg-ink)"
                    >
                      Busiest
                    </text>
                  )
                }
              />
            </ComposedChart>
          </ResponsiveContainer>
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--hg-muted)]">
            {[...LABEL_ORDER].reverse().map((label) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: colors[label] }}
                />
                {PLAIN_LABELS[label].name}
              </li>
            ))}
            <li className="text-[var(--hg-subtle)]">Point at a bar to see its numbers.</li>
          </ul>
        </div>
      </div>
    )

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--hg-muted)]">{description}</p>
          <PeriodButtons />
        </div>
        {body}
      </div>
    )
  }

  return (
    <Card className="gap-0">
      <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-2 [.border-b]:pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
          <SectionTitle size="md" description={description}>
            <span className="inline-flex items-center">
              Posts checked over time
              <span
                aria-hidden
                className="mx-4 inline-block h-[0.85em] w-[3px] shrink-0 rounded-full bg-[var(--hg-border)]"
              />
              <span className="text-base font-normal tracking-wide text-[var(--hg-brand)] uppercase">
                {languageName}
              </span>
            </span>
          </SectionTitle>
          <TechnicalName>Post volume over time</TechnicalName>
          </div>
          <PeriodButtons />
        </div>
      </CardHeader>
      <CardContent className="pt-4">{body}</CardContent>
    </Card>
  )
}

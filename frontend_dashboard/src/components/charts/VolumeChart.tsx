import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { VolumeDataPoint } from '@/lib/types';
import type { ChartStyle, ResolvedVolumeRange } from '@/lib/volume-range';
import { useThemeStore } from '@/lib/store/theme';
import { readCssVar } from '@/lib/theme/cssVar';
import { cn } from '@/lib/utils';
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
} from 'recharts';

/** Recharts plot height (2/3 of original 320px — denser card without changing axis domain). */
export const VOLUME_CHART_HEIGHT = 214;

const VOLUME_CHART_MARGIN = { top: 8, right: 8, left: 2, bottom: 0 };

/** Brand series — Normal vs Hate kept clearly distinct */
export const VOLUME_SERIES = {
  total: { key: 'total', label: 'Total', color: '#625885' },
  normal_count: { key: 'normal_count', label: 'Normal', color: '#2f9e6b' },
  abuse_count: { key: 'abuse_count', label: 'Abuse', color: '#d4a017' },
  hate_count: { key: 'hate_count', label: 'Hate', color: '#c1002c' },
} as const;

type SeriesKey = keyof typeof VOLUME_SERIES;

function resolveVolumeSeries() {
  return {
    ...VOLUME_SERIES,
    total: {
      ...VOLUME_SERIES.total,
      color: readCssVar('--chart-1', VOLUME_SERIES.total.color),
    },
    hate_count: {
      ...VOLUME_SERIES.hate_count,
      // Semantic hate/error red — not --hg-secondary (brand navy on several themes).
      color: readCssVar('--hg-matrix-error', VOLUME_SERIES.hate_count.color),
    },
  };
}

interface VolumeChartProps {
  data: VolumeDataPoint[];
  range: ResolvedVolumeRange;
  chartStyle?: ChartStyle;
  /** Shown under chart controls (embedded Analysis tab). */
  description?: string;
  toolbar?: ReactNode;
  kpiAlign?: 'start' | 'end';
}

export type ChartPoint = {
  label: string;
  tooltip: string;
  normal_count: number;
  abuse_count: number;
  hate_count: number;
  total: number;
};

function parseBucket(iso: string): Date {
  const cleaned = iso.replace(/^\[MOCK\]\s*/i, '');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleaned)) {
    return new Date(`${cleaned}:00Z`);
  }
  return new Date(cleaned);
}

function formatHourLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDayTimeLabel(d: Date): string {
  return `${formatDayLabel(d)} ${formatHourLabel(d)}`;
}

export function toChartPoints(data: VolumeDataPoint[], range: ResolvedVolumeRange): ChartPoint[] {
  if (range.aggregate === 'day') {
    const byDay = new Map<string, ChartPoint>();
    for (const point of data) {
      const d = parseBucket(point.hour);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = d.toISOString().slice(0, 10);
      const existing = byDay.get(dayKey);
      if (existing) {
        existing.normal_count += point.normal_count;
        existing.abuse_count += point.abuse_count;
        existing.hate_count += point.hate_count;
        existing.total += point.total;
      } else {
        byDay.set(dayKey, {
          label: formatDayLabel(d),
          tooltip: formatDayLabel(d),
          normal_count: point.normal_count,
          abuse_count: point.abuse_count,
          hate_count: point.hate_count,
          total: point.total,
        });
      }
    }
    return [...byDay.values()];
  }

  return data.map((point) => {
    const d = parseBucket(point.hour);
    const valid = !Number.isNaN(d.getTime());
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
    };
  });
}

/** Share of posts in range — avoids misleading 0% / 100% when counts do not match. */
export function formatClassShare(part: number, total: number): string {
  if (total <= 0 || part <= 0) return '0%';
  if (part >= total) return '100%';
  const pct = (part / total) * 100;
  const rounded = Math.round(pct);
  if (rounded === 100) return `${pct.toFixed(2)}%`;
  if (rounded === 0) {
    if (pct >= 0.01) return `${pct.toFixed(2)}%`;
    return '<0.01%';
  }
  if (pct >= 10) return `${rounded}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

export function volumeKpis(points: ChartPoint[]) {
  if (!points.length) {
    return {
      peakLabel: '—',
      peakTotal: 0,
      hateShare: '0%',
      abuseShare: '0%',
    };
  }
  let peak = points[0];
  let sum = 0;
  let hate = 0;
  let abuse = 0;
  for (const p of points) {
    sum += p.total;
    hate += p.hate_count;
    abuse += p.abuse_count;
    if (p.total > peak.total) peak = p;
  }
  return {
    peakLabel: peak.tooltip,
    peakTotal: peak.total,
    hateShare: formatClassShare(hate, sum),
    abuseShare: formatClassShare(abuse, sum),
  };
}

function tickInterval(pointCount: number, range: ResolvedVolumeRange): number {
  if (range.aggregate === 'day') {
    if (range.hours >= 2160) return Math.max(0, Math.floor(pointCount / 8) - 1);
    return Math.max(0, Math.floor(pointCount / 10) - 1);
  }
  if (range.hours <= 24) return 2;
  return Math.max(0, Math.floor(pointCount / 12) - 1);
}

function pct(part: number, total: number): string {
  return formatClassShare(part, total);
}

const LINE_KEYS: SeriesKey[] = ['total', 'normal_count', 'abuse_count', 'hate_count'];
const STACK_KEYS: SeriesKey[] = ['normal_count', 'abuse_count', 'hate_count'];

function sumSeries(points: ChartPoint[], key: SeriesKey): number {
  return points.reduce((acc, p) => acc + p[key], 0);
}

/** Top stacked layer that has data — its stroke defines the stack outline (not zero-height hate). */
function topStackLayer(visible: Set<SeriesKey>, points: ChartPoint[]): SeriesKey | null {
  for (let i = STACK_KEYS.length - 1; i >= 0; i--) {
    const key = STACK_KEYS[i];
    if (!visible.has(key) || sumSeries(points, key) <= 0) continue;
    return key;
  }
  return null;
}

function VolumeTooltip({
  active,
  payload,
  visible,
  series,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint; }>;
  visible: Set<SeriesKey>;
  series: ReturnType<typeof resolveVolumeSeries>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const total = row.total || 1;
  const rows = (
    [
      ['normal_count', row.normal_count],
      ['abuse_count', row.abuse_count],
      ['hate_count', row.hate_count],
      ['total', row.total],
    ] as const
  ).filter(([key]) => visible.has(key));

  return (
    <div className="min-w-[180px] rounded-[4px] border border-[var(--hg-border)] bg-white px-3.5 py-2.5 shadow-[var(--hg-shadow)]">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--hg-ink)]">{row.tooltip}</p>
      <div className="space-y-1.5">
        {rows.map(([key, value]) => {
          const meta = series[key];
          const isTotal = key === 'total';
          return (
            <div key={key} className="flex items-center justify-between gap-8">
              <span className="flex items-center gap-2 text-[11px] text-[var(--hg-muted)]">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: meta.color }}
                />
                {meta.label}
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
          );
        })}
      </div>
    </div>
  );
}

function SeriesLegend({
  keys,
  visible,
  onToggle,
  series,
}: {
  keys: SeriesKey[];
  visible: Set<SeriesKey>;
  onToggle: (key: SeriesKey) => void;
  series: ReturnType<typeof resolveVolumeSeries>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Series">
      {keys.map((key) => {
        const meta = series[key];
        const on = visible.has(key);
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
              style={{ background: on ? meta.color : 'var(--hg-border)' }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

export function VolumeKpiStrip({
  points,
  className,
  align = 'start',
}: {
  points: ChartPoint[];
  className?: string;
  align?: 'start' | 'end';
}) {
  const kpis = volumeKpis(points);
  const items = [
    { label: 'Peak', value: kpis.peakTotal.toLocaleString(), hint: kpis.peakLabel },
    { label: 'Abuse share', value: kpis.abuseShare, hint: 'of posts in range' },
    { label: 'Hate share', value: kpis.hateShare, hint: 'of posts in range' },
  ];
  return (
    <div
      className={cn(
        'flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--hg-border)] pb-3',
        align === 'end' && 'justify-end text-right',
        className,
      )}
    >
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
  );
}

export function VolumeChart({
  data,
  range,
  chartStyle = 'line',
  description,
  toolbar,
  kpiAlign = 'start',
}: VolumeChartProps) {
  const themeId = useThemeStore((s) => s.themeId);
  const series = useMemo(() => resolveVolumeSeries(), [themeId]);
  const formatted = useMemo(() => toChartPoints(data, range), [data, range]);
  const interval = tickInterval(formatted.length, range);
  const legendKeys = LINE_KEYS;

  const [visible, setVisible] = useState<Set<SeriesKey>>(() => new Set(legendKeys));

  useEffect(() => {
    setVisible(new Set(LINE_KEYS));
  }, [chartStyle]);

  const topStack = chartStyle === 'stacked' ? topStackLayer(visible, formatted) : null;

  const toggle = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const tickStyle = { fontSize: 11, fill: '#5c6d84' };

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
        width={48}
        tickMargin={4}
      />
      <Tooltip
        cursor={{ stroke: '#c4bff0', strokeWidth: 1, strokeDasharray: '4 4' }}
        content={<VolumeTooltip visible={visible} series={series} />}
      />
    </>
  );

  return (
    <div className="animate-in fade-in duration-300">
      {toolbar ? (
        <div
          className={cn(
            'mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-[var(--hg-border)] pb-3',
          )}
        >
          <VolumeKpiStrip
            points={formatted}
            className="mb-0 min-w-0 flex-1 border-b-0 pb-0"
            align={kpiAlign}
          />
          <div className="flex shrink-0 flex-col items-end gap-2">
            {toolbar}
            <SeriesLegend
              keys={legendKeys}
              visible={visible}
              onToggle={toggle}
              series={series}
            />
            {description ? (
              <p className="text-right text-xs text-[var(--hg-muted)]">{description}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <SeriesLegend
              keys={legendKeys}
              visible={visible}
              onToggle={toggle}
              series={series}
            />
          </div>
          <VolumeKpiStrip points={formatted} className="mb-4" align={kpiAlign} />
        </>
      )}
      <ResponsiveContainer width="100%" height={VOLUME_CHART_HEIGHT}>
        {chartStyle === 'stacked' ? (
          <AreaChart data={formatted} margin={VOLUME_CHART_MARGIN}>
            <defs>
              <linearGradient id="vol-normal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.normal_count.color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={series.normal_count.color} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="vol-abuse" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.abuse_count.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={series.abuse_count.color} stopOpacity={0.06} />
              </linearGradient>
              <linearGradient id="vol-hate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.hate_count.color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={series.hate_count.color} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            {shared}
            {visible.has('normal_count') && sumSeries(formatted, 'normal_count') > 0 && (
              <Area
                type="monotone"
                dataKey="normal_count"
                stackId="1"
                stroke={series.normal_count.color}
                strokeWidth={topStack === 'normal_count' ? 1.5 : 0}
                fill="url(#vol-normal)"
                name="Normal"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('abuse_count') && sumSeries(formatted, 'abuse_count') > 0 && (
              <Area
                type="monotone"
                dataKey="abuse_count"
                stackId="1"
                stroke={series.abuse_count.color}
                strokeWidth={topStack === 'abuse_count' ? 1.5 : 0}
                fill="url(#vol-abuse)"
                name="Abuse"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('hate_count') && sumSeries(formatted, 'hate_count') > 0 && (
              <Area
                type="monotone"
                dataKey="hate_count"
                stackId="1"
                stroke={series.hate_count.color}
                strokeWidth={topStack === 'hate_count' ? 1.5 : 0}
                fill="url(#vol-hate)"
                name="Hate"
                isAnimationActive
                animationDuration={280}
              />
            )}
            {visible.has('total') && (
              <Line
                type="monotone"
                dataKey="total"
                stroke={series.total.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: series.total.color }}
                name="Total"
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        ) : (
          <LineChart data={formatted} margin={VOLUME_CHART_MARGIN}>
            {shared}
            {visible.has('normal_count') && (
              <Line
                type="monotone"
                dataKey="normal_count"
                stroke={series.normal_count.color}
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
                stroke={series.abuse_count.color}
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
                stroke={series.hate_count.color}
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
                stroke={series.total.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: series.total.color }}
                name="Total"
                isAnimationActive
                animationDuration={280}
              />
            )}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

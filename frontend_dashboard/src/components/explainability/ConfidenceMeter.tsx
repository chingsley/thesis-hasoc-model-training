import type { ExplanationPayload } from '@/lib/types'
import { Info } from 'lucide-react'
import { Popover } from '@base-ui/react/popover'
import { cn } from '@/lib/utils'

interface ConfidenceMeterProps {
  /** Partial metrics are fine — missing values render as loading or unavailable. */
  metrics: ExplanationPayload['metrics']
  /** True while any explanation method request that can fill these tiles is still in flight. */
  loading?: boolean
}

const METRIC_HELP = [
  {
    label: 'Cross-Method Agreement',
    body: 'Mean pairwise Jaccard overlap of each method’s top tokens. Higher means LIME, SHAP, attention, and integrated gradients agree on the salient words.',
    threshold: '≥ 50%',
  },
  {
    label: 'LIME Fidelity (AOPC)',
    body: 'How much predicted-class probability drops when the top attributed tokens are removed. Higher means the explanation points at tokens the model actually relies on.',
    threshold: '≥ 0.40',
  },
  {
    label: 'LIME Stability (Jaccard)',
    body: 'Overlap of LIME’s top tokens across two runs on the same text. Higher means the explanation is less noisy and more repeatable.',
    threshold: '≥ 70%',
  },
] as const

type MetricItem = {
  label: string
  shortLabel: string
  value: number | undefined
  format: (v: number) => string
  /** Absolute scale used for the bar (value mapped 0→1 against this). */
  scaleMax: number
  threshold: number
  /** Threshold position on the absolute scale, 0–1. */
  thresholdRatio: number
}

function ConfidenceHelp() {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        openOnHover
        delay={150}
        closeDelay={100}
        aria-label="About explanation confidence"
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-[4px] transition-colors',
          'text-[var(--hg-subtle)] hover:bg-white hover:text-[var(--hg-ink)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30',
          'data-popup-open:bg-white data-popup-open:text-[var(--hg-ink)]',
        )}
      >
        <Info className="size-3.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup
            className={cn(
              'w-[340px] origin-(--transform-origin) rounded-[4px] border border-[var(--hg-border)] bg-white p-4 shadow-[var(--hg-shadow)] outline-none',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            )}
          >
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--hg-brand)]" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[var(--hg-ink)]">Explanation Confidence</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--hg-muted)]">
                  How much to trust the highlighted tokens for this post. Passing status means
                  agreement and fidelity clear their thresholds; review needed means at least one is
                  missing or below target.
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-3 border-t border-[var(--hg-border)] pt-3">
              {METRIC_HELP.map((metric) => (
                <li key={metric.label} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--hg-ink)]">{metric.label}</p>
                    <span className="shrink-0 text-[10px] font-medium text-[var(--hg-subtle)]">
                      Target {metric.threshold}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--hg-muted)]">{metric.body}</p>
                </li>
              ))}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function MetricTile({ item, loading }: { item: MetricItem; loading: boolean }) {
  if (item.value === undefined) {
    if (loading) {
      return (
        <div className="animate-pulse space-y-3 px-4 py-3 sm:px-5">
          <div className="h-3 w-24 rounded bg-[var(--hg-border)]" />
          <div className="h-7 w-16 rounded bg-[var(--hg-border)]" />
          <div className="h-1.5 w-full rounded-full bg-[var(--hg-border)]" />
        </div>
      )
    }
    return (
      <div className="space-y-2 px-4 py-3 sm:px-5">
        <p className="text-[11px] font-medium tracking-wide text-[var(--hg-muted)] uppercase">
          {item.shortLabel}
        </p>
        <p className="text-sm font-medium text-[var(--hg-subtle)]">Unavailable</p>
      </div>
    )
  }

  const isGood = item.value >= item.threshold
  const fill = Math.min(1, Math.max(0, item.value / item.scaleMax))

  return (
    <div className="space-y-3 px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-[var(--hg-muted)] uppercase">
          {item.shortLabel}
        </p>
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            isGood ? 'bg-emerald-500' : 'bg-amber-500',
          )}
          aria-label={isGood ? 'Above target' : 'Below target'}
        />
      </div>
      <p
        className={cn(
          'text-[22px] leading-none font-semibold tracking-tight tabular-nums',
          isGood ? 'text-[var(--hg-ink)]' : 'text-amber-700',
        )}
      >
        {item.format(item.value)}
      </p>
      <div className="relative h-1 overflow-hidden rounded-full bg-white">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
            isGood ? 'bg-emerald-500' : 'bg-amber-500',
          )}
          style={{ width: `${fill * 100}%` }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--hg-ink)]/25"
          style={{ left: `${item.thresholdRatio * 100}%` }}
          title={`Target ${item.format(item.threshold)}`}
        />
      </div>
    </div>
  )
}

export function ConfidenceMeter({ metrics, loading = false }: ConfidenceMeterProps) {
  const items: MetricItem[] = [
    {
      label: 'Cross-Method Agreement',
      shortLabel: 'Agreement',
      value: metrics.cross_method_agreement_mean,
      format: (v) => `${Math.round(v * 100)}%`,
      scaleMax: 1,
      threshold: 0.5,
      thresholdRatio: 0.5,
    },
    {
      label: 'LIME Fidelity (AOPC)',
      shortLabel: 'Fidelity',
      value: metrics.lime_faithfulness_aopc_proxy,
      format: (v) => v.toFixed(3),
      scaleMax: 1,
      threshold: 0.4,
      thresholdRatio: 0.4,
    },
    {
      label: 'LIME Stability (Jaccard)',
      shortLabel: 'Stability',
      value: metrics.lime_stability_jaccard,
      format: (v) => `${Math.round(v * 100)}%`,
      scaleMax: 1,
      threshold: 0.7,
      thresholdRatio: 0.7,
    },
  ]

  const agreement = metrics.cross_method_agreement_mean
  const fidelity = metrics.lime_faithfulness_aopc_proxy
  const settled = agreement !== undefined && fidelity !== undefined
  const headerGood = settled && agreement >= 0.5 && fidelity >= 0.4

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
            Explanation Confidence
          </h3>
          <ConfidenceHelp />
        </div>
        {settled ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[11px] font-semibold',
              headerGood
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                headerGood ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
            {headerGood ? 'Passing' : 'Needs review'}
          </span>
        ) : loading ? (
          <span className="text-[11px] font-medium text-[var(--hg-subtle)]">Computing…</span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--hg-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {items.map((item) => (
            <MetricTile key={item.label} item={item} loading={loading} />
          ))}
        </div>
      </div>
    </section>
  )
}

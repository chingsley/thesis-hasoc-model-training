import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { DotGrid } from './DotGrid'
import { useDashboardStore } from '@/lib/store/dashboard'
import { outcomeRows, weakestLabel } from '@/lib/performance-summary'
import { LABEL_ORDER, PLAIN_LABELS, exactPercent, outOf100, plural } from '@/lib/plain-language'
import { cn } from '@/lib/utils'
import type { ModelMetrics } from '@/lib/types'

function languageName(language: string): string {
  return language.charAt(0).toUpperCase() + language.slice(1)
}

/** "HateGuard gets about N of every 100 posts right", with a 100-dot picture. */
export function AccuracyHeadline({ metrics }: { metrics: ModelMetrics }) {
  const language = useDashboardStore((s) => s.language)
  const right = outOf100(metrics.accuracy)
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <DotGrid
        filled={right}
        color="var(--hg-brand)"
        shape="strip"
        label={`${right} of 100 dots filled: posts HateGuard labels correctly`}
        className="shrink-0"
      />
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
          HateGuard gets about <strong className="tabular-nums">{right}</strong> of every 100 posts
          right.
        </p>
        <p className="text-sm leading-relaxed text-[var(--hg-muted)]">
          Measured on {metrics.support.toLocaleString()} {languageName(language)}{' '}
          {plural(metrics.support, 'post')} it had not seen before, each already labelled by people (
          {exactPercent(metrics.accuracy)} labelled correctly).
        </p>
      </div>
    </div>
  )
}

/** One bar per true label, showing what HateGuard called those test posts. */
export function OutcomeBars({ metrics }: { metrics: ModelMetrics }) {
  const rows = outcomeRows(metrics.confusion_matrix)
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
      {rows.map((row) => {
        const actual = PLAIN_LABELS[row.actual]
        return (
          <div key={row.actual} className="min-w-0 space-y-2.5">
            <p className="text-sm text-[var(--hg-ink)]">
              Of <strong className="tabular-nums">{row.total.toLocaleString()}</strong> truly{' '}
              <strong>{actual.lower}</strong> {plural(row.total, 'post')}, HateGuard called:
            </p>
            <div
              className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--hg-canvas)]"
              role="img"
              aria-label={row.segments
                .map((s) => `${s.count} ${PLAIN_LABELS[s.predicted].lower}`)
                .join(', ')}
            >
              {row.segments
                .filter((segment) => segment.count > 0)
                .map((segment) => (
                  <span
                    key={segment.predicted}
                    className="h-full min-w-[3px]"
                    style={{
                      flexGrow: segment.count,
                      flexBasis: 0,
                      backgroundColor: PLAIN_LABELS[segment.predicted].color,
                      opacity: segment.correct ? 1 : 0.55,
                    }}
                  />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--hg-muted)] lg:flex-col lg:gap-1.5">
              {row.segments.map((segment) => (
                <li key={segment.predicted} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor: PLAIN_LABELS[segment.predicted].color,
                      opacity: segment.correct ? 1 : 0.55,
                    }}
                  />
                  <span className={segment.correct ? 'font-semibold text-[var(--hg-ink)]' : undefined}>
                    <span className="tabular-nums">{segment.count.toLocaleString()}</span>{' '}
                    {PLAIN_LABELS[segment.predicted].lower}
                  </span>
                  {segment.correct ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" aria-hidden />
                      <span className="sr-only">(correct)</span>
                    </>
                  ) : (
                    <span className="text-xs">(mistake)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/** One card per label answering "how many does it find?" and "how often is it right?". */
export function LabelScoreCards({ metrics }: { metrics: ModelMetrics }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-[var(--hg-border)] rounded-[4px] border border-[var(--hg-border)] lg:grid-cols-3 lg:divide-y-0">
      {LABEL_ORDER.map((label, index) => {
        const scores = metrics.per_class?.[label]
        if (!scores) return null
        const info = PLAIN_LABELS[label]
        const found = outOf100(scores.recall)
        const right = outOf100(scores.precision)
        return (
          <article
            key={label}
            className={cn(
              'space-y-4 px-4 py-4 sm:px-5',
              index > 0 && 'lg:border-l lg:border-[var(--hg-border)]',
            )}
          >
            <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--hg-ink)]">
              <span
                aria-hidden
                className="size-2.5 rounded-[2px]"
                style={{ backgroundColor: info.color }}
              />
              {info.name} posts
            </h4>
            <div className="flex items-start gap-4 lg:flex-col lg:gap-3">
              <DotGrid
                filled={found}
                color={info.color}
                label={`${found} of 100 dots filled`}
                className="shrink-0"
              />
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-medium text-[var(--hg-muted)]">How many it finds (Recall)</p>
                <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
                  Of every 100 {info.lower} posts, HateGuard finds about{' '}
                  <strong className="tabular-nums">{found}</strong>.
                </p>
                <p className="text-xs text-[var(--hg-muted)] tabular-nums">
                  Exactly {exactPercent(scores.recall)} of {scores.support.toLocaleString()} test{' '}
                  {plural(scores.support, 'post')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 border-t border-[var(--hg-border)] pt-4 lg:flex-col lg:gap-3">
              <DotGrid
                filled={right}
                color={info.color}
                label={`${right} of 100 dots filled`}
                className="shrink-0"
              />
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-medium text-[var(--hg-muted)]">How often it is right (Precision)</p>
                <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
                  When HateGuard says a post is {info.lower}, it is right about{' '}
                  <strong className="tabular-nums">{right}</strong> times in 100.
                </p>
                <p className="text-xs text-[var(--hg-muted)] tabular-nums">
                  Exactly {exactPercent(scores.precision)}
                </p>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

/** Compact version for the Overview page: the headline, the weakest point, and a link. */
export function PlainPerformanceSummary({ metrics }: { metrics: ModelMetrics }) {
  const weakest = weakestLabel(metrics)
  return (
    <div className="space-y-4">
      <AccuracyHeadline metrics={metrics} />
      {weakest ? (
        <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
          {weakest.recall < 0.7 ? (
            <>
              <strong>Weakest point:</strong> it finds only about {outOf100(weakest.recall)} of every
              100 {PLAIN_LABELS[weakest.label].lower} posts, so check posts yourself before acting.
            </>
          ) : (
            <>
              It finds about {outOf100(weakest.recall)} or more of every 100 posts for each label,
              but it still makes mistakes, so check posts yourself before acting.
            </>
          )}
        </p>
      ) : null}
      <Link
        to="/performance"
        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--hg-brand)] hover:underline"
      >
        See how it does on each kind of post
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  )
}

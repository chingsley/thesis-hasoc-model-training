import type { ExplanationPayload } from '@/lib/types'
import { ExplanationPanel } from './ExplanationPanel'
import type { XaiMethod } from '@/lib/types'

interface ExplanationComparisonProps {
  explanation: ExplanationPayload
  /** Methods whose requests are still in flight — rendered as skeletons. */
  loadingMethods?: XaiMethod[]
}

const methods: XaiMethod[] = ['lime', 'shap', 'attention_rollout', 'integrated_gradients']

const methodLabels: Record<XaiMethod, string> = {
  lime: 'LIME',
  shap: 'SHAP',
  attention_rollout: 'Attention Rollout',
  integrated_gradients: 'Integrated Gradients',
}

function AttributionLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--hg-muted)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-[rgba(239,68,68,0.55)]" aria-hidden />
        Toward prediction
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-[rgba(59,130,246,0.55)]" aria-hidden />
        Against prediction
      </span>
    </div>
  )
}

function ExplanationSkeleton({ method }: { method: XaiMethod }) {
  return (
    <article className="flex min-h-[148px] flex-col overflow-hidden rounded-[4px] border border-[var(--hg-border)] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--hg-border)] px-4 py-2.5">
        <h4 className="text-sm font-semibold text-[var(--hg-ink)]">{methodLabels[method]}</h4>
        <span className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
          Computing
        </span>
      </header>
      <div className="space-y-2.5 px-4 py-3.5" aria-label={`${methodLabels[method]} loading`}>
        <div className="h-3.5 w-full animate-pulse rounded bg-[var(--hg-canvas)]" />
        <div className="h-3.5 w-5/6 animate-pulse rounded bg-[var(--hg-canvas)]" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-[var(--hg-canvas)]" />
      </div>
    </article>
  )
}

export function ExplanationComparison({
  explanation,
  loadingMethods = [],
}: ExplanationComparisonProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
          Method Comparison
        </h3>
        <AttributionLegend />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {methods.map((method) =>
          !explanation.methods[method] && loadingMethods.includes(method) ? (
            <ExplanationSkeleton key={method} method={method} />
          ) : (
            <ExplanationPanel
              key={method}
              method={method}
              explanation={explanation.methods[method]}
            />
          ),
        )}
      </div>
    </section>
  )
}

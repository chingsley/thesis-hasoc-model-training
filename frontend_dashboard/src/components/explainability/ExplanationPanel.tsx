import type { ReactNode } from 'react'
import type { TokenExplanation, LimeExplanation, XaiMethod } from '@/lib/types'
import { ToxicTextHighlighter } from './ToxicTextHighlighter'

interface ExplanationPanelProps {
  method: XaiMethod
  explanation: TokenExplanation | LimeExplanation | { method: string; error: string } | undefined
}

const methodLabels: Record<XaiMethod, string> = {
  lime: 'LIME',
  shap: 'SHAP',
  attention_rollout: 'Attention Rollout',
  integrated_gradients: 'Integrated Gradients',
}

const methodMeta: Record<XaiMethod, { hint: string }> = {
  lime: {
    hint: 'Feature weights',
  },
  shap: {
    hint: 'Token attribution',
  },
  attention_rollout: {
    hint: 'Attention flow',
  },
  integrated_gradients: {
    hint: 'Gradient path',
  },
}

function PanelShell({
  method,
  children,
}: {
  method: XaiMethod
  children: ReactNode
}) {
  const meta = methodMeta[method]
  return (
    <article className="flex min-h-[148px] flex-col overflow-hidden rounded-[4px] border border-[var(--hg-border)] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--hg-border)] px-4 py-2.5">
        <h4 className="truncate text-sm font-semibold text-[var(--hg-ink)]">
          {methodLabels[method]}
        </h4>
        <span className="shrink-0 text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
          {meta.hint}
        </span>
      </header>
      <div className="min-w-0 flex-1 px-4 py-3.5">{children}</div>
    </article>
  )
}

export function ExplanationPanel({ method, explanation }: ExplanationPanelProps) {
  if (!explanation) {
    return (
      <PanelShell method={method}>
        <p className="text-xs text-[var(--hg-muted)]">No explanation available</p>
      </PanelShell>
    )
  }

  if ('error' in explanation) {
    return (
      <PanelShell method={method}>
        <p className="text-xs leading-relaxed text-[var(--hg-secondary)]">{explanation.error}</p>
      </PanelShell>
    )
  }

  const rawScores: unknown[] = (explanation as LimeExplanation).scores ?? []

  let tokens: string[] = []
  let scores: { token: string; score: number }[] = []
  let asFeatures = false

  if (rawScores.length > 0 && Array.isArray(rawScores[0])) {
    // LIME as_list(): unordered (token, weight) pairs — not a full token sequence.
    asFeatures = true
    tokens = (rawScores as [string, number][]).map((s) => s[0])
    scores = (rawScores as [string, number][]).map(([t, s]) => ({ token: t, score: s }))
  } else {
    const objScores = rawScores as { token: string; score: number }[]
    scores = objScores
    tokens = 'tokens' in explanation ? explanation.tokens : objScores.map((s) => s.token)
  }

  return (
    <PanelShell method={method}>
      <ToxicTextHighlighter tokens={tokens} scores={scores} asFeatures={asFeatures} />
    </PanelShell>
  )
}

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge, labelBadgeVariant } from '@/components/ui/badge'
import { ToxicTextHighlighter } from '@/components/explainability/ToxicTextHighlighter'
import { useDashboardStore } from '@/lib/store/dashboard'
import { singleClassify } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const PROB_ROWS = [
  { key: 'normal' as const, label: 'Normal', color: 'bg-emerald-500' },
  { key: 'abuse' as const, label: 'Abuse', color: 'bg-amber-500' },
  { key: 'hate' as const, label: 'Hate', color: 'bg-[var(--hg-secondary)]' },
]

function ProbabilityMeters({
  probabilities,
  predicted,
}: {
  probabilities: { normal: number; abuse: number; hate: number }
  predicted: string
}) {
  return (
    <div className="space-y-2.5">
      {PROB_ROWS.map((row) => {
        const value = probabilities[row.key]
        const pct = Math.round(value * 1000) / 10
        const isTop = predicted.toLowerCase() === row.key
        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  'text-xs font-medium',
                  isTop ? 'text-[var(--hg-ink)]' : 'text-[var(--hg-muted)]',
                )}
              >
                {row.label}
                {isTop ? (
                  <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-[var(--hg-brand)] uppercase">
                    Predicted
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--hg-muted)]">
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hg-canvas)]">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500', row.color)}
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TextTester() {
  const language = useDashboardStore((s) => s.language)
  const languageLabel = language === 'igbo' ? 'Igbo' : 'Yoruba'
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (input: string) => singleClassify(input, language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview-stats'] })
      queryClient.invalidateQueries({ queryKey: ['volume'] })
    },
  })

  const result = mutation.data
  const shap = result?.explanation?.methods.shap
  const hasShapTokens =
    Boolean(shap) && 'tokens' in shap! && 'scores' in shap! && Array.isArray(shap!.tokens)

  const topConfidence = useMemo(() => {
    if (!result) return null
    const key = result.predicted_label.toLowerCase() as 'normal' | 'abuse' | 'hate'
    const value = result.probabilities[key] ?? Math.max(
      result.probabilities.normal,
      result.probabilities.abuse,
      result.probabilities.hate,
    )
    return Math.round(value * 100)
  }, [result])

  const runAnalyze = () => {
    const trimmed = text.trim()
    if (!trimmed || mutation.isPending) return
    mutation.mutate(trimmed)
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-5">
      <div className="overflow-hidden rounded-[4px] border border-[var(--hg-border)]">
        <div className="border-b border-[var(--hg-border)] bg-[var(--hg-canvas)]/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--hg-ink)]">Message to classify</p>
              <p className="text-[11px] text-[var(--hg-muted)]">
                Paste {languageLabel} text. Results are logged for the active language.
              </p>
            </div>
            <span className="rounded-[4px] bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--hg-brand)] uppercase ring-1 ring-[var(--hg-border)]">
              {languageLabel}
            </span>
          </div>
        </div>

        <Textarea
          placeholder={`e.g. a ${languageLabel} message you want to check for hate or abuse…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              runAnalyze()
            }
          }}
          className={cn(
            'min-h-[140px] resize-y rounded-none border-0 bg-white px-4 py-3 text-sm leading-relaxed',
            'shadow-none focus-visible:border-transparent focus-visible:ring-0',
            'placeholder:text-[var(--hg-subtle)]',
          )}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hg-border)] bg-white px-4 py-3">
          <p className="text-[11px] text-[var(--hg-muted)]">
            <span className="font-mono tabular-nums text-[var(--hg-ink)]">{text.trim().length}</span>
            {' '}characters
            <span className="mx-1.5 text-[var(--hg-subtle)]">·</span>
            ⌘/Ctrl + Enter to run
          </p>
          <Button
            type="button"
            onClick={runAnalyze}
            disabled={!text.trim() || mutation.isPending}
            className="h-8 rounded-[4px] bg-[var(--hg-brand)] px-3 text-white hover:bg-[var(--hg-brand)]/90"
          >
            {mutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {mutation.isPending ? 'Analyzing…' : 'Analyze'}
          </Button>
        </div>
      </div>

      {mutation.isError && (
        <div className="rounded-[4px] border border-[var(--hg-secondary)]/25 bg-[var(--hg-secondary)]/5 px-4 py-3">
          <p className="text-sm font-medium text-[var(--hg-secondary)]">Classification failed</p>
          <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
            Check that the backend is running and reachable via the Vite proxy, then try again.
          </p>
        </div>
      )}

      {!result && !mutation.isPending && !mutation.isError && (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-[var(--hg-border)] py-12 text-center">
          <Sparkles className="size-5 text-[var(--hg-subtle)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--hg-ink)]">No result yet</p>
          <p className="max-w-sm text-xs text-[var(--hg-muted)]">
            Run Analyze to see the predicted label, class probabilities, and token highlights.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--hg-border)] pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                Prediction
              </p>
              <div className="mt-1">
                <Badge
                  variant={labelBadgeVariant(result.predicted_label)}
                  className="rounded-[4px] px-2.5 py-0.5 text-sm font-semibold"
                >
                  {result.predicted_label}
                </Badge>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                Confidence
              </p>
              <p className="text-sm font-semibold tabular-nums text-[var(--hg-ink)]">
                {topConfidence}%
              </p>
              <p className="text-[10px] text-[var(--hg-muted)]">Top-class probability</p>
            </div>
            {result.model_id && (
              <div className="min-w-0 sm:ml-auto sm:text-right">
                <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                  Model
                </p>
                <p className="max-w-[14rem] truncate font-mono text-[11px] text-[var(--hg-muted)]" title={result.model_id}>
                  {result.model_id}
                </p>
                {result.used_fallback ? (
                  <p className="text-[10px] text-amber-600">Joint fallback</p>
                ) : (
                  <p className="text-[10px] text-[var(--hg-muted)]">Logged to your account</p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] p-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--hg-ink)]">Class probabilities</h3>
                <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                  How the model distributed probability across labels.
                </p>
              </div>
              <ProbabilityMeters
                probabilities={result.probabilities}
                predicted={result.predicted_label}
              />
            </div>

            <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] p-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--hg-ink)]">Token highlights</h3>
                <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                  Words that pushed the prediction (SHAP). Red raises toxicity; blue lowers it.
                </p>
              </div>
              {hasShapTokens ? (
                <div className="rounded-[4px] bg-[var(--hg-canvas)]/60 px-3 py-3">
                  <ToxicTextHighlighter tokens={shap!.tokens} scores={shap!.scores} />
                </div>
              ) : (
                <div className="rounded-[4px] border border-dashed border-[var(--hg-border)] px-3 py-6 text-center">
                  <p className="text-xs text-[var(--hg-muted)]">
                    Token-level explainability needs a working <span className="font-mono">/explain</span> response.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

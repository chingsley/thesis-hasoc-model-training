import { cn } from '@/lib/utils'

interface ToxicTextHighlighterProps {
  tokens: string[]
  scores: { token: string; score: number }[]
  className?: string
  /** When true, tokens are unordered feature weights (e.g. LIME as_list) shown as wrapping chips. */
  asFeatures?: boolean
}

function normalizeToken(token: string): string {
  return token
    .replace('\u0120', '') // RoBERTa Ġ prefix
    .replace('\u2581', '') // SentencePiece ▁ prefix
    .trim()
    .toLowerCase()
}

/** Red = toward predicted class, blue = against (previous highlight palette). */
function attributionColor(score: number, intensity: number): string {
  const alpha = 0.15 + intensity * 0.7
  return score >= 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(59, 130, 246, ${alpha})`
}

export function ToxicTextHighlighter({
  tokens,
  scores,
  className,
  asFeatures = false,
}: ToxicTextHighlighterProps) {
  const maxAbs = Math.max(...scores.map((s) => Math.abs(s.score)), 0.01)

  const scoreMap = new Map<string, number>()
  scores.forEach((s) => {
    if (!s.token) return
    scoreMap.set(normalizeToken(s.token), s.score)
  })

  const displayed = tokens.map((raw) => {
    const display = raw.replace('\u0120', ' ').replace('\u2581', ' ')
    return { raw, display }
  })

  if (asFeatures) {
    const ranked = displayed
      .map(({ raw, display }, i) => {
        const score = scoreMap.get(normalizeToken(raw)) ?? 0
        return { raw, display, score, i }
      })
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

    return (
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {ranked.map(({ raw, display, score, i }) => {
          const intensity = Math.min(1, Math.abs(score) / maxAbs)
          const label = display.trim() || raw

          return (
            <span
              key={`${raw}-${i}`}
              title={`Score: ${score.toFixed(4)}`}
              style={{ backgroundColor: attributionColor(score, intensity) }}
              className={cn(
                'inline-flex max-w-full items-baseline gap-1.5 rounded-[4px] border border-black/5 px-2 py-1 text-sm text-[var(--hg-ink)] break-words',
              )}
            >
              <span className="font-medium">{label}</span>
              <span className="font-mono text-[10px] text-[var(--hg-muted)] tabular-nums">
                {score >= 0 ? '+' : ''}
                {score.toFixed(2)}
              </span>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <p className={cn('text-[13px] leading-[1.85] break-words whitespace-normal text-[var(--hg-ink)]', className)}>
      {displayed.map(({ raw, display }, i) => {
        const score = scoreMap.get(normalizeToken(raw)) ?? 0
        const intensity = Math.min(1, Math.abs(score) / maxAbs)
        const needsGap = i > 0 && !display.startsWith(' ')

        return (
          <span key={`${raw}-${i}`}>
            {needsGap ? ' ' : null}
            <span
              title={`Score: ${score.toFixed(4)}`}
              style={{ backgroundColor: attributionColor(score, intensity) }}
              className="rounded-[4px] px-0.5"
            >
              {display}
            </span>
          </span>
        )
      })}
    </p>
  )
}

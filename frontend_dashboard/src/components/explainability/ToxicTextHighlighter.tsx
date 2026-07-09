import { cn } from '@/lib/utils'

interface ToxicTextHighlighterProps {
  tokens: string[]
  scores: { token: string; score: number }[]
  className?: string
}

function normalizeToken(token: string): string {
  return token
    .replace('\u0120', '')  // RoBERTa Ġ prefix
    .replace('\u2581', '')  // SentencePiece ▁ prefix
    .trim()
    .toLowerCase()
}

export function ToxicTextHighlighter({ tokens, scores, className }: ToxicTextHighlighterProps) {
  const maxAbs = Math.max(...scores.map((s) => Math.abs(s.score)), 0.01)

  const scoreMap = new Map<string, number>()
  scores.forEach((s) => {
    if (!s.token) return
    scoreMap.set(normalizeToken(s.token), s.score)
  })

  const displayed = tokens.map((raw) => {
    const display = raw
      .replace('\u0120', ' ')
      .replace('\u2581', ' ')
    return { raw, display }
  })

  return (
    <div className={cn('leading-relaxed text-sm', className)}>
      {displayed.map(({ raw, display }, i) => {
        const score = scoreMap.get(normalizeToken(raw)) ?? 0
        const intensity = Math.min(1, Math.abs(score) / maxAbs)
        const alpha = 0.15 + intensity * 0.7
        const color =
          score >= 0
            ? `rgba(239, 68, 68, ${alpha})`
            : `rgba(59, 130, 246, ${alpha})`

        return (
          <span
            key={`${raw}-${i}`}
            title={`Score: ${score.toFixed(4)}`}
            style={{ backgroundColor: color }}
            className="px-0.5 rounded cursor-default"
          >
            {display}
          </span>
        )
      })}
    </div>
  )
}

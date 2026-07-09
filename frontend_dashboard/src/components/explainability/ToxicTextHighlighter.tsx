import type { TokenScore } from '@/lib/types'

interface ToxicTextHighlighterProps {
  text: string
  scores: TokenScore[] | [string, number][]
}

function normalizeScores(scores: TokenScore[] | [string, number][]): Map<string, number> {
  const map = new Map<string, number>()
  if (scores.length === 0) return map

  if (Array.isArray(scores[0]) && scores[0].length === 2) {
    for (const [token, score] of scores as [string, number][]) {
      map.set(token, score)
    }
  } else {
    for (const { token, score } of scores as TokenScore[]) {
      map.set(token, score)
    }
  }
  return map
}

export function ToxicTextHighlighter({ text, scores }: ToxicTextHighlighterProps) {
  const scoreMap = normalizeScores(scores)
  const tokens = text.split(/(\s+)/)

  return (
    <p className="text-sm leading-relaxed">
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>
        const clean = token.replace(/[^\w]/g, '')
        const score = scoreMap.get(token) ?? scoreMap.get(clean) ?? 0
        if (Math.abs(score) < 0.05) return <span key={i}>{token}</span>

        const bg =
          score > 0
            ? `rgba(239, 68, 68, ${Math.min(Math.abs(score) * 1.5, 0.7)})`
            : `rgba(59, 130, 246, ${Math.min(Math.abs(score) * 1.5, 0.5)})`

        return (
          <span
            key={i}
            style={{ backgroundColor: bg }}
            className="rounded px-0.5"
            title={`${token}: ${score.toFixed(3)}`}
          >
            {token}
          </span>
        )
      })}
    </p>
  )
}

import type { ExplanationPayload, XaiMethod } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToxicTextHighlighter } from './ToxicTextHighlighter'
import { Badge } from '@/components/ui/badge'

const METHOD_LABELS: Record<XaiMethod, string> = {
  lime: 'LIME',
  shap: 'SHAP',
  attention_rollout: 'Attention Rollout',
  integrated_gradients: 'Integrated Gradients',
}

interface ExplanationPanelProps {
  method: XaiMethod
  explanation: ExplanationPayload
}

export function ExplanationPanel({ method, explanation }: ExplanationPanelProps) {
  const data = explanation.methods[method]

  if (!data || 'error' in data) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{METHOD_LABELS[method]}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{'error' in (data ?? {}) ? (data as { error: string }).error : 'Unavailable'}</p>
        </CardContent>
      </Card>
    )
  }

  const isLime = method === 'lime' && 'scores' in data && Array.isArray(data.scores[0])
  const scores = isLime
    ? (data as { scores: [string, number][] }).scores
    : (data as { scores: { token: string; score: number }[] }).scores

  const topTokens = isLime
    ? [...(scores as [string, number][])].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5)
    : [...(scores as { token: string; score: number }[])]
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 5)

  return (
    <Card className="rounded-xl shadow-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{METHOD_LABELS[method]}</CardTitle>
          {'fidelity_proxy' in data && (
            <Badge variant="outline" className="text-xs">
              Fidelity: {(data.fidelity_proxy * 100).toFixed(0)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToxicTextHighlighter text={explanation.text} scores={scores as [string, number][]} />
        <div className="flex flex-wrap gap-1">
          {topTokens.map((item, i) => {
            const token = Array.isArray(item) ? item[0] : item.token
            const score = Array.isArray(item) ? item[1] : item.score
            return (
              <Badge key={i} variant={score > 0 ? 'destructive' : 'secondary'} className="text-xs">
                {token}: {score > 0 ? '+' : ''}{score.toFixed(2)}
              </Badge>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

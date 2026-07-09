import type { TokenExplanation, LimeExplanation, XaiMethod } from '@/lib/types'
import { ToxicTextHighlighter } from './ToxicTextHighlighter'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

const methodColors: Record<XaiMethod, string> = {
  lime: 'bg-green-100 text-green-800 border-green-300',
  shap: 'bg-blue-100 text-blue-800 border-blue-300',
  attention_rollout: 'bg-purple-100 text-purple-800 border-purple-300',
  integrated_gradients: 'bg-orange-100 text-orange-800 border-orange-300',
}

export function ExplanationPanel({ method, explanation }: ExplanationPanelProps) {
  if (!explanation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{methodLabels[method]}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No explanation available</p>
        </CardContent>
      </Card>
    )
  }

  if ('error' in explanation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{methodLabels[method]}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">{explanation.error}</p>
        </CardContent>
      </Card>
    )
  }

  const rawScores: unknown[] = (explanation as LimeExplanation).scores ?? []

  let tokens: string[] = []
  let scores: { token: string; score: number }[] = []

  if (rawScores.length > 0 && Array.isArray(rawScores[0])) {
    tokens = (rawScores as [string, number][]).map((s) => s[0])
    scores = (rawScores as [string, number][]).map(([t, s]) => ({ token: t, score: s }))
  } else {
    const objScores = rawScores as { token: string; score: number }[]
    scores = objScores
    tokens = 'tokens' in explanation ? explanation.tokens : objScores.map((s) => s.token)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{methodLabels[method]}</CardTitle>
          <Badge variant="outline" className={methodColors[method]}>
            {methodLabels[method]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ToxicTextHighlighter
          tokens={tokens}
          scores={scores}
        />
      </CardContent>
    </Card>
  )
}

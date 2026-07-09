import { useState } from 'react'
import { useDashboardStore } from '@/lib/store/dashboard'
import { classifyText } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { ToxicTextHighlighter } from '@/components/explainability/ToxicTextHighlighter'

export function TextTester() {
  const language = useDashboardStore((s) => s.language)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof classifyText>> | null>(null)

  const handleClassify = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await classifyText(text, language)
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  const labelVariant = (label: string) => {
    if (label === 'Hate') return 'destructive' as const
    if (label === 'Abuse') return 'default' as const
    return 'secondary' as const
  }

  const shapScores =
    result?.explanation.methods.shap && !('error' in result.explanation.methods.shap)
      ? result.explanation.methods.shap.scores
      : []

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Text Toxicity Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste text to test toxicity score..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="rounded-xl"
        />
        <Button onClick={handleClassify} disabled={loading || !text.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Classify Text
        </Button>

        {result && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={labelVariant(result.predicted_label)} className="text-sm">
                {result.predicted_label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Normal: {(result.probabilities.normal * 100).toFixed(1)}% |
                Abuse: {(result.probabilities.abuse * 100).toFixed(1)}% |
                Hate: {(result.probabilities.hate * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Toxic highlights (SHAP attribution)</p>
              <ToxicTextHighlighter text={text} scores={shapScores} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

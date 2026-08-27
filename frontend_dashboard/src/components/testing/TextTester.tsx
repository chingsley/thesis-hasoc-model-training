import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, labelBadgeVariant } from '@/components/ui/badge'
import { useDashboardStore } from '@/lib/store/dashboard'
import { singleClassify } from '@/lib/api/client'
import { ToxicTextHighlighter } from '@/components/explainability/ToxicTextHighlighter'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Loader2, Sparkles } from 'lucide-react'

export function TextTester() {
  const language = useDashboardStore((s) => s.language)
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (input: string) => singleClassify(input, language),
    onSuccess: () => {
      // the prediction was logged server-side — refresh per-user stats immediately
      queryClient.invalidateQueries({ queryKey: ['overview-stats'] })
      queryClient.invalidateQueries({ queryKey: ['volume'] })
    },
  })

  const result = mutation.data
  const shap = result?.explanation?.methods.shap
  const hasShapTokens =
    shap && 'tokens' in shap && 'scores' in shap && Array.isArray(shap.tokens)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Textarea
          placeholder={`Paste ${language === 'igbo' ? 'Igbo' : 'Yoruba'} text here to test its toxicity score...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 min-h-[100px]"
        />
        <Button
          onClick={() => text.trim() && mutation.mutate(text.trim())}
          disabled={!text.trim() || mutation.isPending}
          className="shrink-0"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Analyze
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          Classification failed. Is the backend running and reachable via the Vite proxy?
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <SectionTitle>Classification Result</SectionTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Badge variant={labelBadgeVariant(result.predicted_label)} className="text-base px-3 py-1">
                  {result.predicted_label}
                </Badge>
                <div className="flex items-center gap-4 text-sm">
                  <span>Normal: <strong>{(result.probabilities.normal * 100).toFixed(1)}%</strong></span>
                  <span>Abuse: <strong>{(result.probabilities.abuse * 100).toFixed(1)}%</strong></span>
                  <span>Hate: <strong>{(result.probabilities.hate * 100).toFixed(1)}%</strong></span>
                </div>
              </div>

              {result.model_id && (
                <p className="text-xs font-mono text-muted-foreground mb-4">
                  model: {result.model_id}
                  {result.used_fallback ? ' (joint fallback)' : ''}
                </p>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Text Highlighting (Explainability)</h4>
                {hasShapTokens ? (
                  <div className="p-4 bg-muted rounded-lg">
                    <ToxicTextHighlighter
                      tokens={shap.tokens}
                      scores={shap.scores}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Token-level explainability requires a backend /explain endpoint.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

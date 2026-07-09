import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDashboardStore } from '@/lib/store/dashboard'
import { mockSingleClassify } from '@/lib/api/client'
import { ToxicTextHighlighter } from '@/components/explainability/ToxicTextHighlighter'
import { Loader2, Sparkles } from 'lucide-react'

export function TextTester() {
  const language = useDashboardStore((s) => s.language)
  const [text, setText] = useState('')

  const mutation = useMutation({
    mutationFn: (input: string) => mockSingleClassify(input, language),
  })

  const result = mutation.data

  const getLabelBadgeVariant = (label: string) => {
    if (label === 'Hate') return 'destructive' as const
    if (label === 'Abuse') return 'default' as const
    return 'secondary' as const
  }

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

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant={getLabelBadgeVariant(result.predicted_label)} className="text-base px-3 py-1">
                  {result.predicted_label}
                </Badge>
                <div className="flex items-center gap-4 text-sm">
                  <span>Normal: <strong>{(result.probabilities.normal * 100).toFixed(1)}%</strong></span>
                  <span>Abuse: <strong>{(result.probabilities.abuse * 100).toFixed(1)}%</strong></span>
                  <span>Hate: <strong>{(result.probabilities.hate * 100).toFixed(1)}%</strong></span>
                </div>
              </div>

              <h4 className="text-sm font-medium text-muted-foreground mb-2">Text Highlighting (Explainability)</h4>
              <div className="p-4 bg-muted rounded-lg">
                <ToxicTextHighlighter
                  tokens={result.explanation.methods.shap && 'tokens' in result.explanation.methods.shap ? result.explanation.methods.shap.tokens : text.split(/\s+/)}
                  scores={result.explanation.methods.shap && 'scores' in result.explanation.methods.shap
                    ? result.explanation.methods.shap.scores
                    : text.split(/\s+/).map((t) => ({ token: t, score: 0 }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

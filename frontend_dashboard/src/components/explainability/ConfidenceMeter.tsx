import type { ExplanationPayload } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface ConfidenceMeterProps {
  explanation: ExplanationPayload
}

export function ConfidenceMeter({ explanation }: ConfidenceMeterProps) {
  const { metrics, methods } = explanation
  const lime = methods.lime
  const fidelity =
    metrics.lime_faithfulness_aopc_proxy ??
    (lime && !('error' in lime) ? lime.fidelity_proxy : 0)
  const stability = metrics.lime_stability_jaccard ?? 0
  const agreement = metrics.cross_method_agreement_mean ?? 0

  const warnings: string[] = []
  if (fidelity < 0.35) warnings.push('Low LIME faithfulness — highlights may not reflect model reasoning')
  if (stability < 0.65) warnings.push('Low LIME stability — explanations vary across runs')
  if (agreement < 0.45) warnings.push('Low cross-method agreement — methods disagree on important tokens')

  const items = [
    { label: 'LIME Faithfulness (AOPC)', value: fidelity, threshold: 0.35 },
    { label: 'LIME Stability (Jaccard)', value: stability, threshold: 0.65 },
    { label: 'Cross-Method Agreement', value: agreement, threshold: 0.45 },
  ]

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Explanation Confidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={`font-mono font-medium ${item.value < item.threshold ? 'text-yellow-600' : 'text-green-600'}`}>
                {(item.value * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${item.value < item.threshold ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(item.value * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}

        {warnings.length > 0 && (
          <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <ul className="list-disc list-inside text-sm space-y-1">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

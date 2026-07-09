import type { ExplanationPayload } from '@/lib/types'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

interface ConfidenceMeterProps {
  explanation: ExplanationPayload
}

export function ConfidenceMeter({ explanation }: ConfidenceMeterProps) {
  const metrics = explanation.metrics

  const agreement = metrics.cross_method_agreement_mean ?? 0
  const fidelity = metrics.lime_faithfulness_aopc_proxy ?? 0
  const stability = metrics.lime_stability_jaccard ?? 0

  const items = [
    {
      label: 'Cross-Method Agreement',
      value: agreement,
      format: (v: number) => `${Math.round(v * 100)}%`,
      threshold: 0.5,
    },
    {
      label: 'LIME Fidelity (AOPC)',
      value: fidelity,
      format: (v: number) => v.toFixed(3),
      threshold: 0.4,
    },
    {
      label: 'LIME Stability (Jaccard)',
      value: stability,
      format: (v: number) => `${Math.round(v * 100)}%`,
      threshold: 0.7,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Explanation Confidence</h3>
        {agreement >= 0.5 && fidelity >= 0.4 ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => {
          const isGood = item.value >= item.threshold
          return (
            <div key={item.label} className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                {!isGood && <AlertTriangle className="h-3 w-3 text-amber-500" />}
              </div>
              <p className={`text-lg font-bold ${isGood ? 'text-green-600' : 'text-amber-600'}`}>
                {item.format(item.value)}
              </p>
              <div className="w-full h-1.5 bg-border rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isGood ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, (item.value / item.threshold) * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

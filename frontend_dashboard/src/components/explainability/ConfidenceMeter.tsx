import type { ExplanationPayload } from '@/lib/types'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

interface ConfidenceMeterProps {
  /** Partial metrics are fine — missing values render as loading skeletons. */
  metrics: ExplanationPayload['metrics']
}

export function ConfidenceMeter({ metrics }: ConfidenceMeterProps) {
  const items = [
    {
      label: 'Cross-Method Agreement',
      value: metrics.cross_method_agreement_mean,
      format: (v: number) => `${Math.round(v * 100)}%`,
      threshold: 0.5,
    },
    {
      label: 'LIME Fidelity (AOPC)',
      value: metrics.lime_faithfulness_aopc_proxy,
      format: (v: number) => v.toFixed(3),
      threshold: 0.4,
    },
    {
      label: 'LIME Stability (Jaccard)',
      value: metrics.lime_stability_jaccard,
      format: (v: number) => `${Math.round(v * 100)}%`,
      threshold: 0.7,
    },
  ]

  const agreement = metrics.cross_method_agreement_mean
  const fidelity = metrics.lime_faithfulness_aopc_proxy
  const headerGood =
    agreement !== undefined && fidelity !== undefined && agreement >= 0.5 && fidelity >= 0.4

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Explanation Confidence</h3>
        {headerGood ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => {
          if (item.value === undefined) {
            return (
              <div key={item.label} className="p-3 bg-muted rounded-lg animate-pulse">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <div className="h-7 bg-border rounded mt-1 w-1/2" />
                <div className="w-full h-1.5 bg-border rounded-full mt-2" />
              </div>
            )
          }
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

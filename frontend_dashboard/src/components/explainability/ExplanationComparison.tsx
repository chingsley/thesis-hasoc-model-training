import type { ExplanationPayload } from '@/lib/types'
import { ExplanationPanel } from './ExplanationPanel'

interface ExplanationComparisonProps {
  explanation: ExplanationPayload
}

export function ExplanationComparison({ explanation }: ExplanationComparisonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ExplanationPanel method="lime" explanation={explanation} />
      <ExplanationPanel method="shap" explanation={explanation} />
      <ExplanationPanel method="attention_rollout" explanation={explanation} />
      <ExplanationPanel method="integrated_gradients" explanation={explanation} />
    </div>
  )
}

import type { ExplanationPayload } from '@/lib/types'
import { ExplanationPanel } from './ExplanationPanel'
import type { XaiMethod } from '@/lib/types'

interface ExplanationComparisonProps {
  explanation: ExplanationPayload
}

const methods: XaiMethod[] = ['lime', 'shap', 'attention_rollout', 'integrated_gradients']

export function ExplanationComparison({ explanation }: ExplanationComparisonProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Side-by-Side Method Comparison
      </h3>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {methods.map((method) => (
          <ExplanationPanel
            key={method}
            method={method}
            explanation={explanation.methods[method]}
          />
        ))}
      </div>
    </div>
  )
}

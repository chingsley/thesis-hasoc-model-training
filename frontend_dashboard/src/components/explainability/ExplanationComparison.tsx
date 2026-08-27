import type { ExplanationPayload } from '@/lib/types'
import { ExplanationPanel } from './ExplanationPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { XaiMethod } from '@/lib/types'

interface ExplanationComparisonProps {
  explanation: ExplanationPayload
  /** Methods whose requests are still in flight — rendered as skeletons. */
  loadingMethods?: XaiMethod[]
}

const methods: XaiMethod[] = ['lime', 'shap', 'attention_rollout', 'integrated_gradients']

const methodLabels: Record<XaiMethod, string> = {
  lime: 'LIME',
  shap: 'SHAP',
  attention_rollout: 'Attention Rollout',
  integrated_gradients: 'Integrated Gradients',
}

function ExplanationSkeleton({ method }: { method: XaiMethod }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{methodLabels[method]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 animate-pulse" aria-label={`${methodLabels[method]} loading`}>
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-4/6" />
          <p className="text-xs text-muted-foreground pt-1">Computing {methodLabels[method]}…</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ExplanationComparison({ explanation, loadingMethods = [] }: ExplanationComparisonProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Side-by-Side Method Comparison
      </h3>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {methods.map((method) =>
          !explanation.methods[method] && loadingMethods.includes(method) ? (
            <ExplanationSkeleton key={method} method={method} />
          ) : (
            <ExplanationPanel
              key={method}
              method={method}
              explanation={explanation.methods[method]}
            />
          )
        )}
      </div>
    </div>
  )
}

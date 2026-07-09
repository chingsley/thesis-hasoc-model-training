import { useModelMetrics } from '@/hooks/use-metrics'
import { ConfusionMatrix } from '@/components/charts/ConfusionMatrix'
import { PerClassMetrics } from '@/components/charts/PerClassMetrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function Performance() {
  const { data: metrics, isLoading } = useModelMetrics()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Confusion Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfusionMatrix matrix={metrics.confusion_matrix} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per-Class Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PerClassMetrics metrics={metrics.per_class} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overall Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Accuracy</p>
              <p className="text-3xl font-bold">{(metrics.accuracy * 100).toFixed(1)}%</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Macro F1</p>
              <p className="text-3xl font-bold">{(metrics.macro_f1 * 100).toFixed(1)}%</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Weighted F1</p>
              <p className="text-3xl font-bold">{(metrics.weighted_f1 * 100).toFixed(1)}%</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">MCC</p>
              <p className="text-3xl font-bold">{metrics.mcc.toFixed(3)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Macro Precision</p>
              <p className="text-3xl font-bold">{(metrics.macro_precision * 100).toFixed(1)}%</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Macro Recall</p>
              <p className="text-3xl font-bold">{(metrics.macro_recall * 100).toFixed(1)}%</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">ROC-AUC (OvR)</p>
              <p className="text-3xl font-bold">{metrics.roc_auc_ovr?.toFixed(3) ?? 'N/A'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Support</p>
              <p className="text-3xl font-bold">{metrics.support.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { useModelMetrics } from '@/hooks/use-metrics'
import { ConfusionMatrix } from '@/components/charts/ConfusionMatrix'
import { PerClassMetrics } from '@/components/charts/PerClassMetrics'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Loader2 } from 'lucide-react'

export default function Performance() {
  const { data: metrics, isLoading, isError } = useModelMetrics()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !metrics) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        Metrics unavailable. Copy <code className="text-xs">test_metrics.json</code> from the server into{' '}
        <code className="text-xs">runs/</code> and check <code className="text-xs">METRICS_PATH_*</code> in{' '}
        <code className="text-xs">backend_api_server/.env</code>.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <SectionTitle>Confusion Matrix</SectionTitle>
          </CardHeader>
          <CardContent>
            <ConfusionMatrix matrix={metrics.confusion_matrix} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle>Per-Class Performance</SectionTitle>
          </CardHeader>
          <CardContent>
            <PerClassMetrics metrics={metrics.per_class} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <SectionTitle>Overall Metrics</SectionTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">Accuracy</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{(metrics.accuracy * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">Macro F1</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{(metrics.macro_f1 * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">Weighted F1</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{(metrics.weighted_f1 * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">MCC</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{metrics.mcc.toFixed(3)}</p>
            </div>
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">Macro Precision</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{(metrics.macro_precision * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">Macro Recall</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{(metrics.macro_recall * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">ROC-AUC (OvR)</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{metrics.roc_auc_ovr?.toFixed(3) ?? 'N/A'}</p>
            </div>
            <div className="rounded-[8px] bg-white border border-[#e8edf5] p-4">
              <p className="text-sm text-muted-foreground">Total Support</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{metrics.support.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

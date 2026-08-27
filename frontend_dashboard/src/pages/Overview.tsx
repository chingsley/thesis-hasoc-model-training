import { useModelMetrics } from '@/hooks/use-metrics'
import { useAlerts } from '@/hooks/use-alerts'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { AlertToast } from '@/components/alerts/AlertToast'
import { fetchOverviewStats, fetchVolumeData } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'

export default function Overview() {
  const language = useDashboardStore((s) => s.language)
  const { data: stats } = useQuery({
    queryKey: ['overview-stats', language],
    queryFn: () => fetchOverviewStats(language),
  })
  const { data: metrics, isError: metricsError } = useModelMetrics()
  const { data: volumeData } = useQuery({
    queryKey: ['volume', language],
    queryFn: () => fetchVolumeData(language),
  })
  useAlerts()

  return (
    <div className="space-y-6">
      <AlertToast />
      <div className="space-y-2">
        <SectionTitle>Post Statistics</SectionTitle>
        <StatsCards
          total={stats?.total ?? 0}
          normal={stats?.normal ?? 0}
          abuse={stats?.abuse ?? 0}
          hate={stats?.hate ?? 0}
        />
      </div>

      {volumeData && (
        <Card>
          <CardHeader>
            <SectionTitle>Post Volume (Last 7 Days)</SectionTitle>
          </CardHeader>
          <CardContent>
            <VolumeChart data={volumeData} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <SectionTitle>Model Performance Summary</SectionTitle>
        </CardHeader>
        <CardContent>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{(metrics.accuracy * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{(metrics.macro_f1 * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Macro F1</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{(metrics.macro_precision * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Macro Precision</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{(metrics.macro_recall * 100).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Macro Recall</p>
              </div>
            </div>
          )}
          {metricsError && (
            <p className="text-sm text-muted-foreground">
              Metrics unavailable. The backend reads <code className="text-xs">test_metrics.json</code> from the
              model's Hugging Face repo — make sure the backend is running and the repo includes it
              (see <code className="text-xs">backend_api_server/scripts/upload_metrics_to_hf.py</code>).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

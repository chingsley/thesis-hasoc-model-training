import { usePosts } from '@/hooks/use-posts'
import { useModelMetrics } from '@/hooks/use-metrics'
import { useAlerts } from '@/hooks/use-alerts'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { ModelThresholdSlider } from '@/components/dashboard/ModelThresholdSlider'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { AlertToast } from '@/components/alerts/AlertToast'
import { fetchVolumeData, getDataSource } from '@/lib/api/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'

export default function Overview() {
  const { data: posts } = usePosts()
  const { data: metrics, isError: metricsError } = useModelMetrics()
  const { data: volumeData } = useQuery({
    queryKey: ['volume'],
    queryFn: fetchVolumeData,
  })
  useAlerts()

  const normalCount = posts?.filter((p) => p.predicted_label === 'Normal').length ?? 0
  const abuseCount = posts?.filter((p) => p.predicted_label === 'Abuse').length ?? 0
  const hateCount = posts?.filter((p) => p.predicted_label === 'Hate').length ?? 0
  const totalCount = (normalCount + abuseCount + hateCount) || 3000

  return (
    <div className="space-y-6">
      <AlertToast />
      <div className="space-y-2">
        <SectionTitle source={getDataSource('stats')}>Post Statistics</SectionTitle>
        <StatsCards
          total={totalCount}
          normal={normalCount || 2200}
          abuse={abuseCount || 600}
          hate={hateCount || 200}
        />
      </div>

      <Card>
        <CardHeader>
          <SectionTitle source={getDataSource('posts')}>Model Confidence Threshold</SectionTitle>
        </CardHeader>
        <CardContent>
          <ModelThresholdSlider />
        </CardContent>
      </Card>

      {volumeData && (
        <Card>
          <CardHeader>
            <SectionTitle source={getDataSource('volume')}>Post Volume (Last 7 Days)</SectionTitle>
          </CardHeader>
          <CardContent>
            <VolumeChart data={volumeData} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <SectionTitle source={getDataSource('metrics')}>Model Performance Summary</SectionTitle>
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
              Metrics unavailable. Copy <code className="text-xs">test_metrics.json</code> from the server into{' '}
              <code className="text-xs">runs/</code> and check <code className="text-xs">METRICS_PATH_*</code> in{' '}
              <code className="text-xs">backend_api_server/.env</code>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

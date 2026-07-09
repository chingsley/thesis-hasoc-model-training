import { usePosts } from '@/hooks/use-posts'
import { useModelMetrics } from '@/hooks/use-metrics'
import { useAlerts } from '@/hooks/use-alerts'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { ModelThresholdSlider } from '@/components/dashboard/ModelThresholdSlider'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { AlertToast } from '@/components/alerts/AlertToast'
import { fetchVolumeData } from '@/lib/api/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Overview() {
  const { data: posts } = usePosts()
  const { data: metrics } = useModelMetrics()
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
      <StatsCards
        total={totalCount}
        normal={normalCount || 2200}
        abuse={abuseCount || 600}
        hate={hateCount || 200}
      />

      <Card>
        <CardHeader>
          <CardTitle>Model Confidence Threshold</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelThresholdSlider />
        </CardContent>
      </Card>

      {volumeData && (
        <Card>
          <CardHeader>
            <CardTitle>Post Volume (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumeChart data={volumeData} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Model Performance Summary</CardTitle>
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
        </CardContent>
      </Card>
    </div>
  )
}

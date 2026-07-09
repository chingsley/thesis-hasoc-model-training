import { usePosts } from '@/hooks/use-posts'
import { useModelMetrics, useVolumeData } from '@/hooks/use-metrics'
import { useAlerts } from '@/hooks/use-alerts'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { ModelThresholdSlider } from '@/components/dashboard/ModelThresholdSlider'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { AlertToast } from '@/components/alerts/AlertToast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchPosts } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useQuery } from '@tanstack/react-query'

export default function Overview() {
  const language = useDashboardStore((s) => s.language)
  const { data: posts } = usePosts()
  const { data: metrics } = useModelMetrics()
  const { data: volumeData } = useVolumeData()
  useAlerts()

  const { data: allPosts } = useQuery({
    queryKey: ['all-posts-stats', language],
    queryFn: () => fetchPosts(language),
  })

  const statsSource = allPosts ?? posts
  const normalCount = statsSource?.filter((p) => p.predicted_label === 'Normal').length ?? 2200
  const abuseCount = statsSource?.filter((p) => p.predicted_label === 'Abuse').length ?? 600
  const hateCount = statsSource?.filter((p) => p.predicted_label === 'Hate').length ?? 200
  const totalCount = (normalCount + abuseCount + hateCount) || 3000

  return (
    <div className="space-y-6">
      <AlertToast />
      <StatsCards total={totalCount} normal={normalCount} abuse={abuseCount} hate={hateCount} />

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Model Confidence Threshold</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelThresholdSlider />
        </CardContent>
      </Card>

      {volumeData && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Post Volume (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumeChart data={volumeData} />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Model Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Accuracy', value: metrics.accuracy },
                { label: 'Macro F1', value: metrics.macro_f1 },
                { label: 'Macro Precision', value: metrics.macro_precision },
                { label: 'Macro Recall', value: metrics.macro_recall },
              ].map((m) => (
                <div key={m.label} className="text-center p-3 bg-muted rounded-xl">
                  <p className="text-2xl font-bold text-primary">{(m.value * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

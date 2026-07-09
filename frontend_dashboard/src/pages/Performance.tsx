import { useModelMetrics } from '@/hooks/use-metrics'
import { PerClassMetrics } from '@/components/charts/PerClassMetrics'
import { ConfusionMatrix } from '@/components/charts/ConfusionMatrix'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function Performance() {
  const { data: metrics, isLoading } = useModelMetrics()

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="space-y-6">
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Per-Class Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <PerClassMetrics metrics={metrics} />
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Confusion Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfusionMatrix metrics={metrics} />
        </CardContent>
      </Card>
    </div>
  )
}

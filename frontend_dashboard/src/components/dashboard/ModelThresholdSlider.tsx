import { Slider } from '@/components/ui/slider'
import { useDashboardStore } from '@/lib/store/dashboard'
import { Badge } from '@/components/ui/badge'

export function ModelThresholdSlider() {
  const hateThreshold = useDashboardStore((s) => s.hateThreshold)
  const setHateThreshold = useDashboardStore((s) => s.setHateThreshold)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Hate Probability Threshold</span>
          <Badge variant={hateThreshold > 0.7 ? 'destructive' : hateThreshold > 0.4 ? 'default' : 'secondary'}>
            {Math.round(hateThreshold * 100)}%
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {hateThreshold < 0.4
            ? 'Catching borderline cases'
            : hateThreshold > 0.7
            ? 'Reducing false alarms'
            : 'Balanced filtering'}
        </span>
      </div>
      <Slider
        value={[hateThreshold]}
        onValueChange={(v) => setHateThreshold(Array.isArray(v) ? v[0] : v)}
        min={0}
        max={1}
        step={0.01}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0% (Catch all)</span>
        <span>50%</span>
        <span>100% (Strict)</span>
      </div>
    </div>
  )
}

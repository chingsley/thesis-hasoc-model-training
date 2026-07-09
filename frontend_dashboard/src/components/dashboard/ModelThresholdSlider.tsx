import { Slider } from '@/components/ui/slider'
import { useDashboardStore } from '@/lib/store/dashboard'

export function ModelThresholdSlider() {
  const hateThreshold = useDashboardStore((s) => s.hateThreshold)
  const setHateThreshold = useDashboardStore((s) => s.setHateThreshold)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Filter posts by minimum Hate probability. Lower values surface borderline cases; higher values reduce false alarms.
        </p>
        <span className="text-lg font-bold text-primary font-mono">
          {(hateThreshold * 100).toFixed(0)}%
        </span>
      </div>
      <Slider
        value={[hateThreshold]}
        onValueChange={(v) => {
          const val = Array.isArray(v) ? v[0] : v
          if (typeof val === 'number') setHateThreshold(val)
        }}
        min={0}
        max={1}
        step={0.05}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0% — catch all</span>
        <span>50% — balanced</span>
        <span>100% — high confidence only</span>
      </div>
    </div>
  )
}

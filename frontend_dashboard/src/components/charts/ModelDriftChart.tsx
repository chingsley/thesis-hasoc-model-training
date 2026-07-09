import type { DriftDataPoint } from '@/lib/types'
import { TRAINING_BASELINE } from '@/lib/api/mock'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'

interface ModelDriftChartProps {
  data: DriftDataPoint[]
}

export function ModelDriftChart({ data }: ModelDriftChartProps) {
  const recent = data.slice(-7)
  const avgHate =
    recent.reduce((s, d) => s + d.hate_avg_confidence, 0) / recent.length
  const hateDrift =
    ((avgHate - TRAINING_BASELINE.hate_avg_confidence) / TRAINING_BASELINE.hate_avg_confidence) * 100
  const showWarning = hateDrift < -8

  return (
    <div className="space-y-4">
      {showWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Model drift detected</AlertTitle>
          <AlertDescription>
            Average Hate confidence dropped {Math.abs(hateDrift).toFixed(1)}% below training baseline.
            Consider retraining the model.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        {(['normal', 'abuse', 'hate'] as const).map((cls) => {
          const key = `${cls}_avg_confidence` as 'normal_avg_confidence' | 'abuse_avg_confidence' | 'hate_avg_confidence'
          const current = recent[recent.length - 1]?.[key] as number
          const baseline = TRAINING_BASELINE[key]
          const delta = ((current - baseline) / baseline) * 100
          return (
            <div key={cls} className="p-3 bg-muted rounded-xl">
              <p className="text-xs text-muted-foreground capitalize">{cls} confidence</p>
              <p className="font-bold">{(current * 100).toFixed(1)}%</p>
              <p className={`text-xs ${delta < -5 ? 'text-destructive' : 'text-green-600'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs baseline
              </p>
            </div>
          )
        })}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
          <YAxis domain={[0.5, 1]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <Tooltip formatter={(v) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : String(v)} />
          <Legend />
          <ReferenceLine y={TRAINING_BASELINE.hate_avg_confidence} stroke="#ef4444" strokeDasharray="5 5" label="Hate baseline" />
          <Line type="monotone" dataKey="normal_avg_confidence" stroke="#22c55e" strokeWidth={2} dot={false} name="Normal" />
          <Line type="monotone" dataKey="abuse_avg_confidence" stroke="#eab308" strokeWidth={2} dot={false} name="Abuse" />
          <Line type="monotone" dataKey="hate_avg_confidence" stroke="#ef4444" strokeWidth={2} dot={false} name="Hate" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

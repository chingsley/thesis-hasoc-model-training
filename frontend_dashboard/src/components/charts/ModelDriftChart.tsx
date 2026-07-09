import type { DriftDataPoint } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ModelDriftChartProps {
  data: DriftDataPoint[]
}

export function ModelDriftChart({ data }: ModelDriftChartProps) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            interval={4}
            className="text-muted-foreground"
          />
          <YAxis
            domain={[0.5, 1]}
            tick={{ fontSize: 10 }}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value: unknown) => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : String(value)}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="normal_avg_confidence"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="Normal Avg Confidence"
          />
          <Line
            type="monotone"
            dataKey="abuse_avg_confidence"
            stroke="#eab308"
            strokeWidth={2}
            dot={false}
            name="Abuse Avg Confidence"
          />
          <Line
            type="monotone"
            dataKey="hate_avg_confidence"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="Hate Avg Confidence"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center">
        Tracks average prediction confidence distribution over time. A sustained drift signals the model may need retraining.
      </p>
    </div>
  )
}

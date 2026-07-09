import type { VolumeDataPoint } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface VolumeChartProps {
  data: VolumeDataPoint[]
}

export function VolumeChart({ data }: VolumeChartProps) {
  const last168 = data.slice(-168)

  const formatted = last168.map((d) => ({
    ...d,
    hour: d.hour.slice(-5),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 10 }}
          interval={11}
          className="text-muted-foreground"
        />
        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
        <Tooltip
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
          dataKey="total"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          name="Total"
        />
        <Line
          type="monotone"
          dataKey="normal_count"
          stroke="#22c55e"
          strokeWidth={1.5}
          dot={false}
          name="Normal"
        />
        <Line
          type="monotone"
          dataKey="abuse_count"
          stroke="#eab308"
          strokeWidth={1.5}
          dot={false}
          name="Abuse"
        />
        <Line
          type="monotone"
          dataKey="hate_count"
          stroke="#ef4444"
          strokeWidth={1.5}
          dot={false}
          name="Hate"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
